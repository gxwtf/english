'use client';

import { useState, useCallback, useRef, useMemo, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Check, X, Trash2, Undo2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WordCardItem, WordCardSentenceStatus } from '@/actions/ai-question/word-card';
import { recordWordCardReview } from '@/actions/review';
import {
  loadQuestionById,
  markWordCardSentencesFailed,
  retryWordCardSentences,
} from '@/actions/ai-question';
import {
  removeWordFromWordbookForCard,
  undoRemoveWordFromWordbook,
  type WordRemovalSnapshot,
} from '@/actions/words';
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
  /** AI 例句功能状态；undefined 表示旧题目（未开启例句功能） */
  aiSentencesStatus?: WordCardSentenceStatus;
  /** 例句生成失败的单词数量 */
  aiSentencesFailedCount?: number;
  /** 出题来源单词本；undefined 表示旧题目。null 表示全部单词本 */
  sourceWordbookIds?: number[] | null;
}

/** 已触发例句生成的题目（模块级，防止同一页面会话重复 dispatch） */
const dispatchedSentenceGeneration = new Set<string>();

// 合并相同词性的释义（旧版展示，用于未开启例句功能的题目）
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 在例句中高亮目标单词（含常见屈折形式） */
function renderHighlightedSentence(sentence: string, word: string): ReactNode[] {
  const core = word.replace(/[^a-zA-Z-]/g, '');
  if (!core) return [sentence];
  const pattern = new RegExp(
    `\\b(${escapeRegExp(core)}(?:s|es|ed|d|ing|ies|ied|er|ers|est)?)\\b`,
    'gi',
  );
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(sentence))) {
    if (match.index > last) nodes.push(sentence.slice(last, match.index));
    nodes.push(
      <strong key={key++} className="font-bold underline underline-offset-2">
        {match[0]}
      </strong>,
    );
    last = match.index + match[0].length;
  }
  if (last < sentence.length) nodes.push(sentence.slice(last));
  return nodes;
}

export function WordCardAnswer({
  questionId,
  cards: initialCards,
  status,
  onSubmitted,
  aiSentencesStatus,
  aiSentencesFailedCount,
  sourceWordbookIds,
}: WordCardAnswerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [suppressFlipAnimation, setSuppressFlipAnimation] = useState(false);
  const [marks, setMarks] = useState<Record<number, MarkResult>>({});
  const [cardStates, setCardStates] = useState<Record<number, WordCardState>>({});
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // 例句渐进生成：轮询得到的最新卡片与状态
  const [liveCards, setLiveCards] = useState<WordCardItem[]>(initialCards);
  const [aiStatus, setAiStatus] = useState<WordCardSentenceStatus | undefined>(aiSentencesStatus);
  const [aiFailedCount, setAiFailedCount] = useState<number>(aiSentencesFailedCount ?? 0);

  // 「太简单了」删除与撤回
  const [removedCards, setRemovedCards] = useState<Record<number, WordRemovalSnapshot>>({});
  const [removing, setRemoving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // 撤回重建单词后 wordId 会变化，记录映射保证「会/不会」标记仍可用
  const [wordIdRemap, setWordIdRemap] = useState<Record<number, number>>({});

  const cards = liveCards;
  const currentCard = cards[currentIndex];

  const storageKey = `word-card-progress:${questionId}`;

  // 父组件传入的卡片更新时同步（如页面刷新重新加载题目）
  useEffect(() => {
    setLiveCards(initialCards);
  }, [initialCards]);

  // 从本地恢复本次卡片的浏览进度（当前第几张、已标记状态）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          currentIndex?: number;
          marks?: Record<number, MarkResult>;
        };
        if (
          typeof parsed.currentIndex === 'number' &&
          parsed.currentIndex >= 0 &&
          parsed.currentIndex < cards.length
        ) {
          setCurrentIndex(parsed.currentIndex);
        }
        if (parsed.marks && typeof parsed.marks === 'object') {
          setMarks(parsed.marks);
        }
      }
    } catch {
      // 忽略读取失败
    }
    setHydrated(true);
  }, [storageKey, cards.length]);

  // 保存本次卡片的浏览进度
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ currentIndex, marks }));
    } catch {
      // 忽略写入失败
    }
  }, [hydrated, storageKey, currentIndex, marks]);

  // 例句生成中：触发后台生成（fire-and-forget，不经过 sessionStorage pending 机制）
  useEffect(() => {
    if (aiStatus !== 'generating') return;
    if (dispatchedSentenceGeneration.has(questionId)) return;
    dispatchedSentenceGeneration.add(questionId);
    (async () => {
      try {
        const res = await fetch('/api/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            questionType: 'word-card',
            wordIds: [],
            options: {},
            relatedWordEntries: [],
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch (e) {
        console.error('触发例句生成失败:', e);
        try {
          await markWordCardSentencesFailed(questionId);
          setAiStatus('failed');
        } catch {
          // ignore
        }
      }
    })();
  }, [aiStatus, questionId]);

  // 例句生成中：轮询题目内容，渐进展示已生成的例句
  useEffect(() => {
    if (aiStatus !== 'generating') return;
    const interval = setInterval(async () => {
      try {
        const q = await loadQuestionById(questionId);
        const content = q.questionContent as
          | {
              cards?: WordCardItem[];
              aiSentencesStatus?: WordCardSentenceStatus;
              aiSentencesFailedCount?: number;
            }
          | undefined;
        if (content?.cards) {
          setLiveCards(content.cards);
        }
        if (typeof content?.aiSentencesFailedCount === 'number') {
          setAiFailedCount(content.aiSentencesFailedCount);
        }
        if (content?.aiSentencesStatus && content.aiSentencesStatus !== 'generating') {
          setAiStatus(content.aiSentencesStatus);
        }
      } catch {
        // 忽略轮询失败，下次继续
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [aiStatus, questionId]);

  // 合并相同词性的释义（未开启例句功能的旧展示方式）
  const mergedMeanings = useMemo(
    () => mergeMeaningsByType(normalizeMeanings(currentCard?.meanings)),
    [currentCard],
  );

  // 开启例句功能：逐条释义展示（带例句）
  const meaningList = useMemo(
    () => normalizeMeanings(currentCard?.meanings),
    [currentCard],
  );
  const sentencesEnabled = aiStatus != null;
  const pendingSentenceCards = sentencesEnabled
    ? cards.filter(
        (c) => !c.sentenceFailed && c.meanings.some((m) => !m.sentence?.trim()),
      ).length
    : 0;

  const handleRetrySentences = useCallback(async () => {
    try {
      await retryWordCardSentences(questionId);
      dispatchedSentenceGeneration.delete(questionId);
      setAiStatus('generating');
    } catch (e) {
      console.error('重试例句生成失败:', e);
    }
  }, [questionId]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // 切换卡片时先无动画复位翻转，避免在翻回正面过程中闪现下一张卡片的释义
  useEffect(() => {
    if (!suppressFlipAnimation) return;
    const id = window.setTimeout(() => setSuppressFlipAnimation(false), 60);
    return () => window.clearTimeout(id);
  }, [suppressFlipAnimation]);

  const switchToCard = useCallback((nextIndex: number) => {
    setSuppressFlipAnimation(true);
    setIsFlipped(false);
    setCurrentIndex(nextIndex);
  }, []);

  // 当前卡片的生效 wordId（撤回重建后可能变化）
  const effectiveWordId =
    currentCard?.wordId != null
      ? wordIdRemap[currentCard.wordId] ?? currentCard.wordId
      : null;

  // 标记「会 / 不会」并同步更新复习状态（遗忘曲线 + 错误权重）
  const handleMark = useCallback(async (known: boolean) => {
    const card = cards[currentIndex];
    if (!card || card.wordId == null || saving) return;

    setSaving(true);
    try {
      const wordId = wordIdRemap[card.wordId] ?? card.wordId;
      const state = await recordWordCardReview(wordId, known);
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
        switchToCard(currentIndex + 1);
      }
    } catch (e) {
      console.error('标记单词复习状态失败:', e);
    } finally {
      setSaving(false);
    }
  }, [cards, currentIndex, saving, onSubmitted, switchToCard, wordIdRemap]);

  // 「太简单了，从单词本删去」
  const handleRemoveFromWordbook = useCallback(async () => {
    const card = cards[currentIndex];
    if (!card || card.wordId == null || removing) return;
    setRemoving(true);
    try {
      const { snapshot } = await removeWordFromWordbookForCard(card.wordId, sourceWordbookIds ?? null);
      setRemovedCards(prev => ({ ...prev, [card.id]: snapshot }));
    } catch (e) {
      console.error('从单词本删除单词失败:', e);
    } finally {
      setRemoving(false);
    }
  }, [cards, currentIndex, removing, sourceWordbookIds]);

  // 撤回删除
  const handleUndoRemove = useCallback(async () => {
    const card = cards[currentIndex];
    const snapshot = card ? removedCards[card.id] : undefined;
    if (!snapshot || undoing) return;
    setUndoing(true);
    try {
      const { wordId } = await undoRemoveWordFromWordbook(snapshot);
      if (snapshot.text != null && wordId !== snapshot.wordId) {
        setWordIdRemap(prev => ({ ...prev, [snapshot.wordId]: wordId }));
      }
      setRemovedCards(prev => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
    } catch (e) {
      console.error('撤回删除失败:', e);
    } finally {
      setUndoing(false);
    }
  }, [cards, currentIndex, removedCards, undoing]);

  const handlePrevCard = useCallback(() => {
    switchToCard(Math.max(0, currentIndex - 1));
  }, [currentIndex, switchToCard]);

  const handleNextCard = useCallback(() => {
    switchToCard(Math.min(cards.length - 1, currentIndex + 1));
  }, [cards.length, currentIndex, switchToCard]);

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

      {/* AI 例句生成进度 */}
      {sentencesEnabled && aiStatus === 'generating' && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          AI 例句生成中{pendingSentenceCards > 0 ? `（剩余 ${pendingSentenceCards} 个单词）` : '…'}，生成后自动显示
        </p>
      )}
      {sentencesEnabled && aiStatus === 'failed' && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
          AI 例句生成失败
          <button onClick={handleRetrySentences} className="ml-1 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300">
            重试
          </button>
        </p>
      )}
      {sentencesEnabled && aiStatus === 'done' && aiFailedCount > 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          {aiFailedCount} 个单词的例句生成失败
        </p>
      )}

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
            transition: suppressFlipAnimation ? 'none' : undefined,
          }}
          onClick={handleFlip}
        >
          {/* 正面 - 单词 */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg text-white p-6 transition-opacity ${
              removedCards[currentCard.id]
                ? 'bg-gradient-to-br from-gray-400 to-gray-500 opacity-70'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600'
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-4 break-all text-center px-2">{currentCard.word}</div>
            {removedCards[currentCard.id] ? (
              <div className="text-sm lg:text-lg opacity-80">已从单词本删除（可撤回）</div>
            ) : (
              <div className="text-sm lg:text-lg opacity-75">点击翻转查看释义</div>
            )}
            <RotateCcw className="w-5 h-5 lg:w-6 lg:h-6 opacity-50 mt-2" />
          </div>

          {/* 反面 - 释义 + 例句 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-lg bg-gradient-to-br from-brand-crimson to-brand-deep-red text-white p-4 lg:p-8 overflow-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="text-2xl lg:text-4xl font-bold mb-3 lg:mb-5">{currentCard.word}</div>
            {sentencesEnabled ? (
              <div className="w-full space-y-2 lg:space-y-3 text-center">
                {meaningList.map((m, idx) => (
                  <div key={idx} className="text-sm lg:text-lg leading-relaxed">
                    <div>
                      <span className="font-semibold opacity-90">{m.type}</span>
                      <span className="opacity-80"> {m.content}</span>
                    </div>
                    {m.sentence ? (
                      <p className="mt-0.5 text-xs lg:text-base italic opacity-90 break-words">
                        {renderHighlightedSentence(m.sentence, currentCard.word)}
                      </p>
                    ) : aiStatus === 'generating' && !currentCard.sentenceFailed ? (
                      <p className="mt-0.5 text-xs lg:text-sm opacity-60 flex items-center justify-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> 例句生成中…
                      </p>
                    ) : null}
                  </div>
                ))}
                {meaningList.length === 0 && (
                  <div className="text-base lg:text-xl opacity-75">暂无释义</div>
                )}
              </div>
            ) : mergedMeanings.length > 0 ? (
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
            <RotateCcw className="w-5 h-5 lg:w-6 lg:h-6 opacity-50 mt-3 shrink-0" />
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

        {/* 太简单了，从单词本删去（支持一键撤回） */}
        {sourceWordbookIds !== undefined && currentCard.wordId != null && (
          <div className="flex justify-center">
            {removedCards[currentCard.id] ? (
              <Button
                onClick={handleUndoRemove}
                disabled={undoing}
                variant="outline"
                className="gap-2 py-2.5 h-auto rounded-xl border-2 border-amber-400 text-amber-600 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
              >
                {undoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                {undoing ? '恢复中…' : '已删除，点击撤回'}
              </Button>
            ) : (
              <Button
                onClick={handleRemoveFromWordbook}
                disabled={removing}
                variant="ghost"
                className="gap-1.5 py-2 h-auto text-xs sm:text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                太简单了，{sourceWordbookIds == null ? '从所有单词本删去' : '从单词本删去'}
              </Button>
            )}
          </div>
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
            {Object.keys(removedCards).length > 0 && ` · 已删除 ${Object.keys(removedCards).length} 个单词`}
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
