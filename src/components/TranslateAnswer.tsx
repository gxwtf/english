'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitAnswer, gradeTranslateAnswerBatch, loadGradingResult, GradeResult, resetQuestion as resetQuestionAction } from '@/actions/ai-question';

interface TranslateQuestionItem {
  id: number;
  chinese: string;
  referenceAnswers: string;
  keyWords: string[];
}

interface TranslateAnswerProps {
  questionId: string;
  questions: TranslateQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
}

export function TranslateAnswer({ questionId, questions, thinking, lastAnswer, status, onSubmitted }: TranslateAnswerProps) {
  const router = useRouter();
  // 如果题目已作答，从 lastAnswer 初始化答案
  const initialAnswers = status === 'ANSWERED' && lastAnswer
    ? Object.fromEntries(
        Object.entries(lastAnswer).map(([key, value]) => [Number(key), value as string])
      )
    : {};

  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);
  const [gradingResults, setGradingResults] = useState<GradeResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isLoadingGrading, setIsLoadingGrading] = useState(false);
  // 用于存储上次提交的批改结果
  const [savedGradingResults, setSavedGradingResults] = useState<GradeResult[] | null>(null);

  // Load grading results if the question has been answered and we haven't loaded them yet
  useEffect(() => {
    if (status === 'ANSWERED' && lastAnswer && !savedGradingResults && !isLoadingGrading) {
      setIsLoadingGrading(true);
      // First try to load cached grading results from DB
      loadGradingResult(questionId)
        .then(cachedResults => {
          if (cachedResults && cachedResults.length > 0) {
            // Use cached results if available
            setGradingResults(cachedResults);
            setSavedGradingResults(cachedResults);
          } else {
            // Fall back to re-grading if no cached results
            return gradeTranslateAnswerBatch(questionId, initialAnswers)
              .then(results => {
                setGradingResults(results);
                setSavedGradingResults(results);
              });
          }
        })
        .catch(error => {
          console.error('加载批改结果失败:', error);
          setSubmitError('加载批改结果失败，请刷新页面重试');
        })
        .finally(() => {
          setIsLoadingGrading(false);
        });
    }
  }, [status, lastAnswer, savedGradingResults, isLoadingGrading, questionId, initialAnswers]);

  // Handle question reset for retry
  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await resetQuestionAction(questionId);
      // Save current answers and grading results before resetting
      setSavedGradingResults(gradingResults);
      setAnswers({});
      setGradingResults(null);
      // Redirect to practice list after successful reset
      if (status === 'ANSWERED') {
        router.push('/practice');
      }
    } catch (error) {
      console.error('重置失败:', error);
      setResetError('重置失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  }, [questionId, gradingResults, status, router]);

  // 检查是否所有题目都已填写
  const hasEmptyAnswers = questions.some(q => !answers[q.id]?.trim());

  const handleAnswerChange = useCallback((questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmitAll = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 先提交答案，将题目状态改为 GRADING
      await submitAnswer(questionId, answers);
      // 然后调用 AI 批量批改（不等待结果，批改结果会保存到数据库）
      gradeTranslateAnswerBatch(questionId, answers).catch(error => {
        console.error('批改失败:', error);
      });
      // 立即跳转到题目列表页面
      router.push('/practice');
    } catch (error) {
      console.error('提交失败:', error);
      setSubmitError('提交失败，请稍后重试');
      setSubmitting(false);
    }
  }, [answers, questionId, router]);

  const completedCount = Object.keys(answers).filter(k => answers[Number(k)]?.trim()).length;
  const totalCount = questions.length;
  // Use either current gradingResults or savedGradingResults for display
  const displayGradingResults = gradingResults || savedGradingResults;
  const totalScore = displayGradingResults?.reduce((sum, r) => sum + (r.score || 0), 0) ?? 0;
  const maxScore = displayGradingResults?.reduce((sum, r) => sum + (r.maxScore || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {thinking && (
        <details className="text-xs">
          <summary className="cursor-pointer text-amber-600 dark:text-amber-400 font-medium">
            查看 AI 思考过程
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg whitespace-pre-wrap text-xs overflow-auto max-h-48">
            {thinking}
          </pre>
        </details>
      )}

      {displayGradingResults || (status === 'ANSWERED' && !displayGradingResults) ? (
        // 批改结果展示
        <>
          {/* 总结卡片 */}
          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
              {status === 'ANSWERED' && !gradingResults ? '上次作答结果' : '批改完成'}
            </h3>
            <div className="flex items-center justify-between">
              {totalScore > 0 || maxScore > 0 ? (
                <p className="text-green-700 dark:text-green-300">
                  总分：<span className="font-bold text-xl">{totalScore}</span> / {maxScore}
                </p>
              ) : (
                status === 'ANSWERED' && !gradingResults ? (
                  <p className="text-green-700 dark:text-green-300">
                    正在加载批改结果...
                  </p>
                ) : (
                  <p className="text-green-700 dark:text-green-300">
                    本次练习共{questions.length}题
                  </p>
                )
              )}
              
            </div>
          </div>

          {/* 逐题详情 */}
          {displayGradingResults && (
            <div className="space-y-4">
              {displayGradingResults.map((result, index) => {
                const question = questions.find(q => q.id === result.questionId);
                const score = result.score ?? 0;
                const qMaxScore = result.maxScore ?? 0;

                return (
                  <div
                    key={result.questionId}
                    className={`p-4 rounded-lg border ${
                      score >= 8
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : score >= 5
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        第 {index + 1} 题
                      </p>
                      {result.score !== undefined && (
                        <span className={`text-sm font-bold ${
                          score >= 8
                            ? 'text-green-600 dark:text-green-400'
                            : score >= 5
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {score} / {qMaxScore}
                        </span>
                      )}
                    </div>

                    {question && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        中文：{question.chinese}
                      </p>
                    )}

                    {/* 你的答案 */}
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的答案：</p>
                      <p className="text-sm bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                        {answers[result.questionId] || '(未作答)'}
                      </p>
                    </div>

                    {/* 标准答案 */}
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">标准答案：</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {result.standardAnswer || question?.referenceAnswers}
                      </p>
                    </div>

                    {/* 批改反馈 */}
                    {result.feedback && (
                      <div className="mt-3 p-3 rounded-lg text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">AI 点评：</p>
                        <p className="text-gray-600 dark:text-gray-400">{result.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 错误提示 */}
          {resetError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{resetError}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <a
              href="/practice"
              className="flex-1 text-center py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              返回题目列表
            </a>
            {status === 'ANSWERED' ? (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? '重置中...' : '重新作答'}
              </button>
            ) : (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? '重置中...' : '重新作答'}
              </button>
            )}
          </div>
        </>
      ) : (
        // 答题界面
        <>
          {/* 进度提示 */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              已完成：{completedCount} / {totalCount}
            </p>
          </div>

          {/* 题目列表 - 所有题目显示在同一页面 */}
          <div className="space-y-4">
            {questions.map((question, index) => {
              const isAnswered = !!answers[question.id]?.trim();
              const isPreviouslyAnswered = status === 'ANSWERED';

              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isPreviouslyAnswered || isAnswered
                      ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      第 {index + 1} 题
                    </p>
                  </div>

                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{question.chinese}</p>

                  {question.keyWords && question.keyWords.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      必用单词：
                      <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full ml-1">
                        {question.keyWords.join(', ')}
                      </span>
                    </p>
                  )}

                  <textarea
                    id={`answer-${question.id}`}
                    name={`answer-${question.id}`}
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="请输入英文翻译..."
                    rows={3}
                    disabled={isPreviouslyAnswered}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              );
            })}
          </div>

          {/* 错误提示 */}
          {submitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setAnswers({});
              }}
              className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              清空重写
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={submitting || hasEmptyAnswers}
              className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '批改中...' : completedCount === 0 ? '开始答题' : `提交全部 (${completedCount}/${totalCount})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
