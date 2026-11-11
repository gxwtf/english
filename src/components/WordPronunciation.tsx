'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2 } from 'lucide-react';

/**
 * 单词发音按钮组：英音 / 美音。
 *
 * 音频统一走后端代理 `/api/pronunciation`（有道语音 API），
 * 这样既能避开 http 混合内容，也能在服务端复用缓存。
 */
export type PronunciationAccent = 'uk' | 'us';

const ACCENTS: { accent: PronunciationAccent; label: string; title: string }[] = [
  { accent: 'uk', label: '英音', title: '英式发音' },
  { accent: 'us', label: '美音', title: '美式发音' },
];

interface WordPronunciationProps {
  /** 要朗读的单词/短语 */
  word: string;
  size?: 'sm' | 'md' | 'lg';
  /** default = 常规页面；onDark = 深色/彩色渐变卡片（白字） */
  tone?: 'default' | 'onDark';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<WordPronunciationProps['size']>, { button: string; icon: string }> = {
  sm: { button: 'h-6 px-1.5 gap-1 text-[11px]', icon: 'h-3 w-3' },
  md: { button: 'h-7 px-2 gap-1 text-xs', icon: 'h-3.5 w-3.5' },
  lg: { button: 'h-8 px-2.5 gap-1.5 text-sm', icon: 'h-4 w-4' },
};

export function WordPronunciation({
  word,
  size = 'md',
  tone = 'default',
  className = '',
}: WordPronunciationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<PronunciationAccent | null>(null);
  const [loading, setLoading] = useState<PronunciationAccent | null>(null);
  const [failed, setFailed] = useState<PronunciationAccent | null>(null);

  const text = word.trim();
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
        // 每次都重新设置 src：同一按钮重复点击时也要从头播
        audio.src = `/api/pronunciation?word=${encodeURIComponent(text)}&accent=${accent}`;
        audio.load();
        await audio.play();
        setPlaying(accent);
      } catch (error) {
        // 有道查不到该词（或网络异常）时，按钮短暂变红并给出提示
        console.warn('[pronunciation] 播放失败:', text, accent, error);
        setFailed(accent);
      } finally {
        setLoading(null);
      }
    },
    [text],
  );

  if (!text) return null;

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
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
        onError={() => {
          // src 加载失败（上游 502 / 无此词）时给出提示
          setPlaying(null);
        }}
      />
      {ACCENTS.map(({ accent, label, title }) => {
        const isPlaying = playing === accent;
        const isLoading = loading === accent;
        const isFailed = failed === accent;
        const toneClass =
          tone === 'onDark'
            ? isPlaying
              ? 'border-white/80 bg-white/25 text-white'
              : 'border-white/40 bg-white/10 text-white hover:bg-white/20'
            : isPlaying
              ? 'border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
              : isFailed
                ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';

        return (
          <button
            key={accent}
            type="button"
            data-pronunciation-accent={accent}
            aria-label={`${title}：${text}`}
            aria-pressed={isPlaying}
            title={isFailed ? `${title}播放失败，请稍后重试` : `播放${title}`}
            onClick={(e) => {
              e.stopPropagation();
              void play(accent);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`inline-flex items-center justify-center rounded-full border font-medium transition-colors disabled:opacity-60 ${sizeClass.button} ${toneClass}`}
          >
            {isLoading ? (
              <Loader2 className={`${sizeClass.icon} animate-spin`} />
            ) : (
              <Volume2 className={sizeClass.icon} />
            )}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
