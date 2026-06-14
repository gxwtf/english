import sharp from 'sharp';

export interface OCRWordResult {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
  isMarked: boolean;
  markingScore: number;
}

export interface OCRLineResult {
  y: number;
  height: number;
  words: OCRWordResult[];
}

const PADDLEOCR_PORT = 9800;
const PADDLEOCR_URL = `http://127.0.0.1:${PADDLEOCR_PORT}`;

async function paddleOcrImage(imageBuffer: Buffer): Promise<{
  words: OCRWordResult[];
  lines: OCRLineResult[];
}> {
  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(PADDLEOCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    throw new Error(`PaddleOCR server returned ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`PaddleOCR error: ${data.error}`);
  }

  // Python 端已经做了词级拆分和粘连词处理，这里只需过滤
  const rawWords = data.words || [];
  const words: OCRWordResult[] = [];

  for (const w of rawWords) {
    const text = (w.text || '').trim();
    if (!text || text.length < 2) continue;
    if (/^\d+|[=\-\[\](){}<>.,;:!?/\\|@#$%^&*~]+$/.test(text)) continue;
    if (!/[a-zA-Z]/.test(text)) continue;

    const cleaned = text.replace(/^[\[\(.,;:!?'"»«]+|[\]\).,;:!?'"»«]+$/g, '');
    if (cleaned.length < 2 || !/[a-zA-Z]/.test(cleaned)) continue;

    words.push({
      text: cleaned,
      bbox: w.bbox,
      confidence: w.confidence,
      isMarked: false,
      markingScore: 0,
    });
  }

  const lines = groupWordsIntoLines(words);
  return { words, lines };
}

function groupWordsIntoLines(words: OCRWordResult[]): OCRLineResult[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const lines: OCRLineResult[] = [];
  let currentLine: OCRWordResult[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevWord = currentLine[currentLine.length - 1];
    const currWord = sorted[i];
    const avgHeight = (prevWord.bbox.y1 - prevWord.bbox.y0 + currWord.bbox.y1 - currWord.bbox.y0) / 2;
    if (currWord.bbox.y0 - prevWord.bbox.y0 < avgHeight * 0.6) {
      currentLine.push(currWord);
    } else {
      currentLine.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const yValues = currentLine.map(w => w.bbox.y0);
      const y1Values = currentLine.map(w => w.bbox.y1);
      lines.push({
        y: Math.min(...yValues),
        height: Math.max(...y1Values) - Math.min(...yValues),
        words: currentLine,
      });
      currentLine = [currWord];
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const yValues = currentLine.map(w => w.bbox.y0);
    const y1Values = currentLine.map(w => w.bbox.y1);
    lines.push({
      y: Math.min(...yValues),
      height: Math.max(...y1Values) - Math.min(...yValues),
      words: currentLine,
    });
  }

  return lines;
}

export async function ocrImage(imageBuffer: Buffer): Promise<{
  words: OCRWordResult[];
  lines: OCRLineResult[];
}> {
  return paddleOcrImage(imageBuffer);
}

export function formatOCRForAI(lines: OCRLineResult[], _imgWidth?: number): string {
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

export async function findMarkedWords(
  imageBuffer: Buffer,
  annotationStyle: string
): Promise<{
  markedWords: OCRWordResult[];
  allWords: OCRWordResult[];
  lines: OCRLineResult[];
  imgWidth?: number;
}> {
  console.log(`🔍 OCR 识别开始 (标注方式: ${annotationStyle})`);

  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width;
  const imgHeight = metadata.height!;

  // 阶段1: PaddleOCR 识别单词和 bbox
  const t0 = Date.now();
  const { words, lines } = await ocrImage(imageBuffer);
  console.log(
    `📝 OCR 识别到 ${words.length} 个单词, ${lines.length} 行 (${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );

  if (words.length === 0) {
    return { markedWords: [], allWords: words, lines, imgWidth };
  }

  // 阶段1.5: 大模型补充识别高亮词（PaddleOCR 可能漏识别被高亮覆盖的词）
  const { supplementMarkedWords } = await import('./marking-detect');
  const supplementedWords = await supplementMarkedWords(imageBuffer, words, annotationStyle);
  // 补充识别的词直接标记为 marked，不需要再走 AI 检测
  const supplementedIndices = new Set<number>();
  if (supplementedWords.length > 0) {
    console.log(`📝 大模型补充识别到 ${supplementedWords.length} 个遗漏词: ${supplementedWords.map((w: { text: string }) => w.text).join(', ')}`);
    supplementedWords.forEach((w: OCRWordResult) => {
      supplementedIndices.add(words.length);
      words.push(w);
    });
  }

  // 阶段2: 图片分块（基于 bbox 向四周扩展，扫描线算法避免重叠）
  const { createChunks } = await import('./image-chunking');
  const chunks = createChunks(words, imgWidth!, imgHeight, 10);
  console.log(`🧩 创建 ${chunks.length} 个分块`);

  // 阶段3: CV 预过滤 + 批量 AI 检测标记
  const { detectMarkings } = await import('./marking-detect');
  const detectResults = await detectMarkings(chunks, imageBuffer, annotationStyle, {
    enableCVPreFilter: true,
    batchSize: 6,
    maxConcurrent: 5,
  });

  // 将检测结果映射回 words，并应用 OCR 纠错
  const markedIndices = new Set(detectResults.filter(r => r.isMarked).map(r => r.wordIndex));
  // 补充识别的词直接标记为 marked
  for (const idx of supplementedIndices) {
    markedIndices.add(idx);
  }
  const corrections = new Map<number, string>();
  const missedWords: string[] = [];
  for (const r of detectResults) {
    if (r.correctedText && r.correctedText !== r.word) {
      corrections.set(r.wordIndex, r.correctedText);
    }
    if (r.missedMarkedWords && r.missedMarkedWords.length > 0) {
      missedWords.push(...r.missedMarkedWords);
    }
  }

  const uniqueMissedWords = [...new Set(missedWords)];

  const updatedWords = words.map((w, i) => {
    const corrected = corrections.get(i);
    return {
      ...w,
      text: corrected || w.text,
      isMarked: markedIndices.has(i),
    };
  });

  // 将遗漏的标记单词添加到结果中
  for (const missedWord of uniqueMissedWords) {
    const alreadyExists = updatedWords.some(
      w => w.text.toLowerCase().replace(/[^a-z]/g, '') === missedWord.toLowerCase().replace(/[^a-z]/g, '')
    );
    if (!alreadyExists) {
      updatedWords.push({
        text: missedWord,
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
        confidence: 0,
        isMarked: true,
        markingScore: 0,
      });
    }
  }

  const markedWords = updatedWords.filter(w => w.isMarked);
  console.log(`🎯 标记检测: ${markedWords.length}/${words.length} 个被标记`);

  if (markedWords.length > 0) {
    markedWords.forEach(w => {
      console.log(`   ✓ ${w.text}`);
    });
  }

  return { markedWords, allWords: updatedWords, lines, imgWidth };
}
