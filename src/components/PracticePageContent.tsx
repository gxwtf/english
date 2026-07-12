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
  generateDefinitionFillBlankWithQuestion,
  generateWordSelectTranslateWithQuestion,
  markQuestionAsFailed,
  retryQuestion,
  retryQuestionsAndGenerate,
  getQuestionsForPdf,
} from '@/actions/ai-question';
import { generatePdf } from '@/lib/pdf-generator';
import { useRouter } from 'next/navigation';
import { FileDown, Loader2, RefreshCw } from 'lucide-react';

export function PracticePageContent() {
  const { isLoggedIn, isClient, isLoading } = useAuth();
  const [queue, setQueue] = useState<QuestionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set()); // 正在重试的题目ID
  const [batchRetrying, setBatchRetrying] = useState(false);
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

  const generateQuestionByItem = useCallback(async (item: {
    questionId: string;
    questionType: string;
    wordIds: number[];
    options: any;
    relatedWordEntries: any[];
  }) => {
    const { questionId, questionType, wordIds, options, relatedWordEntries } = item;
    console.log('[generateQuestionByItem]', questionId, questionType);
    try {
      switch (questionType) {
        case 'fill-blank': {
          const fillBlankOptions = options.fillBlank ?? { n: 5, m: 0 };
          await generateFillBlankWithQuestion(
            questionId, wordIds, fillBlankOptions,
            undefined, options.deepThinking,
            relatedWordEntries, options.allowFormChange
          );
          break;
        }
        case 'translate': {
          const translateOptions = options.translate ?? { n: 5 };
          await generateTranslateWithQuestion(
            questionId, wordIds, translateOptions,
            undefined, options.deepThinking,
            relatedWordEntries
          );
          break;
        }
        case 'meaning-select': {
          const meaningSelectOptions = options.meaningSelect ?? { n: 5 };
          await generateMeaningSelectWithQuestion(
            questionId, wordIds, meaningSelectOptions,
            options.deepThinking,
            relatedWordEntries
          );
          break;
        }
        case 'meaning-select-en': {
          const meaningSelectEnOptions = options.meaningSelectEn ?? { n: 5 };
          await generateMeaningSelectEnWithQuestion(
            questionId, wordIds, meaningSelectEnOptions,
            options.deepThinking,
            relatedWordEntries
          );
          break;
        }
        case 'definition-fill-blank': {
          const definitionFillBlankOptions = options.definitionFillBlank ?? { n: 5, m: 0 };
          await generateDefinitionFillBlankWithQuestion(
            questionId, wordIds, definitionFillBlankOptions,
            undefined, options.deepThinking,
            relatedWordEntries
          );
          break;
        }
        case 'word-select-translate': {
          const wordSelectTranslateOptions = options.wordSelectTranslate ?? { n: 5 };
          await generateWordSelectTranslateWithQuestion(
            questionId, wordIds, wordSelectTranslateOptions,
            undefined, options.deepThinking,
            relatedWordEntries
          );
          break;
        }
        case 'word-card': {
          // word-card 不需要 AI 生成，直接生成完成
          // 此分支不会被调用，因为 word-card 不经过 sessionStorage 处理
          break;
        }
        default: {
          console.warn('[generateQuestionByItem] unknown questionType', questionType);
        }
      }
      setTimeout(() => loadQueue(), 200);
    } catch (error) {
      console.error('AI 出题异常:', error);
      try {
        await markQuestionAsFailed(questionId);
        loadQueue();
      } catch {
        loadQueue();
      }
    }
  }, [loadQueue]);

  const processPendingQuestion = useCallback(() => {
    const raw = sessionStorage.getItem('pendingQuestions');
    if (!raw) return;

    let items: Array<{
      questionId: string;
      questionType: string;
      wordIds: number[];
      options: any;
      relatedWordEntries: any[];
    }>;
    try {
      items = JSON.parse(raw);
      if (!Array.isArray(items) || items.length === 0) return;
    } catch {
      sessionStorage.removeItem('pendingQuestions');
      return;
    }

    sessionStorage.removeItem('pendingQuestions');

    for (const item of items) {
      generateQuestionByItem(item);
    }
  }, [generateQuestionByItem]);

  const handleRetryQuestion = useCallback(async (questionId: string, questionItem?: QuestionQueueItem) => {
    // 立即显示加载状态（用户友好性）
    setRetryingIds(prev => new Set(prev).add(questionId));
    
    // 乐观更新：立即将题目状态显示为"生成中"
    setQueue(prev => prev.map(q => 
      q.id === questionId ? { ...q, status: 'GENERATING' as any } : q
    ));
    
    try {
      const result = await retryQuestion(questionId);

      let retryOptions: any;
      if (result.questionType === 'fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        const m = Math.max(0, wordCount - n);
        retryOptions = {
          type: 'fill-blank',
          fillBlank: { n, m },
        };
      } else if (result.questionType === 'translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        retryOptions = {
          type: 'translate',
          translate: { n },
        };
      } else if (result.questionType === 'meaning-select') {
        retryOptions = {
          type: 'meaning-select',
        };
      } else if (result.questionType === 'meaning-select-en') {
        retryOptions = {
          type: 'meaning-select-en',
        };
      } else if (result.questionType === 'definition-fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        const m = Math.max(0, wordCount - n);
        retryOptions = {
          type: 'definition-fill-blank',
          definitionFillBlank: { n, m },
        };
      } else if (result.questionType === 'word-select-translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        const m = Math.max(0, wordCount - n);
        retryOptions = {
          type: 'word-select-translate',
          wordSelectTranslate: { n, m },
        };
      } else if (result.questionType === 'word-card') {
        retryOptions = {
          type: 'word-card',
          wordCard: {},
        };
      }

      const pendingItem = {
        questionId: result.id,
        questionType: result.questionType,
        wordIds: result.wordIds,
        options: retryOptions,
        relatedWordEntries: questionItem?.relatedWordEntries || [],
      };

      // 直接启动 AI 生成，不经过 sessionStorage，避免多重重试时的覆盖问题
      console.log('[Retry] starting generate for', pendingItem.questionId, pendingItem.questionType);
      setTimeout(() => generateQuestionByItem(pendingItem), 0);

      // 清除加载状态
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    } catch (error) {
      console.error('重试题目失败:', error);
      
      // 清除加载状态，恢复原状态
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      
      // 恢复题目状态为"生成失败"（用户可以通过状态看到失败信息）
      setQueue(prev => prev.map(q => 
        q.id === questionId ? { ...q, status: 'FAILED' as any } : q
      ));
    }
  }, [generateQuestionByItem]);

  const handleRetryAllFailed = useCallback(async () => {
    const failedItems = queue.filter(q => q.status === 'FAILED');
    if (failedItems.length === 0) return;

    setBatchRetrying(true);

    // 乐观更新：将失败的题目显示为生成中
    setQueue(prev => prev.map(q =>
      failedItems.some(f => f.id === q.id) ? { ...q, status: 'GENERATING' as any } : q
    ));

    try {
      const questionIds = failedItems.map(q => q.id);
      await retryQuestionsAndGenerate(questionIds);

      // 服务器端已并行启动生成，本地定期刷新状态
      setTimeout(() => loadQueue(), 300);
    } catch (error) {
      console.error('批量重试失败:', error);
      loadQueue();
    } finally {
      setBatchRetrying(false);
    }
  }, [queue, loadQueue]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const selectableIds = queue
      .filter(q => ['GENERATED', 'ANSWERED', 'GRADING'].includes(q.status))
      .map(q => q.id);
    const allSelected = selectableIds.every(id => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }, [queue, selectedIds]);

  const handleExportPdf = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setExporting(true);
    try {
      const data = await getQuestionsForPdf(Array.from(selectedIds));
      await generatePdf(data);
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      alert('导出 PDF 失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }, [selectedIds]);

  useEffect(() => {
    if (!isClient) return;
    if (!isLoggedIn) return;
    loadQueue();

    processPendingQuestion();

    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [isClient, isLoggedIn, loadQueue, processPendingQuestion]);

  // Clean up selectedIds for items no longer in queue
  useEffect(() => {
    const queueIdSet = new Set(queue.map(q => q.id));
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => queueIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [queue]);

  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  const selectableCount = queue.filter(q => ['GENERATED', 'ANSWERED', 'GRADING'].includes(q.status)).length;
  const failedCount = queue.filter(q => q.status === 'FAILED').length;

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

        {/* Export toolbar */}
        {selectableCount > 0 && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              onClick={handleSelectAll}
              className="text-sm px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {selectedIds.size === selectableCount && selectableCount > 0 ? '取消全选' : '全选'}
            </button>

            <span className="text-sm text-gray-500 dark:text-gray-400">
              已选 {selectedIds.size} 题
            </span>

            <button
              onClick={handleExportPdf}
              disabled={selectedIds.size === 0 || exporting}
              className="ml-auto flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  导出为 PDF
                </>
              )}
            </button>
          </div>
        )}

        {/* Batch retry toolbar */}
        {failedCount > 0 && (
          <div className="mb-4 flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
            <span className="text-sm text-red-700 dark:text-red-300">
              有 {failedCount} 道题目生成失败
            </span>
            <button
              onClick={handleRetryAllFailed}
              disabled={batchRetrying}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  重试中...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  全部重试
                </>
              )}
            </button>
          </div>
        )}

        <QuestionList
          queue={queue}
          onRetry={handleRetryQuestion}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          retryingIds={retryingIds} // 正在重试的题目ID集合
        />
      </div>
    </div>
  );
}
