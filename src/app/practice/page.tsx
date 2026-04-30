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
  markQuestionAsFailed,
  retryQuestion,
} from '@/actions/ai-question';

export default function PracticePage() {
  const { isLoggedIn, isClient } = useAuth();
  const [queue, setQueue] = useState<QuestionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载题目队列
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

  // 处理待生成的题目：从 sessionStorage 读取信息并触发 AI 生成
  const processPendingQuestion = useCallback(() => {
    const pendingQuestionId = sessionStorage.getItem('pendingQuestionId');
    if (!pendingQuestionId) return;

    const questionType = sessionStorage.getItem('pendingQuestionType');
    const wordIdsRaw = sessionStorage.getItem('pendingWordIds');
    const optionsRaw = sessionStorage.getItem('pendingOptions');

    if (!questionType || !wordIdsRaw || !optionsRaw) return;

    const wordIds: number[] = JSON.parse(wordIdsRaw);
    const options = JSON.parse(optionsRaw);

    // 读取关联词信息
    const relatedWordsRaw = sessionStorage.getItem('pendingRelatedWords');
    const relatedWordEntries = relatedWordsRaw ? JSON.parse(relatedWordsRaw) : [];

    // 清理 sessionStorage
    sessionStorage.removeItem('pendingQuestionId');
    sessionStorage.removeItem('pendingQuestionType');
    sessionStorage.removeItem('pendingWordIds');
    sessionStorage.removeItem('pendingOptions');
    sessionStorage.removeItem('pendingRelatedWords');

    // 触发 AI 生成
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
        }
        // 生成完毕后立即刷新队列
        setTimeout(() => loadQueue(), 200);
      } catch (error) {
        console.error('AI 出题异常:', error);
        // 标记为 FAILED 状态
        try {
          await markQuestionAsFailed(pendingQuestionId);
          loadQueue();
        } catch {
          // 如果标记失败，也要刷新队列
          loadQueue();
        }
      }
    };

    // 注意：不要 await，让它异步执行
    generate();
  }, [loadQueue]);

  // 重试失败的题目
  const handleRetryQuestion = useCallback(async (questionId: string, questionItem?: QuestionQueueItem) => {
    try {
      const result = await retryQuestion(questionId);
      // 重新触发 AI 生成
      // 由于我们不知道之前的 options，从现有 item 无法恢复，
      // 所以需要用户重新选择参数。但我们可以直接调用生成
      // 通过 sessionStorage 传递
      sessionStorage.setItem('pendingQuestionId', result.id);
      sessionStorage.setItem('pendingQuestionType', result.questionType);
      sessionStorage.setItem('pendingWordIds', JSON.stringify(result.wordIds));
      // 重试时用默认参数 - 根据当前单词数量动态调整
      if (result.questionType === 'fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount); // n 至少为 1，但不超过单词数
        const m = Math.max(0, wordCount - n); // 剩余作为干扰词
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'fill-blank',
          fillBlank: { n, m },
        }));
      } else if (result.questionType === 'translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount); // n 至少为 1，但不超过单词数
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'translate',
          translate: { n },
        }));
      } else if (result.questionType === 'meaning-select') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount); // n 至少为 1，但不超过单词数
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'meaning-select',
        }));
      }
      window.location.href = '/practice';
    } catch (error) {
      console.error('重试题目失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;
    if (!isLoggedIn) return;
    loadQueue();

    // 检查是否有待生成的题目需要处理
    processPendingQuestion();

    // 每 5 秒自动刷新队列
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [isClient, isLoggedIn, loadQueue, processPendingQuestion]);

  // 客户端尚未初始化时，显示加载中
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  // 未登录时，显示未授权页面（包含重定向逻辑）
  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  // 已登录但加载中，显示加载中
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
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            题目队列
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            共 {queue.length} 道题目
          </p>
        </div>

        {/* 题目列表 */}
        <QuestionList queue={queue} onRetry={handleRetryQuestion} />
      </div>
    </div>
  );
}
