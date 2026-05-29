import Tesseract, { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

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

let workerInstance: Tesseract.Worker | null = null;
let workerInitPromise: Promise<Tesseract.Worker> | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (workerInstance) return workerInstance;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    const workerPath = path.join(
      process.cwd(),
      'node_modules',
      'tesseract.js',
      'src',
      'worker-script',
      'node',
      'index.js'
    );

    const w = await createWorker('eng', 1, { workerPath });
    workerInstance = w;
    return w;
  })();

  return workerInitPromise;
}

export async function ocrImage(imageBuffer: Buffer): Promise<{
  words: OCRWordResult[];
  lines: OCRLineResult[];
}> {
  const worker = await getWorker();
  const result = await worker.recognize(imageBuffer, {}, { blocks: true });
  const data = result.data;

  const words: OCRWordResult[] = [];
  const lines: OCRLineResult[] = [];
  const blocks = data.blocks || [];

  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const lineWords: OCRWordResult[] = [];

        for (const w of line.words || []) {
          const text = w.text?.trim();
          if (!text || text.length < 2) continue;
          if (/^\d+|[=\-\[\](){}<>.,;:!?/\\|@#$%^&*]+$/.test(text)) continue;

          const word: OCRWordResult = {
            text,
            bbox: w.bbox,
            confidence: w.confidence,
            isMarked: false,
            markingScore: 0,
          };

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

interface MarkingConfig {
  saturationThreshold: number;
  lightnessMin: number;
  lightnessMax: number;
  redDominance: boolean;
  overlapThreshold: number;
  isBlackMarking: boolean;
  blackMarkType: 'circle' | 'underline' | 'none';
}

function getMarkingConfig(annotationStyle: string): MarkingConfig {
  switch (annotationStyle) {
    case '高亮':
      return {
        saturationThreshold: 0.18,
        lightnessMin: 0.3,
        lightnessMax: 0.95,
        redDominance: false,
        overlapThreshold: 0.10,
        isBlackMarking: false,
        blackMarkType: 'none',
      };
    case '红笔圈出':
      return {
        saturationThreshold: 0.2,
        lightnessMin: 0.15,
        lightnessMax: 0.85,
        redDominance: true,
        overlapThreshold: 0.06,
        isBlackMarking: false,
        blackMarkType: 'none',
      };
    case '红下划线':
      return {
        saturationThreshold: 0.2,
        lightnessMin: 0.15,
        lightnessMax: 0.85,
        redDominance: true,
        overlapThreshold: 0.06,
        isBlackMarking: false,
        blackMarkType: 'none',
      };
    case '黑笔圈出':
      return {
        saturationThreshold: 0,
        lightnessMin: 0,
        lightnessMax: 0.4,
        redDominance: false,
        overlapThreshold: 0.08,
        isBlackMarking: true,
        blackMarkType: 'circle',
      };
    case '黑下划线':
      return {
        saturationThreshold: 0,
        lightnessMin: 0,
        lightnessMax: 0.4,
        redDominance: false,
        overlapThreshold: 0.05,
        isBlackMarking: true,
        blackMarkType: 'underline',
      };
    default:
      return {
        saturationThreshold: 0.18,
        lightnessMin: 0.2,
        lightnessMax: 0.95,
        redDominance: false,
        overlapThreshold: 0.10,
        isBlackMarking: false,
        blackMarkType: 'none',
      };
  }
}

async function detectColorMarkings(
  imageBuffer: Buffer,
  words: OCRWordResult[],
  annotationStyle: string
): Promise<OCRWordResult[]> {
  if (words.length === 0) return [];

  const config = getMarkingConfig(annotationStyle);

  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(imgWidth, imgHeight));
  const procWidth = Math.round(imgWidth * scale);
  const procHeight = Math.round(imgHeight * scale);

  const { data, info } = await sharp(imageBuffer)
    .resize(procWidth, procHeight)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const markingMask = new Uint8Array(procWidth * procHeight);
  const blackMask = new Uint8Array(procWidth * procHeight);

  for (let y = 0; y < procHeight; y++) {
    for (let x = 0; x < procWidth; x++) {
      const idx = (y * procWidth + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const lightness = (maxC + minC) / 2 / 255;

      let isMarking = false;

      if (config.isBlackMarking) {
        isMarking = lightness < config.lightnessMax;
        blackMask[y * procWidth + x] = isMarking ? 1 : 0;
      } else if (config.redDominance) {
        isMarking =
          r > 100 &&
          r > g * 1.5 &&
          r > b * 1.5 &&
          saturation > config.saturationThreshold &&
          lightness > config.lightnessMin &&
          lightness < config.lightnessMax;
      } else {
        isMarking =
          saturation > config.saturationThreshold &&
          lightness > config.lightnessMin &&
          lightness < config.lightnessMax;
      }

      markingMask[y * procWidth + x] = isMarking ? 1 : 0;
    }
  }

  const checkClustering = (
    mask: Uint8Array,
    width: number,
    bx0: number,
    by0: number,
    bx1: number,
    by1: number
  ): boolean => {
    const gridCols = 3;
    const gridRows = 3;
    const cellWidth = Math.max(1, (bx1 - bx0) / gridCols);
    const cellHeight = Math.max(1, (by1 - by0) / gridRows);
    const markedCells = new Set<number>();

    for (let y = by0; y < by1; y++) {
      for (let x = bx0; x < bx1; x++) {
        if (mask[y * width + x]) {
          const col = Math.floor((x - bx0) / cellWidth);
          const row = Math.floor((y - by0) / cellHeight);
          markedCells.add(row * gridCols + col);
        }
      }
    }

    return markedCells.size >= 2;
  };

  const padding = Math.round(8 * scale);

  return words.map((word) => {
    const x0 = Math.max(0, Math.round(word.bbox.x0 * scale) - padding);
    const y0 = Math.max(0, Math.round(word.bbox.y0 * scale) - padding);
    const x1 = Math.min(procWidth, Math.round(word.bbox.x1 * scale) + padding);
    const y1 = Math.min(procHeight, Math.round(word.bbox.y1 * scale) + padding);

    let markingPixels = 0;
    let totalPixels = 0;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        totalPixels++;
        if (markingMask[y * procWidth + x]) {
          markingPixels++;
        }
      }
    }

    const markingScore = totalPixels > 0 ? markingPixels / totalPixels : 0;

    const minAbsolutePixels = 15;
    if (markingPixels < minAbsolutePixels) {
      return { ...word, isMarked: false, markingScore };
    }

    if (config.isBlackMarking && config.blackMarkType === 'circle') {
      const edgeRatio = 0.15;
      const edgeWidth = Math.max(2, Math.round((x1 - x0) * edgeRatio));
      const edgeHeight = Math.max(2, Math.round((y1 - y0) * edgeRatio));
      
      let edgeBlackPixels = 0;
      let edgeTotalPixels = 0;
      let centerBlackPixels = 0;
      let centerTotalPixels = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const isEdge = 
            x < x0 + edgeWidth || x >= x1 - edgeWidth ||
            y < y0 + edgeHeight || y >= y1 - edgeHeight;
          
          if (isEdge) {
            edgeTotalPixels++;
            if (blackMask[y * procWidth + x]) edgeBlackPixels++;
          } else {
            centerTotalPixels++;
            if (blackMask[y * procWidth + x]) centerBlackPixels++;
          }
        }
      }

      const edgeDensity = edgeTotalPixels > 0 ? edgeBlackPixels / edgeTotalPixels : 0;
      const centerDensity = centerTotalPixels > 0 ? centerBlackPixels / centerTotalPixels : 0;
      
      if (edgeDensity <= centerDensity * 1.2) {
        return { ...word, isMarked: false, markingScore };
      }
    }

    if (config.isBlackMarking && config.blackMarkType === 'underline') {
      const bottomRatio = 0.25;
      const bottomY0 = Math.round(y0 + (y1 - y0) * (1 - bottomRatio));
      
      let maxLineWidth = 0;
      for (let y = bottomY0; y < y1; y++) {
        let lineWidth = 0;
        for (let x = x0; x < x1; x++) {
          if (blackMask[y * procWidth + x]) {
            lineWidth++;
          } else {
            if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
            lineWidth = 0;
          }
        }
        if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
      }

      const bboxWidth = x1 - x0;
      if (maxLineWidth < bboxWidth * 0.3) {
        return { ...word, isMarked: false, markingScore };
      }
    }

    if (annotationStyle === '高亮') {
      const isClustered = checkClustering(
        markingMask,
        procWidth,
        x0,
        y0,
        x1,
        y1
      );
      if (!isClustered) {
        return { ...word, isMarked: false, markingScore };
      }
    }

    return {
      ...word,
      isMarked: markingScore > config.overlapThreshold,
      markingScore,
    };
  });
}

export function formatOCRForAI(lines: OCRLineResult[], imgWidth?: number): string {
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

  const t0 = Date.now();
  const { words, lines } = await ocrImage(imageBuffer);
  console.log(
    `📝 OCR 识别到 ${words.length} 个单词, ${lines.length} 行 (${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );

  if (words.length === 0) {
    return { markedWords: [], allWords: words, lines, imgWidth };
  }

  if (['高亮', '红笔圈出', '红下划线', '黑笔圈出', '黑下划线'].includes(annotationStyle)) {
    const t1 = Date.now();
    const detected = await detectColorMarkings(imageBuffer, words, annotationStyle);
    const marked = detected.filter(w => w.isMarked);
    const isBlackMarking = ['黑笔圈出', '黑下划线'].includes(annotationStyle);
    console.log(
      `${isBlackMarking ? '🖊️ 黑色标记检测' : '🎨 颜色标记检测'}: ${marked.length}/${words.length} (${((Date.now() - t1) / 1000).toFixed(1)}s)`
    );

    if (marked.length > 0) {
      marked.forEach(w => {
        console.log(`   ✓ ${w.text} (标记得分: ${(w.markingScore * 100).toFixed(1)}%, OCR置信度: ${w.confidence.toFixed(0)}%)`);
      });
      return { markedWords: marked, allWords: detected, lines, imgWidth };
    }
  }

  console.log('⚠️ 像素级标记检测未发现标记，将使用 AI 文本分析');
  return { markedWords: [], allWords: words, lines, imgWidth };
}
