'use server';

import { findMarkedWords } from '@/lib/ocr';
import { Meaning } from '@/types/dict';

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
  method: 'ocr-chunk-ai' | 'ocr-chunk' | 'ai';
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
    const { markedWords, allWords } = await findMarkedWords(imageBuffer, annotationStyle);

    const thinkingParts: string[] = [
      `OCR识别${allWords.length}个单词 → 大模型补充识别+全图检测 → 标记${markedWords.length}个`,
    ];
    markedWords.forEach(w => {
      thinkingParts.push(`✓ ${w.text}: confidence=${w.confidence.toFixed(0)}%`);
    });

    const hasAI = markedWords.some(w => w.confidence > 0);
    return {
      words: markedWords.map(w => ({ text: w.text, meanings: [] })),
      thinking: thinkingParts.join('\n'),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      method: hasAI ? 'ocr-chunk-ai' : 'ocr-chunk',
    };
  } catch (error) {
    console.error('识别单词失败:', error instanceof Error ? error.message : error);
    throw new Error('识别单词失败，请重试');
  }
}
