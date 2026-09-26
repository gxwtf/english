'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';
import { QuestionList } from '@/components/QuestionDisplay';
import { QuestionQueueItem } from '@/types/word';
import {
  loadQuestionQueue as loadQuestionQueueAction,
  retryQuestion,
  getQuestionsForPdf,
} from '@/actions/ai-question';
import { generatePdf } from '@/lib/pdf-generator';
import {
  dispatchQuestionGeneration,
  takeAllPendingQuestions,
  type PendingQuestionItem,
} from '@/lib/ai-question-client';
import { FileDown, Loader2 } from 'lucide-react';

export function PracticePageContent() {
  const { isLoggedIn, isClient, isLoading } = useAuth();
  const [queue, setQueue] = useState<QuestionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set()); // 正在重试的题目ID

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

  const generateQuestionByItem = useCallback(async (item: PendingQuestionItem) => {
    console.log('[generateQuestionByItem]', item.questionId, item.questionType);
    await dispatchQuestionGeneration(item);
    setTimeout(() => loadQueue(), 200);
  }, [loadQueue]);

  const processPendingQuestion = useCallback(() => {
    const items = takeAllPendingQuestions();
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

      // Helper: use stored generation options if available, otherwise fall back
      const getN = (fallback: number) => {
        if (result.generationOptions && typeof result.generationOptions.n === 'number') return result.generationOptions.n;
        return fallback;
      };
      const getM = (fallback: number) => {
        if (result.generationOptions && typeof result.generationOptions.m === 'number') return result.generationOptions.m;
        return fallback;
      };

      let retryOptions: any;
      if (result.questionType === 'fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = getN(Math.min(1, wordCount));
        const m = getM(Math.max(0, wordCount - n));
        retryOptions = {
          type: 'fill-blank',
          fillBlank: { n, m },
        };
      } else if (result.questionType === 'translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = getN(Math.min(1, wordCount));
        retryOptions = {
          type: 'translate',
          translate: { n },
        };
      } else if (result.questionType === 'meaning-select') {
        const wordCount = result.wordIds?.length || 2;
        const n = getN(Math.min(5, wordCount));
        retryOptions = {
          type: 'meaning-select',
          meaningSelect: { n },
        };
      } else if (result.questionType === 'meaning-select-en') {
        const wordCount = result.wordIds?.length || 2;
        const n = getN(Math.min(5, wordCount));
        retryOptions = {
          type: 'meaning-select-en',
          meaningSelectEn: { n },
        };
      } else if (result.questionType === 'definition-fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = getN(Math.min(1, wordCount));
        const m = getM(Math.max(0, wordCount - n));
        retryOptions = {
          type: 'definition-fill-blank',
          definitionFillBlank: { n, m },
        };
      } else if (result.questionType === 'word-select-translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = getN(Math.min(1, wordCount));
        const m = getM(Math.max(0, wordCount - n));
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
