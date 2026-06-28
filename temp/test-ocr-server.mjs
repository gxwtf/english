import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_IMAGE_PATH = path.join(__dirname, 'test-ocr.jpg');

function parseAllConfigs(envContent) {
  const result = [];
  for (const configKey of ['LLM_CONFIGS', 'LLM_IMAGE_CONFIGS']) {
    const lines = envContent.split('\n');
    let inConfig = false;
    let rawConfig = '';
    for (const line of lines) {
      if (line.includes(`${configKey}=`)) {
        const eqIndex = line.indexOf('=');
        let value = line.substring(eqIndex + 1).trim();
        if (value.startsWith("'")) { value = value.substring(1); inConfig = true; }
        rawConfig = value;
        if (value.endsWith("'")) { rawConfig = value.slice(0, -1); inConfig = false; }
      } else if (inConfig) {
        rawConfig += '\n' + line;
        if (line.trim().endsWith("'")) { rawConfig = rawConfig.slice(0, -1).trim(); inConfig = false; }
      }
    }
    if (rawConfig) {
      try {
        const configs = JSON.parse(rawConfig);
        result.push(...configs);
      } catch (e) {}
    }
  }
  return result;
}

async function ocrImage(imageBuffer) {
  const worker = await Tesseract.createWorker('eng', 1);
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const result = await worker.recognize(imageBuffer, {}, { blocks: true });
  await worker.terminate();

  const words = [];
  const lines = [];
  const blocks = result.data.blocks || [];

  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const lineWords = [];
        for (const w of line.words || []) {
          const text = w.text?.trim();
          if (!text || text.length < 2) continue;
          if (/^\d+|[=\-\[\](){}<>.,;:!?/\\|@#$%^&*]+$/.test(text)) continue;
          const word = { text, bbox: w.bbox, confidence: w.confidence };
          words.push(word);
          lineWords.push(word);
        }
        if (lineWords.length > 0) {
          const yValues = lineWords.map(w => w.bbox.y0);
          const y1Values = lineWords.map(w => w.bbox.y1);
          lines.push({
            y: Math.min(...yValues),
            height: Math.max(...y1Values) - Math.min(...yValues),
            words: lineWords,
          });
        }
      }
    }
  }
  return { words, lines };
}

function formatOCRForAI(lines, imgWidth) {
  const widthInfo = imgWidth ? ` (图片宽度: ${imgWidth}px)` : '';
  return lines
    .map((line, i) => {
      const wordsStr = line.words
        .map(w => {
          const xRange = `[${w.bbox.x0}-${w.bbox.x1}]`;
          return `${w.text}(${w.confidence.toFixed(0)}%${xRange})`;
        })
        .join(' ');
      return `行${i + 1}: ${wordsStr}`;
    })
    .join('\n');
}

async function callTextAI(envPath, systemPrompt, userPrompt) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const configs = parseAllConfigs(envContent);

  if (configs.length === 0) {
    console.log('⚠️ 未找到 LLM_CONFIGS 配置，跳过 AI 文本分析');
    return null;
  }

  for (const config of configs) {
    console.log(`🤖 尝试文本模型: ${config.name} (${config.model})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${config.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.log(`   ❌ ${config.name} 失败: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const thinking = data.choices?.[0]?.message?.reasoning_content || null;

      return {
        content,
        thinking,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.log(`   ❌ ${config.name} 失败: ${error.message}`);
      continue;
    }
  }

  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 OCR + AI 文本分析 端到端测试 v8');
  console.log('='.repeat(60));

  const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
  console.log(`\n📂 测试图片: ${TEST_IMAGE_PATH} (${Math.round(imageBuffer.length / 1024)}KB)`);

  const imgMeta = await sharp(imageBuffer).metadata();
  const imgWidth = imgMeta.width;
  console.log(`📐 图片尺寸: ${imgMeta.width}×${imgMeta.height}`);

  const annotationStyle = '自定义';

  // Step 1: OCR
  console.log('\n--- Step 1: OCR 识别 ---');
  const t0 = Date.now();
  const { words, lines } = await ocrImage(imageBuffer);
  console.log(`📝 OCR 识别到 ${words.length} 个单词, ${lines.length} 行 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  console.log('\n📋 OCR 行级结果:');
  lines.forEach((line, i) => {
    const wordsStr = line.words.map(w => `${w.text}(${w.confidence.toFixed(0)}%[${w.bbox.x0}-${w.bbox.x1}])`).join(' ');
    console.log(`   行${i + 1}: ${wordsStr}`);
  });

  // Step 2: Format OCR text for AI
  console.log('\n--- Step 2: 格式化 OCR 文本 ---');
  const ocrText = formatOCRForAI(lines, imgWidth);
  console.log('📄 AI 输入文本:');
  console.log(ocrText);

  // Step 3: AI text analysis
  console.log('\n--- Step 3: AI 文本分析 ---');
  const envPath = path.join(__dirname, '.env.local');

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
    const t1 = Date.now();
    const aiResult = await callTextAI(envPath, systemPrompt, userPrompt);

    if (aiResult) {
      console.log(`🤖 AI 响应 (${((Date.now() - t1) / 1000).toFixed(1)}s):`);
      if (aiResult.thinking) {
        console.log(`   思考: ${aiResult.thinking.substring(0, 200)}...`);
      }
      console.log(`   内容: ${aiResult.content}`);
      console.log(`   Token: ${aiResult.usage.total_tokens}`);

      let content = aiResult.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      try {
        const result = JSON.parse(content);
        const aiWords = (result.words || []).map(w => w.text);
        console.log(`\n✅ AI 识别到 ${aiWords.length} 个被标记的单词:`);
        aiWords.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
      } catch (parseError) {
        console.error('❌ JSON 解析失败:', parseError.message);
        console.log('   原始内容:', aiResult.content);
      }
    }
  } catch (error) {
    console.error('❌ AI 文本分析失败:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
}

main();
