'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ArrowRight,
  Loader2,
  Plus,
  CalendarClock,
  Sparkles,
  BookOpenCheck,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import {
  AIQuestionTypeSelector,
  type QuestionGenerationOptions,
} from '@/components/AIQuestionTypeSelector';
import { getReviewStats } from '@/actions/review';
import { loadWordbooks } from '@/actions/wordbooks';
import { storage } from '@/lib/storage';
import { selectWordsForQuestion } from '@/lib/word-selection';
import {
  enqueuePendingFillBlank,
  enqueuePendingTranslate,
  enqueuePendingMeaningSelect,
  enqueuePendingMeaningSelectEn,
  enqueuePendingDefinitionFillBlank,
  enqueuePendingWordSelectTranslate,
  createWordCardQuestion,
} from '@/actions/ai-question';
import { Word, Wordbook } from '@/types/word';

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const BOOK_COLORS = [
  { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-brand-crimson dark:text-red-400' },
  { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
];

interface ReviewStats {
  due: number;
  newWords: number;
  total: number;
  errorTotal: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function formatDate(): string {
  const d = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${weekdays[d.getDay()]}`;
}

export function HomePageContent() {
  const { isLoggedIn, isClient, isLoading, userInfo } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [allWords, setAllWords] = useState<Word[] | null>(null);
  const [relatedWordsCount, setRelatedWordsCount] = useState(0);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, booksData] = await Promise.all([
        getReviewStats(),
        loadWordbooks(),
      ]);
      setStats(statsData);
      setWordbooks(booksData);
    } catch (error) {
      console.error('加载首页数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isClient || !isLoggedIn) return;
    loadData();
  }, [isClient, isLoggedIn, loadData]);

  // 打开出题类型选择器：先加载全部单词（作为候选词池）
  const handleOpenSelector = async () => {
    if (preparing || reviewing || loading || (stats?.total ?? 0) === 0) return;
    setPreparing(true);
    setReviewError('');
    try {
      const words = await storage.loadWords();
      if (words.length === 0) {
        setReviewError('还没有添加任何单词');
        return;
      }
      setAllWords(words);

      const texts = new Set(words.map((w) => w.text.toLowerCase()));
      const related = new Set<string>();
      for (const word of words) {
        for (const rw of word.relatedWords || []) {
          const t = rw.text.toLowerCase();
          if (!texts.has(t)) related.add(t);
        }
      }
      setRelatedWordsCount(related.size);
      setShowTypeSelector(true);
    } catch (error) {
      console.error('加载单词失败:', error);
      setReviewError('加载单词失败，请稍后重试');
    } finally {
      setPreparing(false);
    }
  };

  // 根据所选题型计算需要抽取的单词数量
  const computeNeededCount = (options: QuestionGenerationOptions, fallback: number): number => {
    switch (options.type) {
      case 'fill-blank': {
        const o = options.fillBlank ?? { n: 5, m: 0 };
        return o.n + (o.m ?? 0);
      }
      case 'translate': {
        const o = options.translate ?? { n: 5 };
        return o.n;
      }
      case 'meaning-select': {
        const o = options.meaningSelect ?? { n: 5 };
        return o.n ?? 5;
      }
      case 'meaning-select-en': {
        const o = options.meaningSelectEn ?? { n: 5 };
        return o.n ?? 5;
      }
      case 'definition-fill-blank': {
        const o = options.definitionFillBlank ?? { n: 5, m: 0 };
        return o.n + (o.m ?? 0);
      }
      case 'word-select-translate': {
        const o = options.wordSelectTranslate ?? { n: 5, m: 0 };
        return o.n + (o.m ?? 0);
      }
      default:
        return fallback;
    }
  };

  // 按所选题型创建复习题
  const handleSelectQuestionType = async (options: QuestionGenerationOptions) => {
    if (reviewing) return;
    setShowTypeSelector(false);
    setReviewing(true);
    setReviewError('');
    try {
      const words = allWords ?? (await storage.loadWords());
      if (words.length === 0) {
        setReviewError('还没有添加任何单词');
        setReviewing(false);
        return;
      }

      // 单词卡片直接生成，不需要 AI
      if (options.type === 'word-card') {
        const { wordIds, relatedWordEntries } = await selectWordsForQuestion(
          words,
          words.length,
          options.includeRelatedWords,
          options.useSpacedRepetition
        );
        await createWordCardQuestion(wordIds, relatedWordEntries);
        router.push('/practice');
        return;
      }

      const neededCount = Math.max(
        1,
        Math.min(computeNeededCount(options, 5), words.length)
      );
      const { wordIds, relatedWordEntries } = await selectWordsForQuestion(
        words,
        neededCount,
        options.includeRelatedWords,
        options.useSpacedRepetition
      );

      let pendingItem;
      switch (options.type) {
        case 'fill-blank':
          pendingItem = await enqueuePendingFillBlank(
            wordIds,
            options.fillBlank ?? { n: 5, m: 0 },
            options.deepThinking,
            relatedWordEntries
          );
          break;
        case 'translate':
          pendingItem = await enqueuePendingTranslate(
            wordIds,
            options.translate ?? { n: 5 },
            options.deepThinking,
            relatedWordEntries
          );
          break;
        case 'meaning-select':
          pendingItem = await enqueuePendingMeaningSelect(
            wordIds,
            options.deepThinking,
            relatedWordEntries
          );
          break;
        case 'meaning-select-en':
          pendingItem = await enqueuePendingMeaningSelectEn(
            wordIds,
            options.deepThinking,
            relatedWordEntries
          );
          break;
        case 'definition-fill-blank':
          pendingItem = await enqueuePendingDefinitionFillBlank(
            wordIds,
            options.definitionFillBlank ?? { n: 5, m: 0 },
            options.deepThinking,
            relatedWordEntries
          );
          break;
        case 'word-select-translate':
          pendingItem = await enqueuePendingWordSelectTranslate(
            wordIds,
            options.wordSelectTranslate ?? { n: 5, m: 0 },
            options.deepThinking,
            relatedWordEntries
          );
          break;
        default:
          throw new Error(`不支持的题目类型: ${options.type}`);
      }

      const pendingItemData = {
        questionId: pendingItem.id,
        questionType: options.type,
        wordIds,
        options,
        relatedWordEntries,
      };
      const existing = JSON.parse(
        sessionStorage.getItem('pendingQuestions') || '[]'
      );
      existing.push(pendingItemData);
      sessionStorage.setItem('pendingQuestions', JSON.stringify(existing));

      router.push('/practice');
    } catch (error) {
      console.error('创建复习题目失败:', error);
      setReviewError('生成复习题目失败，请稍后重试');
      setReviewing(false);
    }
  };

  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  const total = stats?.total ?? 0;
  const due = stats?.due ?? 0;
  const newWords = stats?.newWords ?? 0;
  const learned = Math.max(0, total - newWords);
  const progress = total > 0 ? Math.max(0, Math.min(1, (total - due) / total)) : 0;
  const hasWords = !loading && total > 0;

  const statItems = [
    {
      label: '待复习',
      value: due,
      icon: CalendarClock,
      color: 'text-brand-crimson dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/30',
    },
    {
      label: '新词',
      value: newWords,
      icon: Sparkles,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    },
    {
      label: '已学习',
      value: learned,
      icon: BookOpenCheck,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/30',
    },
    {
      label: '总词数',
      value: total,
      icon: Layers,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-900/30',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="home" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* 问候 */}
        <div className="text-center mb-8">
          <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 tracking-wide">
            {formatDate()}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}，{userInfo?.userName || '同学'}
          </h1>
        </div>

        {/* 主卡片：今日复习 */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-red-100 dark:border-gray-700 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            {/* 进度环 */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32">
              <div
                aria-hidden
                className="absolute inset-2 rounded-full bg-red-100/50 dark:bg-red-900/20 blur-xl"
              />
              <svg className="relative w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="8"
                  className="stroke-gray-100 dark:stroke-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                  className="stroke-brand-crimson transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white leading-none">
                  {loading ? '-' : due}
                </span>
                <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  待复习
                </span>
              </div>
            </div>

            <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
              {loading
                ? '正在加载...'
                : !hasWords
                  ? '还没有添加任何单词'
                  : due > 0
                    ? `有 ${due} 个单词等待复习，选择出题类型即可开始`
                    : '选择出题类型，按遗忘曲线巩固你的单词'}
            </p>

            <button
              onClick={handleOpenSelector}
              disabled={preparing || reviewing || loading || !hasWords}
              className="mt-6 w-full sm:w-auto sm:min-w-[220px] flex items-center justify-center gap-2 px-6 py-3 bg-brand-crimson hover:bg-brand-deep-red text-white rounded-2xl font-semibold text-base shadow-lg shadow-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {preparing || reviewing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {preparing ? '加载中...' : '生成中...'}
                </>
              ) : (
                <>
                  复习所有单词
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            {!hasWords && !loading && (
              <Link
                href="/wordbooks"
                className="mt-3 text-sm text-brand-crimson dark:text-red-400 hover:underline"
              >
                去添加单词
              </Link>
            )}
            {reviewError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {reviewError}
              </p>
            )}
          </div>

          {/* 统计条 */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 grid grid-cols-4 gap-2">
            {statItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex flex-col items-center text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.bg}`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className={`mt-2 text-lg sm:text-xl font-bold ${item.color}`}>
                    {loading ? '-' : item.value}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 我的单词本 */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              我的单词本
            </h2>
            <Link
              href="/wordbooks"
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
            >
              查看全部
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              加载中...
            </div>
          ) : wordbooks.length === 0 ? (
            <Link
              href="/wordbooks"
              className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-6 text-sm text-gray-400 dark:text-gray-500 hover:border-brand-crimson/40 transition-colors"
            >
              <Plus className="h-4 w-4" />
              还没有单词本，去创建一个
            </Link>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {wordbooks.slice(0, 4).map((book, index) => {
                const color = BOOK_COLORS[index % BOOK_COLORS.length];
                return (
                  <Link
                    key={book.id}
                    href={`/wordbooks/${book.id}`}
                    className="group flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color.bg}`}>
                      <BookOpen className={`h-4 w-4 ${color.text}`} />
                    </div>
                    <span className="flex-1 min-w-0 font-medium text-gray-900 dark:text-white truncate">
                      {book.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {book.wordCount} 词
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 出题类型选择器 */}
      <AIQuestionTypeSelector
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onGenerate={handleSelectQuestionType}
        maxWords={allWords?.length ?? 0}
        relatedWordsCount={relatedWordsCount}
      />
    </div>
  );
}
