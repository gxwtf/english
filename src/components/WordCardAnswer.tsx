'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WordCardItem } from '@/actions/ai-question/word-card';
import { recordWordCardReview } from '@/actions/review';
import type { Meaning } from '@/types/dict';
import { normalizeMeanings } from '@/lib/meanings';

type MarkResult = 'known' | 'unknown';

interface WordCardState {
  repetition: number;
  interval: number;
  errorCount: number;
  lastReviewedAt: string;
}

interface WordCardAnswerProps {
  questionId: string;
  cards: WordCardItem[];
  status?: string;
  onSubmitted?: () => void;
}

// 合并相同词性的释义
function mergeMeaningsByType(meanings: Meaning[]): { type: string; content: string }[] {
  const merged: Record<string, string[]> = {};
  for (const m of meanings) {
    const type = m.type || '';
    if (!merged[type]) {
      merged[type] = [];
    }
    merged[type].push(m.content);
  }
  return Object.entries(merged).map(([type, contents]) => ({
    type,
    content: contents.join('; '),
  }));
}

export function WordCardAnswer({ questionId, cards, status, onSubmitted }: WordCardAnswerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [marks, setMarks] = useState<Record<number, MarkResult>>({});
  const [cardStates, setCardStates] = useState<Record<number, WordCardState>>({});
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const currentCard = cards[currentIndex];

  // 合并相同词性的释义
  const mergedMeanings = useMemo(
    () => mergeMeaningsByType(normalizeMeanings(currentCard?.meanings)),
    [currentCard],
  );

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // 标记「会 / 不会」并同步更新复习状态（遗忘曲线 + 错误权重）
  const handleMark = useCallback(async (known: boolean) => {
    const card = cards[currentIndex];
    if (!card || card.wordId == null || saving) return;

    setSaving(true);
    try {
      const state = await recordWordCardReview(card.wordId, known);
      setMarks(prev => ({ ...prev, [card.id]: known ? 'known' : 'unknown' }));
      setCardStates(prev => ({
        ...prev,
        [card.id]: {
          repetition: state.repetitions,
          interval: state.interval,
          errorCount: state.errorCount,
          lastReviewedAt: state.lastReviewedAt,
        },
      }));
      onSubmitted?.();
      // 标记后自动翻到下一张
      if (currentIndex < cards.length - 1) {
        setIsFlipped(false);
        setCurrentIndex(prev => Math.min(cards.length - 1, prev + 1));
      }
    } catch (e) {
      console.error('标记单词复习状态失败:', e);
    } finally {
      setSaving(false);
    }
  }, [cards, currentIndex, saving, onSubmitted]);

  const handlePrevCard = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextCard = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(prev => Math.min(cards.length - 1, prev + 1));
  }, []);

  // Swipe gesture handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX; // 防止残留的上一次 touchEndX 导致误判为滑动
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) {
      handleNextCard();
    } else if (diff < -threshold) {
      handlePrevCard();
    }
  }, [handleNextCard, handlePrevCard]);

  if (!currentCard) {
    return <div className="text-center py-12 text-gray-500">暂无卡片数据</div>;
  }

  return (
    <div className="space-y-6">
      {/* 卡片导航提示 */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>卡片 {currentIndex + 1} / {cards.length}</span>
        <span className="text-xs">← 滑动或点击按钮切换 →</span>
      </div>

      {/* 卡片容器 */}
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-[320px] h-[240px] sm:max-w-[420px] sm:h-[300px] lg:max-w-[560px] lg:h-[400px]"
        style={{ perspective: '1000px' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 卡片翻转动画 */}
        <div
          className="relative w-full h-full cursor-pointer transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
          onClick={handleFlip}
        >
          {/* 正面 - 单词 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-4 break-all text-center px-2">{currentCard.word}</div>
            <div className="text-sm lg:text-lg opacity-75">点击翻转查看释义</div>
            <RotateCcw className="w-5 h-5 lg:w-6 lg:h-6 opacity-50 mt-2" />
          </div>

          {/* 反面 - 所有释义（合并相同词性） */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg bg-gradient-to-br from-brand-crimson to-brand-deep-red text-white p-4 lg:p-8 overflow-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="text-2xl lg:text-4xl font-bold mb-3 lg:mb-5">{currentCard.word}</div>
            {mergedMeanings.length > 0 ? (
              <div className="space-y-2 lg:space-y-3 text-center">
                {mergedMeanings.map((m, idx) => (
                  <div key={idx} className="text-sm lg:text-xl leading-relaxed">
                    <span className="font-semibold opacity-90">{m.type}</span>
                    <span className="opacity-80"> {m.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-base lg:text-xl opacity-75">暂无释义</div>
            )}
            <RotateCcw className="w-5 h-5 lg:w-6 lg:h-6 opacity-50 mt-3" />
          </div>
        </div>
      </div>

      {/* 会 / 不会 标记 */}
      <div className="space-y-3">
        {currentCard.wordId == null && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            关联词不在词库中，无法更新复习状态
          </p>
        )}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={() => handleMark(false)}
            disabled={saving || currentCard.wordId == null}
            variant="outline"
            className={`flex-1 max-w-[140px] gap-2 py-3 h-auto font-semibold rounded-xl border-2 ${
              marks[currentCard.id] === 'unknown'
                ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:text-white'
                : 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'
            }`}
          >
            <X className="w-5 h-5" />
            不会
          </Button>
          <Button
            onClick={() => handleMark(true)}
            disabled={saving || currentCard.wordId == null}
            variant="outline"
            className={`flex-1 max-w-[140px] gap-2 py-3 h-auto font-semibold rounded-xl border-2 ${
              marks[currentCard.id] === 'known'
                ? 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:text-white'
                : 'border-green-300 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20'
            }`}
          >
            <Check className="w-5 h-5" />
            会
          </Button>
        </div>
        {marks[currentCard.id] && cardStates[currentCard.id] && (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            {marks[currentCard.id] === 'known' ? '已标记「会」' : '已标记「不会」'}
            {' · '}
            下次复习约 {(() => {
              const s = cardStates[currentCard.id];
              const next = new Date(s.lastReviewedAt).getTime() + s.interval * 24 * 60 * 60 * 1000;
              return Math.max(0, Math.ceil((next - Date.now()) / (1000 * 60 * 60 * 24)));
            })()} 天后
            {' · '}
            错误权重 e={cardStates[currentCard.id].errorCount}
          </p>
        )}
      </div>

      {/* 左右导航按钮 */}
      <div className="flex items-center justify-center gap-4">
        <Button
          onClick={handlePrevCard}
          disabled={currentIndex === 0}
          variant="outline"
          size="icon"
          className="rounded-full h-10 w-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          onClick={handleNextCard}
          disabled={currentIndex === cards.length - 1}
          variant="outline"
          size="icon"
          className="rounded-full h-10 w-10"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* 提示信息和返回按钮 */}
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            单词卡片已生成完毕
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            共 {cards.length} 张卡片，已标记 {Object.keys(marks).length} 张
            （会 {Object.values(marks).filter(m => m === 'known').length} · 不会 {Object.values(marks).filter(m => m === 'unknown').length}）
          </p>
        </div>

        <div className="flex gap-3">
          <a
            href="/practice"
            className="flex-1 text-center py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            返回题目列表
          </a>
        </div>
      </div>
    </div>
  );
}