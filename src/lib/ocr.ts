const PADDLEOCR_URL = process.env.PADDLEOCR_URL || 'http://127.0.0.1:39821';

export interface OCRWordResult {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
  isHighlighted: boolean;
  highlightRatio: number;
}

export interface OCRResult {
  words: OCRWordResult[];
  highlightedWords: string[];
  fullText: string;
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

export async function recognizeHighlightedImage(imageBuffer: Buffer): Promise<OCRResult> {
  const base64Image = imageBuffer.toString('base64');

  // 重试机制：PaddleOCR 服务可能正在启动或短暂不可用
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;
  let lastError: Error | null = null;
  let response: Response | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await fetch(PADDLEOCR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        console.warn(`[OCR] 第 ${attempt}/${MAX_RETRIES} 次调用 PaddleOCR 失败: ${lastError.message}，${RETRY_DELAY_MS}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        // 所有重试都失败，给出更有意义的错误信息
        const reason = lastError.message.includes('fetch failed')
          ? `PaddleOCR 服务不可用（${PADDLEOCR_URL}），请检查服务是否已启动`
          : lastError.message;
        throw new Error(`OCR 请求失败（已重试 ${MAX_RETRIES} 次）: ${reason}`);
      }
    }
  }

  if (!response || !response.ok) {
    throw new Error(`PaddleOCR server returned ${response?.status ?? 'no response'}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`PaddleOCR error: ${data.error}`);
  }

  // 过滤无效词
  const words: OCRWordResult[] = [];
  for (const w of data.words || []) {
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
      isHighlighted: w.isHighlighted,
      highlightRatio: w.highlightRatio,
    });
  }

  // 重新计算高亮词列表（基于过滤后的结果）
  const highlightedWords = words.filter(w => w.isHighlighted).map(w => w.text);

  return {
    words,
    highlightedWords,
    fullText: data.fullText || '',
    timing: data.timing || {},
    stats: {
      totalWords: words.length,
      highlightedCount: highlightedWords.length,
    },
  };
}
