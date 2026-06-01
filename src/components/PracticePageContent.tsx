'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { QuestionList } from '@/components/QuestionDisplay';
import { QuestionQueueItem } from '@/types/word';
import {
  loadQuestionQueue as loadQuestionQueueAction,
  generateFillBlankWithQuestion,
  generateTranslateWithQuestion,
  generateMeaningSelectWithQuestion,
  generateMeaningSelectEnWithQuestion,
  markQuestionAsFailed,
  retryQuestion,
} from '@/actions/ai-question';
import { useRouter } from 'next/navigation';

export function PracticePageContent() {
  const { isLoggedIn, isClient } = useAuth();
  const [queue, setQueue] = useState<QuestionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadQueue = useCallback(async () => {
    try {
      const data = await loadQuestionQueueAction();
      setQueue(data);
    } catch (error) {
      console.error('加载题目队列失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const processPendingQuestion = useCallback(() => {
    const pendingQuestionId = sessionStorage.getItem('pendingQuestionId');
    if (!pendingQuestionId) return;

    const questionType = sessionStorage.getItem('pendingQuestionType');
    const wordIdsRaw = sessionStorage.getItem('pendingWordIds');
    const optionsRaw = sessionStorage.getItem('pendingOptions');

    if (!questionType || !wordIdsRaw || !optionsRaw) return;

    const wordIds: number[] = JSON.parse(wordIdsRaw);
    const options = JSON.parse(optionsRaw);

    const relatedWordsRaw = sessionStorage.getItem('pendingRelatedWords');
    const relatedWordEntries = relatedWordsRaw ? JSON.parse(relatedWordsRaw) : [];

    sessionStorage.removeItem('pendingQuestionId');
    sessionStorage.removeItem('pendingQuestionType');
    sessionStorage.removeItem('pendingWordIds');
    sessionStorage.removeItem('pendingOptions');
    sessionStorage.removeItem('pendingRelatedWords');

    const generate = async () => {
      try {
        switch (questionType) {
          case 'fill-blank': {
            const fillBlankOptions = options.fillBlank ?? { n: 5, m: 0 };
            await generateFillBlankWithQuestion(
              pendingQuestionId, wordIds, fillBlankOptions,
              undefined, options.deepThinking,
              relatedWordEntries, options.allowFormChange
            );
            break;
          }
          case 'translate': {
            const translateOptions = options.translate ?? { n: 5 };
            await generateTranslateWithQuestion(
              pendingQuestionId, wordIds, translateOptions,
              undefined, options.deepThinking,
              relatedWordEntries
            );
            break;
          }
          case 'meaning-select': {
            await generateMeaningSelectWithQuestion(
              pendingQuestionId, wordIds,
              options.deepThinking,
              relatedWordEntries
            );
            break;
          }
          case 'meaning-select-en': {
            await generateMeaningSelectEnWithQuestion(
              pendingQuestionId, wordIds,
              options.deepThinking,
              relatedWordEntries
            );
            break;
          }
        }
        setTimeout(() => loadQueue(), 200);
      } catch (error) {
        console.error('AI 出题异常:', error);
        try {
          await markQuestionAsFailed(pendingQuestionId);
          loadQueue();
        } catch {
          loadQueue();
        }
      }
    };

    generate();
  }, [loadQueue]);

  const handleRetryQuestion = useCallback(async (questionId: string, questionItem?: QuestionQueueItem) => {
    try {
      const result = await retryQuestion(questionId);
      sessionStorage.setItem('pendingQuestionId', result.id);
      sessionStorage.setItem('pendingQuestionType', result.questionType);
      sessionStorage.setItem('pendingWordIds', JSON.stringify(result.wordIds));
      if (questionItem?.relatedWordEntries && questionItem.relatedWordEntries.length > 0) {
        sessionStorage.setItem('pendingRelatedWords', JSON.stringify(questionItem.relatedWordEntries));
      }
      if (result.questionType === 'fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        const m = Math.max(0, wordCount - n);
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'fill-blank',
          fillBlank: { n, m },
        }));
      } else if (result.questionType === 'translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'translate',
          translate: { n },
        }));
      } else if (result.questionType === 'meaning-select') {
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'meaning-select',
        }));
      } else if (result.questionType === 'meaning-select-en') {
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'meaning-select-en',
        }));
      }
      router.push('/practice');
    } catch (error) {
      console.error('重试题目失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;
    if (!isLoggedIn) return;
    loadQueue();

    processPendingQuestion();

    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [isClient, isLoggedIn, loadQueue, processPendingQuestion]);

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="practice" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            题目队列
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            共 {queue.length} 道题目
          </p>
        </div>

        <QuestionList queue={queue} onRetry={handleRetryQuestion} />
      </div>
    </div>
  );
}
