'use client';

import { useState, useCallback } from 'react';
import { submitAnswer, gradeTranslateAnswerBatch, GradeResult, resetQuestion as resetQuestionAction } from '@/actions/ai-question';

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
  onSubmitted?: () => void;
}

export function TranslateAnswer({ questionId, questions, thinking, onSubmitted }: TranslateAnswerProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [gradingResults, setGradingResults] = useState<GradeResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Handle question reset for retry
  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await resetQuestionAction(questionId);
      // Reset local state
      setAnswers({});
      setGradingResults(null);
    } catch (error) {
      console.error('重置失败:', error);
      setResetError('重置失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  }, [questionId]);

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
      // 然后调用 AI 批量批改
      const result = await gradeTranslateAnswerBatch(questionId, answers);
      setGradingResults(result);
      onSubmitted?.();
    } catch (error) {
      console.error('批改失败:', error);
      setSubmitError('AI 批改失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questionId, onSubmitted]);

  const completedCount = Object.keys(answers).filter(k => answers[Number(k)]?.trim()).length;
  const totalCount = questions.length;
  const totalScore = gradingResults?.reduce((sum, r) => sum + (r.score || 0), 0) ?? 0;
  const maxScore = gradingResults?.reduce((sum, r) => sum + (r.maxScore || 0), 0) ?? 0;

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

      {gradingResults ? (
        // 批改结果展示
        <>
          {/* 总结卡片 */}
          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
              批改完成
            </h3>
            <div className="flex items-center justify-between">
              <p className="text-green-700 dark:text-green-300">
                总分：<span className="font-bold text-xl">{totalScore}</span> / {maxScore}
              </p>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="text-sm font-medium text-green-700 dark:text-green-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? '重置中...' : '重新练习'}
              </button>
            </div>
          </div>

          {/* 逐题详情 */}
          <div className="space-y-4">
            {gradingResults.map((result, index) => {
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
                      {answers[result.questionId] || ''}
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
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? '重置中...' : '重新作答'}
            </button>
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

              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isAnswered
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
                    className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
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

          {/* 提交按钮 */}
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
