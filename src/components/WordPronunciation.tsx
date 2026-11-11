'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Loader2, Volume2 } from 'lucide-react';

/**
 * 单词发音：英 / 美 两段「口音 + 音标 + 喇叭」的纯文字入口。
 *
 * 音频走后端代理 `/api/pronunciation`（有道语音 API），
 * 音标走后端代理 `/api/phonetics`（有道词典 jsonapi 的 ukphone / usphone）。
 * 音标按需懒加载（进入视口才请求），并做模块级缓存，列表页不会打爆接口。
 */
export type PronunciationAccent = 'uk' | 'us';

const ACCENTS: { accent: PronunciationAccent; label: string; title: string }[] = [
  { accent: 'uk', label: '英', title: '英式发音' },
  { accent: 'us', label: '美', title: '美式发音' },
];

interface Phonetics {
  uk: string | null;
  us: string | null;
}

interface WordPronunciationProps {
  /** 要朗读的单词/短语 */
  word: string;
  size?: 'sm' | 'md' | 'lg';
  /** default = 常规页面；onDark = 深色/彩色渐变卡片（白字） */
  tone?: 'default' | 'onDark';
  /** 词典里已有的音标（有道没返回时兜底，例如添加单词弹窗） */
  fallbackPhonetic?: string | null;
  className?: string;
}

const SIZE_CLASSES: Record<
  NonNullable<WordPronunciationProps['size']>,
  { text: string; icon: string; gap: string }
> = {
  sm: { text: 'text-[13px]', icon: 'h-3.5 w-3.5', gap: 'gap-x-2.5' },
  md: { text: 'text-sm', icon: 'h-4 w-4', gap: 'gap-x-3.5' },
  lg: { text: 'text-base lg:text-lg', icon: 'h-5 w-5', gap: 'gap-x-4' },
};

// ---------- 音标：模块级缓存 + 并发去重 ----------
const phoneticsCache = new Map<string, Phonetics>();
const phoneticsInflight = new Map<string, Promise<Phonetics>>();

function fetchPhonetics(word: string): Promise<Phonetics> {
  const key = word.toLowerCase();
  const cached = phoneticsCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = phoneticsInflight.get(key);
  if (pending) return pending;

  const request = fetch(`/api/phonetics?word=${encodeURIComponent(word)}`)
    .then(async (res) => {
      if (!res.ok) return { uk: null, us: null } satisfies Phonetics;
      const data = (await res.json()) as { uk?: string | null; us?: string | null };
      const result: Phonetics = { uk: data.uk ?? null, us: data.us ?? null };
      phoneticsCache.set(key, result);
      return result;
    })
    .catch(() => ({ uk: null, us: null }) satisfies Phonetics)
    .finally(() => phoneticsInflight.delete(key));

  phoneticsInflight.set(key, request);
  return request;
}

/** 进入视口后再取音标，避免长列表一次打出几十个请求 */
function usePhonetics(word: string, anchor: RefObject<HTMLDivElement | null>) {
  const [phonetics, setPhonetics] = useState<Phonetics | null>(
    () => phoneticsCache.get(word.trim().toLowerCase()) ?? null,
  );

  useEffect(() => {
    const text = word.trim();
    if (!text) {
      setPhonetics(null);
      return;
    }
    const key = text.toLowerCase();
    const cached = phoneticsCache.get(key);
    if (cached) {
      setPhonetics(cached);
      return;
    }
    setPhonetics(null);

    let cancelled = false;
    const load = () => {
      void fetchPhonetics(text).then((result) => {
        if (!cancelled) setPhonetics(result);
      });
    };

    const element = anchor.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [word, anchor]);

  return phonetics;
}

export function WordPronunciation({
  word,
  size = 'md',
  tone = 'default',
  fallbackPhonetic,
  className = '',
}: WordPronunciationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<PronunciationAccent | null>(null);
  const [loading, setLoading] = useState<PronunciationAccent | null>(null);
  const [failed, setFailed] = useState<PronunciationAccent | null>(null);

  const text = word.trim();
  const phonetics = usePhonetics(text, containerRef);
  const sizeClass = SIZE_CLASSES[size];

  // 切换单词时复位状态并停止上一段音频
  useEffect(() => {
    setPlaying(null);
    setLoading(null);
    setFailed(null);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
  }, [text]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  const play = useCallback(
    async (accent: PronunciationAccent) => {
      if (!text) return;
      const audio = audioRef.current;
      if (!audio) return;

      setFailed(null);
      setLoading(accent);
      setPlaying(null);
      try {
        audio.src = `/api/pronunciation?word=${encodeURIComponent(text)}&accent=${accent}`;
        audio.load();
        await audio.play();
        setPlaying(accent);
      } catch (error) {
        console.warn('[pronunciation] 播放失败:', text, accent, error);
        setFailed(accent);
      } finally {
        setLoading(null);
      }
    },
    [text],
  );

  if (!text) return null;

  /** 有道音标优先；查不到时退回词典音标 */
  const phoneticOf = (accent: PronunciationAccent): string | null => {
    if (!phonetics) return null;
    return phonetics[accent] || (fallbackPhonetic ? fallbackPhonetic.trim() || null : null);
  };

  return (
    <div
      ref={containerRef}
      className={`inline-flex flex-wrap items-center ${sizeClass.gap} ${sizeClass.text} ${className}`}
      data-pronunciation={text}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
        onEnded={() => setPlaying(null)}
        onPause={() => setPlaying(null)}
        onError={() => setPlaying(null)}
      />
      {ACCENTS.map(({ accent, label, title }) => {
        const isPlaying = playing === accent;
        const isLoading = loading === accent;
        const isFailed = failed === accent;
        const phonetic = phoneticOf(accent);

        const toneClass =
          tone === 'onDark'
            ? isPlaying
              ? 'text-white'
              : isFailed
                ? 'text-red-200'
                : 'text-white/75 hover:text-white'
            : isPlaying
              ? 'text-brand-crimson dark:text-brand-red'
              : isFailed
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 hover:text-brand-crimson dark:text-gray-400 dark:hover:text-brand-red';

        return (
          <button
            key={accent}
            type="button"
            data-pronunciation-accent={accent}
            data-phonetic={phonetic ?? ''}
            aria-label={`${title}：${text}`}
            aria-pressed={isPlaying}
            title={isFailed ? `${title}播放失败，请稍后重试` : `播放${title}`}
            onClick={(e) => {
              e.stopPropagation();
              void play(accent);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${toneClass}`}
          >
            <span>{label}</span>
            {phonetic && (
              <span className="font-normal tracking-wide">
                [{phonetic}]
              </span>
            )}
            {isLoading ? (
              <Loader2 className={`${sizeClass.icon} animate-spin`} />
            ) : (
              <Volume2 className={sizeClass.icon} strokeWidth={1.75} />
            )}
          </button>
        );
      })}
    </div>
  );
}
