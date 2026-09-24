import type { Meaning } from '@/types/dict';

export interface ParsedSystemWord {
  text: string;
  phonetic?: string;
  meanings?: Meaning[];
  chinese?: string;
}

// 将形如 "v. 抛弃，放弃" 的释义字符串解析为 Meaning
export function chineseToMeanings(chinese: string): Meaning[] {
  const text = (chinese ?? '').trim();
  if (!text) return [];
  const match = text.match(/^([a-zA-Z]{1,8}\.)\s*(.*)$/);
  if (match && match[2].trim()) {
    return [{ type: match[1], content: match[2].trim() }];
  }
  return [{ type: '', content: text }];
}

const TEXT_KEYS = ['text', 'word', 'english', '单词'];
const PHONETIC_KEYS = ['phonetic', 'phoneticsymbol', 'pronunciation', 'phonogram', '音标'];
const MEANING_KEYS = ['meanings', 'meaning', 'translation', 'chinese', 'defination', 'definition', '释义'];

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of Object.keys(obj)) {
    if (keys.includes(key.toLowerCase())) return obj[key];
  }
  return undefined;
}

function normalizeObject(obj: unknown): ParsedSystemWord | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const record = obj as Record<string, unknown>;

  const rawText = pick(record, TEXT_KEYS);
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) return null;

  const rawPhonetic = pick(record, PHONETIC_KEYS);
  const phonetic =
    typeof rawPhonetic === 'string' && rawPhonetic.trim() ? rawPhonetic.trim() : undefined;

  const rawMeaning = pick(record, MEANING_KEYS);
  let meanings: Meaning[] | undefined;
  let chinese: string | undefined;

  if (Array.isArray(rawMeaning)) {
    meanings = rawMeaning
      .map((m): Meaning | null => {
        if (typeof m === 'string') return { type: '', content: m };
        if (m && typeof m === 'object') {
          const mm = m as Record<string, unknown>;
          const content = typeof mm.content === 'string' ? mm.content : '';
          const type = typeof mm.type === 'string' ? mm.type : '';
          if (!content) return null;
          const sentence = typeof mm.sentence === 'string' ? mm.sentence : undefined;
          return { type, content, ...(sentence ? { sentence } : {}) };
        }
        return null;
      })
      .filter((m): m is Meaning => m !== null);
  } else if (typeof rawMeaning === 'string' && rawMeaning.trim()) {
    chinese = rawMeaning.trim();
    meanings = chineseToMeanings(chinese);
  }

  return { text, phonetic, meanings, chinese };
}

function parseJson(content: string): ParsedSystemWord[] {
  const parsed = JSON.parse(content);
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).data)
      ? (parsed as any).data
      : null;
  if (!arr) throw new Error('JSON 格式不正确：期望一个单词数组');
  return (arr as unknown[])
    .map(normalizeObject)
    .filter((w): w is ParsedSystemWord => w !== null);
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseDelimited(content: string): ParsedSystemWord[] {
  const result: ParsedSystemWord[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    let text = '';
    let meaning = '';

    if (line.includes('\t')) {
      const parts = line.split('\t');
      text = parts[0];
      meaning = parts.slice(1).join('\t');
    } else if (line.includes(',')) {
      const idx = line.indexOf(',');
      text = line.slice(0, idx);
      meaning = line.slice(idx + 1);
    } else {
      const match = line.match(/^([A-Za-z][A-Za-z'’.\- ]*?)\s+(.*)$/);
      if (match) {
        text = match[1];
        meaning = match[2];
      } else {
        text = line;
      }
    }

    text = stripQuotes(text);
    meaning = stripQuotes(meaning);
    if (!text) continue;

    result.push({ text, chinese: meaning || undefined });
  }
  return result;
}

// 解析上传的单词本文件（支持 JSON / CSV / TXT）
export function parseWordFile(content: string, fileName: string): ParsedSystemWord[] {
  const name = (fileName || '').toLowerCase();
  const trimmed = content.trim();

  if (name.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJson(content);
  }
  return parseDelimited(content);
}
