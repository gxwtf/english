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
  getQuestionsForPdf,
} from '@/actions/ai-question';
import { generatePdf } from '@/lib/pdf-generator';
import { useRouter } from 'next/navigation';
import { FileDown, Loader2 } from 'lucide-react';

export function PracticePageContent() {
  const { isLoggedIn, isClient } = useAuth();
  const [queue, setQueue] = useState<QuestionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set()); // 正在重试的题目ID
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
            const meaningSelectOptions = options.meaningSelect ?? { n: 5 };
            await generateMeaningSelectWithQuestion(
              pendingQuestionId, wordIds, meaningSelectOptions,
              undefined, options.deepThinking,
              relatedWordEntries
            );
            break;
          }
          case 'meaning-select-en': {
            const meaningSelectEnOptions = options.meaningSelectEn ?? { n: 5 };
            await generateMeaningSelectEnWithQuestion(
              pendingQuestionId, wordIds, meaningSelectEnOptions,
              undefined, options.deepThinking,
              relatedWordEntries
            );
            break;
          }
          case 'definition-fill-blank': {
            const definitionFillBlankOptions = options.definitionFillBlank ?? { n: 5, m: 0 };
            await generateDefinitionFillBlankWithQuestion(
              pendingQuestionId, wordIds, definitionFillBlankOptions,
              undefined, options.deepThinking,
              relatedWordEntries
            );
            break;
          }
          case 'word-select-translate': {
            const wordSelectTranslateOptions = options.wordSelectTranslate ?? { n: 5 };
            await generateWordSelectTranslateWithQuestion(
              pendingQuestionId, wordIds, wordSelectTranslateOptions,
              undefined, options.deepThinking,
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
    // 立即显示加载状态（用户友好性）
    setRetryingIds(prev => new Set(prev).add(questionId));
    
    // 乐观更新：立即将题目状态显示为"生成中"
    setQueue(prev => prev.map(q => 
      q.id === questionId ? { ...q, status: 'GENERATING' as any } : q
    ));
    
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
      } else if (result.questionType === 'definition-fill-blank') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        const m = Math.max(0, wordCount - n);
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'definition-fill-blank',
          definitionFillBlank: { n, m },
        }));
      } else if (result.questionType === 'word-select-translate') {
        const wordCount = result.wordIds?.length || 2;
        const n = Math.min(1, wordCount);
        const m = Math.max(0, wordCount - n);
        sessionStorage.setItem('pendingOptions', JSON.stringify({
          type: 'word-select-translate',
          wordSelectTranslate: { n, m },
        }));
      }
      
      // 清除加载状态
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });

      // 如果已经在 /practice 页面，router.push 不会触发 useEffect 重新运行，
      // 需要直接调用 processPendingQuestion 来启动 AI 生成
      processPendingQuestion();
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
  }, [router, processPendingQuestion]);

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
