'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { WordCardItem } from '@/actions/ai-question/word-card';
import type { Meaning } from '@/types/dict';
import { markQuestionAsAnswered } from '@/actions/ai-question';

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
  const [submitted, setSubmitted] = useState(status === 'ANSWERED');
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const currentCard = cards[currentIndex];
  const currentMeanings = currentCard?.meanings || [];

  // 合并相同词性的释义
  const mergedMeanings = useMemo(() => mergeMeaningsByType(currentMeanings), [currentMeanings]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

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

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await markQuestionAsAnswered(questionId);
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      console.error('提交答案失败:', error);
      alert('提交答案失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [questionId, onSubmitted]);

  const handleReset = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(0);
    setSubmitted(false);
    onSubmitted?.();
  }, [onSubmitted]);

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
        className="relative mx-auto"
        style={{ width: '100%', maxWidth: '320px', height: '240px', perspective: '1000px' }}
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
            <div className="text-4xl font-bold mb-4">{currentCard.word}</div>
            <div className="text-sm opacity-75">点击翻转查看释义</div>
            <RotateCcw className="w-5 h-5 opacity-50 mt-2" />
          </div>

          {/* 反面 - 所有释义（合并相同词性） */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white p-4 overflow-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="text-xl font-bold mb-3">{currentCard.word}</div>
            {mergedMeanings.length > 0 ? (
              <div className="space-y-2 text-center">
                {mergedMeanings.map((m, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-semibold opacity-90">{m.type}</span>
                    <span className="opacity-80"> {m.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-base opacity-75">暂无释义</div>
            )}
            <RotateCcw className="w-5 h-5 opacity-50 mt-3" />
          </div>
        </div>
      </div>

      {/* 左右导航按钮 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevCard}
          disabled={currentIndex === 0}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={handleNextCard}
          disabled={currentIndex === cards.length - 1}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* 提交按钮 */}
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white disabled:opacity-50"
        >
          {submitting ? '提交中...' : '完成练习'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              练习已完成！
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              共 {cards.length} 张卡片
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/practice"
              className="flex-1 text-center py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              返回题目列表
            </a>
            <button
              onClick={handleReset}
              className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              重新练习
            </button>
          </div>
        </div>
      )}
    </div>
  );
}