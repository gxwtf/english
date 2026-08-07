'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { QuestionQueueItem, QUESTION_TYPE_LABELS } from '@/types/word';
import { loadQuestionById } from '@/actions/ai-question';
import { getBatchReviewStates } from '@/actions/review';
import { FillBlankAnswer } from '@/components/FillBlankAnswer';
import { TranslateAnswer } from '@/components/TranslateAnswer';
import { MeaningSelectAnswer } from '@/components/MeaningSelectAnswer';
import { MeaningSelectEnAnswer } from '@/components/MeaningSelectEnAnswer';
import { DefinitionFillBlankAnswer } from '@/components/DefinitionFillBlankAnswer';
import { WordSelectTranslateAnswer } from '@/components/WordSelectTranslateAnswer';
import { WordCardAnswer } from '@/components/WordCardAnswer';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { ConsolidatePracticeButton } from '@/components/ConsolidatePracticeButton';
import Link from 'next/link';

type ReviewStateLite = {
  wordId: number;
  lastReviewedAt: Date | null;
  interval: number;
  errorCount: number;
  ef: number;
  repetitions: number;
};

export function PracticeQuestionPageContent({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = use(params);
  const { isLoggedIn, isClient } = useAuth();
  const [question, setQuestion] = useState<QuestionQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewStates, setReviewStates] = useState<ReviewStateLite[]>([]);

  const reloadQuestionAndReviewStates = useCallback(async () => {
    try {
      const data = await loadQuestionById(questionId);
      setQuestion(data);
      if (data.status === 'ANSWERED' && data.wordIds.length > 0) {
        try {
          const states = await getBatchReviewStates(data.wordIds);
          setReviewStates(states as ReviewStateLite[]);
        } catch (e) {
          console.error('加载复习状态失败:', e);
        }
      }
    } catch (err) {
      console.error('重新加载题目失败:', err);
    }
  }, [questionId]);

  useEffect(() => {
    if (!isClient || !isLoggedIn) return;
    setLoading(true);
    reloadQuestionAndReviewStates()
      .catch((err: Error) => {
        setError(err.message || '加载题目失败');
      })
      .finally(() => setLoading(false));
  }, [questionId, isClient, isLoggedIn, reloadQuestionAndReviewStates]);

  // 答题提交后重新加载题目和复习状态
  const handleSubmitted = useCallback(() => {
    reloadQuestionAndReviewStates();
  }, [reloadQuestionAndReviewStates]);

  if (!isClient || !isLoggedIn || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <Link href="/practice" className="text-sm text-blue-500 mt-4 inline-block">
              返回题目列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="practice" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
            &larr; 返回题目列表
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {QUESTION_TYPE_LABELS[question.questionType]}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            创建于 {new Date(question.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>

        {question.status === 'GENERATING' && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">题目正在生成中，请稍候...</p>
          </div>
        )}

        {question.status === 'FAILED' && (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400">题目生成失败</p>
            <Link href="/practice" className="text-sm text-blue-500 mt-2 inline-block">
              返回题目列表重试
            </Link>
          </div>
        )}

        {(question.status === 'GENERATED' || question.status === 'ANSWERED' || question.status === 'GRADING' || question.status === 'GRADING_FAILED') && question.questionContent ? (
          <div>
            {question.questionType === 'fill-blank' && question.questionContent.words ? (
              <FillBlankAnswer
                key={question.id}
                questionId={question.id}
                words={question.questionContent.words as string[]}
                questions={question.questionContent.questions as { sentence: string; answer: string }[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : question.questionType === 'meaning-select' && question.questionContent.questions ? (
              <MeaningSelectAnswer
                key={question.id}
                questionId={question.id}
                questions={question.questionContent.questions as any[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : question.questionType === 'meaning-select-en' && question.questionContent.questions ? (
              <MeaningSelectEnAnswer
                key={question.id}
                questionId={question.id}
                questions={question.questionContent.questions as any[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : question.questionType === 'translate' ? (
              <TranslateAnswer
                key={question.id}
                questionId={question.id}
                questions={question.questionContent.questions as any[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : question.questionType === 'definition-fill-blank' && question.questionContent.words ? (
              <DefinitionFillBlankAnswer
                key={question.id}
                questionId={question.id}
                words={question.questionContent.words as string[]}
                questions={question.questionContent.questions as { definition: string; answer: string }[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : question.questionType === 'word-select-translate' && question.questionContent.questions ? (
              <WordSelectTranslateAnswer
                key={question.id}
                questionId={question.id}
                words={question.questionContent.words as string[]}
                questions={question.questionContent.questions as any[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : question.questionType === 'word-card' && question.questionContent.cards ? (
              <WordCardAnswer
                key={question.id}
                questionId={question.id}
                cards={question.questionContent.cards as any[]}
                status={question.status}
                onSubmitted={handleSubmitted}
              />
            ) : (
              <QuestionDisplay
                content={question.questionContent}
                questionId={question.id}
              />
            )}

            {/* 复习状态摘要 - 仅在题目已作答且有复习状态时显示 */}
            {question.status === 'ANSWERED' && reviewStates.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
                已更新 {reviewStates.length} 个词的复习状态
                {(() => {
                  const nextDays = reviewStates
                    .map(s => {
                      if (!s.lastReviewedAt) return null;
                      const next = new Date(s.lastReviewedAt.getTime() + s.interval * 24 * 60 * 60 * 1000);
                      return Math.ceil((next.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    })
                    .filter((d): d is number => d != null);
                  if (nextDays.length === 0) return null;
                  const avg = Math.round(nextDays.reduce((a, b) => a + b, 0) / nextDays.length);
                  const dueSoon = nextDays.filter(d => d <= 1).length;
                  return ` · 平均 ${avg} 天后到期` + (dueSoon > 0 ? ` · ${dueSoon} 个词即将到期` : '');
                })()}
              </div>
            )}

            {/* 巩固练习按钮 - 仅在题目已作答时显示 */}
            {question.status === 'ANSWERED' && question.wordIds.length > 0 && (
              <ConsolidatePracticeButton
                wordIds={question.wordIds}
                relatedWordEntries={question.relatedWordEntries as any[] || []}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
