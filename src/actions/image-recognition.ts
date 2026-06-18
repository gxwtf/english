'use server';

import { recognizeHighlightedImage } from '@/lib/ocr';
import { Meaning } from '@/types/dict';

export interface RecognizedWord {
  text: string;
  meanings: Meaning[];
}

export interface RecognitionResult {
  words: RecognizedWord[];
  thinking: string;
  timing: {
    transform: number;
    enhance: number;
    ocr: number;
    mask: number;
    total: number;
  };
  stats: {
    totalWords: number;
    highlightedCount: number;
  };
}

export async function recognizeWordsFromImage(
  base64Image: string
): Promise<RecognitionResult> {
  let imageBuffer: Buffer;

  if (base64Image.startsWith('data:')) {
    const parts = base64Image.split(',');
    imageBuffer = Buffer.from(parts[1], 'base64');
  } else {
    imageBuffer = Buffer.from(base64Image, 'base64');
  }

  try {
    const result = await recognizeHighlightedImage(imageBuffer);

    const thinkingParts: string[] = [
      `OCR识别${result.stats.totalWords}个单词 → HSV高亮检测 → 标记${result.stats.highlightedCount}个`,
      `耗时: 透视变换${result.timing.transform}s + 光照归一化${result.timing.enhance}s + OCR${result.timing.ocr}s + 高亮检测${result.timing.mask}s = 总计${result.timing.total}s`,
    ];

    result.words.filter(w => w.isHighlighted).forEach(w => {
      thinkingParts.push(`✓ ${w.text}: 高亮占比=${(w.highlightRatio * 100).toFixed(0)}%`);
    });

    return {
      words: result.words.filter(w => w.isHighlighted).map(w => ({ text: w.text, meanings: [] })),
      thinking: thinkingParts.join('\n'),
      timing: result.timing,
      stats: result.stats,
    };
  } catch (error) {
    console.error('识别单词失败:', error instanceof Error ? error.message : error);
    throw new Error('识别单词失败，请重试');
  }
}
