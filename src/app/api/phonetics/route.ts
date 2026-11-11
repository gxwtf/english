import { NextRequest, NextResponse } from 'next/server';

/**
 * 单词音标（英音 / 美音）。
 *
 * 有道的 `dictvoice` 只给音频、不给音标，音标来自同一站点的 `jsonapi`：
 *   GET https://dict.youdao.com/jsonapi?q=<word>
 *   → ec.word[0].ukphone / ec.word[0].usphone
 *
 * 返回给前端时只保留音标，避免把 50KB+ 的完整词典 JSON 传到浏览器。
 * 用法：GET /api/phonetics?word=hello
 *   → { ok: true, word: "hello", uk: "həˈləʊ", us: "həˈloʊ" }
 *   查不到的音标为 null（仍是 200，便于浏览器缓存这个“没有音标”的结果）。
 */

const YOUDAO_JSONAPI_URL = 'https://dict.youdao.com/jsonapi';

interface Phonetics {
  uk: string | null;
  us: string | null;
}

/** 词典音标不会变，进程内缓存即可（约 100 字节/条） */
const phoneticCache = new Map<string, Phonetics>();
const MAX_CACHE_ENTRIES = 1000;

function normalizeWord(raw: string | null): string | null {
  if (!raw) return null;
  const word = raw.trim().replace(/\s+/g, ' ');
  if (!word || word.length > 64) return null;
  if (!/^[A-Za-z][A-Za-z'’.\- ]*$/.test(word)) return null;
  return word;
}

function cleanPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // 有道偶尔会带方括号，例如 "[həˈləʊ]"，统一去掉后由前端加括号
  const cleaned = value.trim().replace(/^\[|\]$/g, '').trim();
  return cleaned || null;
}

function remember(key: string, phonetics: Phonetics) {
  if (phoneticCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = phoneticCache.keys().next().value;
    if (oldestKey !== undefined) phoneticCache.delete(oldestKey);
  }
  phoneticCache.set(key, phonetics);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const word = normalizeWord(request.nextUrl.searchParams.get('word'));
  if (!word) {
    return NextResponse.json({ ok: false, error: '无效的单词' }, { status: 400 });
  }

  const cacheKey = word.toLowerCase();
  const cached = phoneticCache.get(cacheKey);
  if (cached) {
    return json({ ok: true, word, ...cached });
  }

  try {
    const res = await fetch(`${YOUDAO_JSONAPI_URL}?q=${encodeURIComponent(word)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Referer: 'https://dict.youdao.com/',
        Accept: 'application/json,text/plain,*/*',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `有道词典接口返回 ${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      ec?: { word?: Array<{ ukphone?: unknown; usphone?: unknown }> };
    };
    const entry = data?.ec?.word?.[0];
    const phonetics: Phonetics = {
      uk: cleanPhone(entry?.ukphone),
      us: cleanPhone(entry?.usphone),
    };

    remember(cacheKey, phonetics);
    return json({ ok: true, word, ...phonetics });
  } catch (error) {
    console.error('[phonetics] 获取有道音标失败:', error);
    return NextResponse.json({ ok: false, error: '获取音标失败，请稍后重试' }, { status: 502 });
  }
}
