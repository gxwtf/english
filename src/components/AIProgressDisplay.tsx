'use client';

import { Sparkles, Loader2 } from 'lucide-react';
import type { AIProgressView } from '@/hooks/useAIProgress';

type Variant = 'blue' | 'purple' | 'amber' | 'green';

interface VariantStyle {
  card: string;
  title: string;
  text: string;
  track: string;
  bar: string;
  badge: string;
}

const VARIANT_STYLES: Record<Variant, VariantStyle> = {
  blue: {
    card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    title: 'text-blue-800 dark:text-blue-200',
    text: 'text-blue-700 dark:text-blue-300',
    track: 'bg-blue-100 dark:bg-blue-950/50',
    bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  },
  purple: {
    card: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    title: 'text-purple-800 dark:text-purple-200',
    text: 'text-purple-700 dark:text-purple-300',
    track: 'bg-purple-100 dark:bg-purple-950/50',
    bar: 'bg-gradient-to-r from-purple-500 to-violet-500',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  },
  amber: {
    card: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    title: 'text-amber-800 dark:text-amber-200',
    text: 'text-amber-700 dark:text-amber-300',
    track: 'bg-amber-100 dark:bg-amber-950/50',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  green: {
    card: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    title: 'text-green-800 dark:text-green-200',
    text: 'text-green-700 dark:text-green-300',
    track: 'bg-green-100 dark:bg-green-950/50',
    bar: 'bg-gradient-to-r from-green-500 to-emerald-500',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  },
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} 分 ${seconds.toString().padStart(2, '0')} 秒`;
}

interface AIProgressDisplayProps {
  title: string;
  progress: AIProgressView;
  description?: string;
  variant?: Variant;
}

export function AIProgressDisplay({
  title,
  progress,
  description,
  variant = 'blue',
}: AIProgressDisplayProps) {
  const styles = VARIANT_STYLES[variant];
  const displayPercent = Math.round(progress.percent);

  return (
    <div className={`p-6 rounded-lg border ${styles.card}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className={`w-5 h-5 shrink-0 ${styles.title}`} />
          <h3 className={`text-lg font-bold truncate ${styles.title}`}>{title}</h3>
        </div>
        <span className={`text-sm font-semibold tabular-nums shrink-0 ${styles.title}`}>
          {displayPercent}%
        </span>
      </div>

      <div className={`h-2.5 w-full rounded-full overflow-hidden ${styles.track}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${styles.bar}`}
          style={{ width: `${Math.min(100, progress.percent)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${styles.text}`} />
          <p className={`text-sm ${styles.text}`}>{progress.stage}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {progress.total != null && progress.current != null && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
              第 {progress.current} / {progress.total} 题
            </span>
          )}
          <span className={`text-xs tabular-nums ${styles.text}`}>
            已用 {formatElapsed(progress.elapsedMs)}
          </span>
        </div>
      </div>

      {description && (
        <p className={`mt-2 text-xs ${styles.text} opacity-80`}>{description}</p>
      )}
    </div>
  );
}
