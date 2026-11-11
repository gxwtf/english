import { NextRequest, NextResponse } from 'next/server';

/**
 * 单词发音代理（有道语音 API）。
 *
 * 上游接口是 https://dict.youdao.com/dictvoice?type=0|1&audio=<word>
 * （有道文档里常写成 http，实测 https 同样可用，这里用 https 避免明文传输）：
 *   - type=0 → 美音（US）
 *   - type=1 → 英音（UK）
 *
 * 这里用 Route Handler 而不是 Server Action，原因有两条：
 *   1. 前端 <audio> 的 src 只能是一个 URL，无法接收 Server Action 的返回值；
 *   2. 浏览器直连第三方接口会踩混合内容（本站是 https）且无法自定义 UA / Referer，
 *      所以统一由服务器代取音频再转发。
 *
 * 用法：GET /api/pronunciation?word=hello&accent=us
 *       GET /api/pronunciation?word=hello&accent=uk
 */

const YOUDAO_VOICE_URL = 'https://dict.youdao.com/dictvoice';

/** 口音 → 有道 type 参数 */
const ACCENT_TYPES: Record<string, string> = {
  us: '0', // 美音
  uk: '1', // 英音
};

/** 单词语音很小（约 10KB），进程内缓存一份即可挡住重复请求 */
const audioCache = new Map<string, Uint8Array>();
const MAX_CACHE_ENTRIES = 500;

/** 只放行「单词/短语」形态的输入，避免把任意字符串拼进上游 URL */
function normalizeWord(raw: string | null): string | null {
  if (!raw) return null;
  const word = raw.trim().replace(/\s+/g, ' ');
  if (!word || word.length > 64) return null;
  if (!/^[A-Za-z][A-Za-z'’.\- ]*$/.test(word)) return null;
  return word;
}

function remember(key: string, audio: Uint8Array) {
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey !== undefined) audioCache.delete(oldestKey);
  }
  audioCache.set(key, audio);
}

function audioResponse(audio: Uint8Array, cacheKey: string) {
  return new NextResponse(audio as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.byteLength),
      // 同一个单词的读音不会变，长缓存 + ETag，避免每次都回源有道
      'Cache-Control': 'public, max-age=604800, immutable',
      ETag: `"youdao-${cacheKey}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const word = normalizeWord(params.get('word'));
  const accent = (params.get('accent') || 'us').toLowerCase();
  const type = ACCENT_TYPES[accent];

  if (!word) {
    return NextResponse.json({ ok: false, error: '无效的单词' }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ ok: false, error: '无效的口音（仅支持 uk / us）' }, { status: 400 });
  }

  const cacheKey = `${accent}:${word.toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return audioResponse(cached, cacheKey);
  }

  const upstream = `${YOUDAO_VOICE_URL}?type=${type}&audio=${encodeURIComponent(word)}`;

  try {
    const res = await fetch(upstream, {
      // 有道对无 UA 的请求会返回 403/空响应
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Referer: 'https://dict.youdao.com/',
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `有道语音接口返回 ${res.status}` },
        { status: 502 },
      );
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ ok: false, error: '有道未返回音频' }, { status: 502 });
    }

    remember(cacheKey, buffer);
    return audioResponse(buffer, cacheKey);
  } catch (error) {
    console.error('[pronunciation] 获取有道语音失败:', error);
    return NextResponse.json({ ok: false, error: '获取读音失败，请稍后重试' }, { status: 502 });
  }
}
