import type { Meaning } from '@/types/dict';

// 历史数据中，部分释义的 content 被二次编码为一个 JSON 字符串，
// 形如 {"type": "interj.", "content": "喂"}。这里将其还原为普通释义，
// 避免界面直接显示原始 JSON。
function parseEmbeddedMeaning(content: string): Meaning | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string' && parsed.content.trim()) {
      const type = typeof parsed.type === 'string' ? parsed.type : '';
      const sentence = typeof parsed.sentence === 'string' && parsed.sentence ? parsed.sentence : undefined;
      return { type, content: parsed.content, ...(sentence ? { sentence } : {}) };
    }
  } catch {
    // 不是合法 JSON，按普通释义处理
  }
  return null;
}

export function normalizeMeaning(value: unknown): Meaning | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const rawContent = typeof record.content === 'string' ? record.content : '';
  const outerType = typeof record.type === 'string' ? record.type.trim() : '';
  const outerSentence = typeof record.sentence === 'string' && record.sentence ? record.sentence : undefined;

  const embedded = parseEmbeddedMeaning(rawContent);
  if (embedded) {
    return {
      ...embedded,
      type: embedded.type || outerType,
      ...(embedded.sentence || !outerSentence ? {} : { sentence: outerSentence }),
    };
  }

  if (!rawContent) return null;

  return {
    type: outerType,
    content: rawContent,
    ...(outerSentence ? { sentence: outerSentence } : {}),
  };
}

export function normalizeMeanings(meanings: unknown): Meaning[] {
  if (!Array.isArray(meanings)) return [];
  return meanings
    .map(normalizeMeaning)
    .filter((m): m is Meaning => m !== null);
}
