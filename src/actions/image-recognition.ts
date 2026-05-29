'use server';

import { callTextAI, callVisionAI } from '@/lib/openai';
import { findMarkedWords, formatOCRForAI, OCRWordResult } from '@/lib/ocr';
import { Meaning } from '@/types/dict';
import sharp from 'sharp';

export interface RecognizedWord {
  text: string;
  meanings: Meaning[];
}

export interface RecognitionResult {
  words: RecognizedWord[];
  thinking: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  method: 'ocr' | 'ocr+ai' | 'ai';
}

async function compressBase64Image(
  base64Image: string,
  maxWidth: number = 1536,
  quality: number = 0.8
): Promise<{ data: string; originalSize: string; compressedSize: string }> {
  let base64Data: string;
  let isDataUrl = false;

  if (base64Image.startsWith('data:')) {
    const parts = base64Image.split(',');
    base64Data = parts[1];
    isDataUrl = true;
  } else {
    base64Data = base64Image;
  }

  const inputBuffer = Buffer.from(base64Data, 'base64');
  const metadata = await sharp(inputBuffer).metadata();

  let width = metadata.width;
  let height = metadata.height;
  const originalSizeStr = `${width}×${height} ${Math.round(inputBuffer.length / 1024)}KB`;

  if (width && height && (width > maxWidth || height > maxWidth)) {
    const ratio = Math.min(maxWidth / width, maxWidth / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const outputBuffer = await sharp(inputBuffer)
    .resize(width, height, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: Math.round(quality * 100) })
    .toBuffer();

  const compressedSizeStr = `${width}×${height} ${Math.round(outputBuffer.length / 1024)}KB`;
  console.log(`📸 服务端压缩: ${originalSizeStr} → ${compressedSizeStr}`);

  const outputBase64 = outputBuffer.toString('base64');
  return {
    data: isDataUrl ? `data:image/jpeg;base64,${outputBase64}` : outputBase64,
    originalSize: originalSizeStr,
    compressedSize: compressedSizeStr,
  };
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function isWordInOCR(aiWord: string, ocrWords: OCRWordResult[]): boolean {
  const aiLower = aiWord.toLowerCase();
  return ocrWords.some(ocrWord => {
    const ocrLower = ocrWord.text.toLowerCase();
    if (ocrLower === aiLower) return true;
    if (ocrLower.includes(aiLower) || aiLower.includes(ocrLower)) return true;
    if (Math.max(aiLower.length, ocrLower.length) >= 4) {
      const dist = levenshteinDistance(aiLower, ocrLower);
      const maxDist = Math.floor(Math.max(aiLower.length, ocrLower.length) * 0.4);
      if (dist <= maxDist && dist <= 3) return true;
    }
    return false;
  });
}

export async function recognizeWordsFromImage(
  base64Image: string,
  annotationStyle: string
): Promise<RecognitionResult> {
  let imageBuffer: Buffer;

  if (base64Image.startsWith('data:')) {
    const parts = base64Image.split(',');
    imageBuffer = Buffer.from(parts[1], 'base64');
  } else {
    imageBuffer = Buffer.from(base64Image, 'base64');
  }

  try {
    console.log('📤 方案1: OCR + 像素级标记检测');
    const { markedWords, allWords, lines, imgWidth } = await findMarkedWords(imageBuffer, annotationStyle);

    if (markedWords.length > 0) {
      console.log(`✅ OCR 方案成功: 识别到 ${markedWords.length} 个被标记的单词`);
      return {
        words: markedWords.map(w => ({
          text: w.text,
          meanings: [],
        })),
        thinking: `OCR+像素检测识别到${markedWords.length}个被标记的单词: ${markedWords.map(w => w.text).join(', ')}`,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        method: 'ocr',
      };
    }

    if (lines.length > 0) {
      console.log('📤 方案2: OCR + AI 文本分析 (不传图片，仅传 OCR 文本)');
      const ocrText = formatOCRForAI(lines, imgWidth);

      const systemPrompt = `你是一个英语学习助手，帮助识别笔记中被标记的英语生词。

你会收到 OCR 识别出的文字列表，每行按从左到右排列，格式为：单词(置信度%[x起始-x结束])

位置信息说明：[x起始-x结束] 表示单词在图片中的水平位置。图片宽度已知，如果某个单词的 x 结束位置不到图片宽度的一半，说明该行右半部分还有内容（可能是中文翻译）。

你的任务是判断哪些英语单词是被用户标记的生词。

标记特征判断方法：
1. 中文翻译标记：同一行中，高置信度(>50%)的英文单词后面跟着低置信度(<40%)的乱码文本，且乱码文本的 x 位置在该英文单词的右侧。这些乱码是中文翻译被英文OCR错误识别的结果。该英文单词就是被标记的生词。
2. 独立词汇行：一行中只有一个低置信度(20-50%)的英文单词，且该单词看起来是一个有意义的英语词汇（不是常见虚词如 the/is/at 等），这可能是被标记的生词。
3. 下划线标记：无法从 OCR 文本中直接判断，但如果一个单词的置信度异常低且看起来像有效英语词汇，可能是因为下划线干扰了 OCR。
4. 同一词出现两次：如果同一行中一个词出现了两次（一次高置信度一次低置信度），低置信度的可能是中文翻译的误识别。

规则：
- 只返回被标记的英语单词，不要返回未标记的单词
- 不要返回常见虚词（如 the, is, at, on, in, to, be, and, of, with 等）除非有明确的标记证据
- 不要设置识别的单词数量下限，即使只有1个或0个被标记的单词也要如实返回
- 如果没有被标记的单词，返回空数组 {"words":[]}
- 对于 OCR 误识别的单词，请返回最可能的正确拼写（如 "stoke" 可能是 "stroke"，"Fasinted" 可能是 "fascinated"）
- 返回JSON格式：{"words":[{"text":"单词"}]}
- 只返回纯JSON，不要添加任何解释`;

      const userPrompt = `标注方式: ${annotationStyle}

OCR 识别结果：
${ocrText}

请判断哪些英语单词是被用户标记的生词。只返回被标记的单词。`;

      try {
        const response = await callTextAI(systemPrompt, userPrompt, {
          temperature: 0.1,
        });

        let content = response.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }

        const result = JSON.parse(content);
        const aiWords: string[] = (result.words || []).map((w: any) => w.text);

        if (aiWords.length > 0) {
          const validatedWords = aiWords.filter(aiWord => isWordInOCR(aiWord, allWords));

          console.log(
            `✅ OCR+AI 方案成功: AI 识别 ${aiWords.length} 个, OCR 验证后 ${validatedWords.length} 个`
          );

          if (validatedWords.length > 0) {
            return {
              words: validatedWords.map(text => ({ text, meanings: [] })),
              thinking:
                response.thinking ||
                `AI文本分析: 从${allWords.length}个OCR单词中识别出${validatedWords.length}个被标记的单词`,
              usage: response.usage,
              method: 'ocr+ai',
            };
          }
        }
      } catch (aiTextError) {
        console.error('AI 文本分析失败:', aiTextError instanceof Error ? aiTextError.message : aiTextError);
      }
    }

    console.log('📤 方案3: AI 视觉识别 (缩小图片)');
    const compressed = await compressBase64Image(base64Image, 768, 0.7);

    const systemPrompt = `你是一个英语学习助手，帮助识别图片中被标记的英语单词。

任务：识别图片中被用户用"${annotationStyle}"方式标记的英语单词。

【极其重要的判断标准】
你必须非常严格地判断哪些单词被标记了。宁可漏判也不要误判！

负样本示例（这些情况都不算被标记）：
- 单词看起来和周围文字完全一样（同样的字体颜色、同样粗细、无背景色差异）→ 未标记
- 单词只是普通印刷体/手写体文字，没有荧光笔痕迹、没有圈出线条、没有下划线 → 未标记
- 图片中所有文字都是同一种颜色（如全黑字白底），没有任何彩色标记 → 返回空数组
- 你不确定某个单词是否有标记 → 不将其包含在结果中

正样本特征：
- "高亮"：单词背景有明显的荧光色/彩色块（黄色、粉色、绿色等），与周围白色区域明显不同
- "红笔圈出"：单词周围有红色/彩色的圈线或括号
- "红下划线"：单词正下方有红色或彩色的横线

规则：
1. 只返回你**高度确信**被标记的单词，如果不确定就不要返回
2. 如果图片中看不到任何明显的"${annotationStyle}"标记，必须返回 {"words":[]}
3. 不要设置识别的单词数量下限，即使只有1个或0个也要如实返回
4. 每个返回的单词必须附上简短判断理由（为什么认为它被标记了）
5. 返回JSON格式：{"words":[{"text":"单词","reason":"判断理由"}]}
6. 只返回纯JSON，不要添加任何解释或说明`;

    const userPrompt = `请仔细识别图片中被"${annotationStyle}"标记的英语单词。

再次强调：如果某个单词和周围其他单词看起来完全一样（无背景色差异、无线条、无圈注），则它没有被标记！如果看不到任何明确标记，返回 {"words":[]}。

只返回你高度确信被标记的单词及其判断理由。`;

    const response = await callVisionAI(systemPrompt, userPrompt, compressed.data);

    console.log('📥 AI 识别响应:', {
      思考过程: response.thinking ? `${response.thinking.length} 字符` : '无',
      输出长度: response.content.length,
      Token使用: response.usage,
    });

    let content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    const result = JSON.parse(content);
    return {
      words: (result.words || []).map((w: any) => ({
        text: w.text,
        meanings: [],
      })),
      thinking: response.thinking || '',
      usage: response.usage,
      method: 'ai',
    };
  } catch (error) {
    console.error('识别单词失败:', error instanceof Error ? error.message : error);
    throw new Error('识别单词失败，请重试');
  }
}
