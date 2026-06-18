'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitAnswer, gradeTranslateAnswerBatch, loadGradingResult, GradeResult, resetQuestion as resetQuestionAction, markQuestionAsGradingFailed } from '@/actions/ai-question';
import { WordMeaningsDisplay } from '@/components/WordMeaningsDisplay';
import Link from 'next/link';

interface WordSelectTranslateQuestionItem {
  id: number;
  chinese: string;
  referenceAnswers: string;
}

interface WordSelectTranslateAnswerProps {
  questionId: string;
  words: string[];
  questions: WordSelectTranslateQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
}

export function WordSelectTranslateAnswer({ questionId, words, questions, thinking, lastAnswer, status, onSubmitted }: WordSelectTranslateAnswerProps) {
  const router = useRouter();

  const [isReset, setIsReset] = useState(false);
  const currentStatus = isReset ? 'UNANSWERED' : status;

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
  const [savedGradingResults, setSavedGradingResults] = useState<GradeResult[] | null>(null);
  const [isRetryingGrading, setIsRetryingGrading] = useState(false);

  useEffect(() => {
    if (currentStatus === 'ANSWERED' && lastAnswer && !savedGradingResults && !isLoadingGrading) {
      setIsLoadingGrading(true);
      loadGradingResult(questionId)
        .then(cachedResults => {
          if (cachedResults && cachedResults.length > 0) {
            setGradingResults(cachedResults);
            setSavedGradingResults(cachedResults);
          } else {
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
        .finally(() => setIsLoadingGrading(false));
    }
  }, [currentStatus, lastAnswer, savedGradingResults, isLoadingGrading, questionId, initialAnswers]);

  useEffect(() => {
    if (currentStatus === 'GRADING' && lastAnswer && !savedGradingResults && !isLoadingGrading) {
      setIsLoadingGrading(true);
      gradeTranslateAnswerBatch(questionId, Object.fromEntries(
        Object.entries(lastAnswer).map(([key, value]) => [Number(key), value as string])
      ))
        .then(results => {
          setGradingResults(results);
          setSavedGradingResults(results);
          router.refresh();
        })
        .catch(error => {
          console.error('批改失败:', error);
          setSubmitError('批改失败，请稍后重试');
          markQuestionAsGradingFailed(questionId)
            .then(() => router.refresh())
            .catch(e => console.error('标记批改失败状态失败:', e));
        })
        .finally(() => setIsLoadingGrading(false));
    }
  }, [currentStatus, lastAnswer, savedGradingResults, isLoadingGrading, questionId, router]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await resetQuestionAction(questionId);
      setIsReset(true);
      setAnswers({});
      setGradingResults(null);
      setSavedGradingResults(null);
      router.refresh();
    } catch (error) {
      console.error('重置失败:', error);
      setResetError('重置失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  }, [questionId, router]);

  const handleRetryGrading = useCallback(async () => {
    setIsRetryingGrading(true);
    setSubmitError(null);
    try {
      await submitAnswer(questionId, lastAnswer || {});
      router.refresh();
    } catch (error) {
      console.error('重试批改失败:', error);
      setSubmitError('重试批改失败，请稍后重试');
    } finally {
      setIsRetryingGrading(false);
    }
  }, [questionId, lastAnswer, router]);

  const hasEmptyAnswers = questions.some(q => !answers[q.id]?.trim());

  const handleAnswerChange = useCallback((qId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  }, []);

  const handleSubmitAll = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitAnswer(questionId, answers);
      setIsLoadingGrading(true);
      const gradingAnswers = { ...answers };
      setSavedGradingResults(null);
      gradeTranslateAnswerBatch(questionId, gradingAnswers)
        .then(results => {
          setGradingResults(results);
          setSavedGradingResults(results);
          router.refresh();
        })
        .catch(error => {
          console.error('批改失败:', error);
          setSubmitError('批改失败，请稍后重试');
          markQuestionAsGradingFailed(questionId)
            .then(() => router.refresh())
            .catch(e => console.error('标记批改失败状态失败:', e));
        })
        .finally(() => setIsLoadingGrading(false));
      if (onSubmitted) onSubmitted();
      router.push('/practice');
    } catch (error) {
      console.error('提交失败:', error);
      setSubmitError('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questionId, onSubmitted, router]);

  const completedCount = Object.keys(answers).filter(k => answers[Number(k)]?.trim()).length;
  const totalCount = questions.length;
  const displayGradingResults = gradingResults || savedGradingResults;
  const totalScore = displayGradingResults?.reduce((sum, r) => sum + (r.score || 0), 0) ?? 0;
  const maxScore = displayGradingResults?.reduce((sum, r) => sum + (r.maxScore || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {thinking && (currentStatus === 'ANSWERED' || currentStatus === 'GRADING' || currentStatus === 'GRADING_FAILED' || displayGradingResults) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-amber-600 dark:text-amber-400 font-medium">
            查看 AI 思考过程
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg whitespace-pre-wrap text-xs overflow-auto max-h-48">
            {thinking}
          </pre>
        </details>
      )}

      {currentStatus === 'GRADING' && !displayGradingResults ? (
        <>
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">批改中</h3>
            <p className="text-blue-700 dark:text-blue-300">正在为您批改答案，请稍候...</p>
          </div>
          <div className="space-y-4">
            {questions.map((question, index) => {
              const userAnswer = lastAnswer ? (lastAnswer[question.id] as string) : '';
              return (
                <div key={question.id} className="p-4 rounded-lg border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">第 {index + 1} 题</p>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{question.chinese}</p>
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的答案：</p>
                    <p className="text-sm bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                      {userAnswer || '(未作答)'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Link href="/practice" className="flex-1 text-center py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
              返回题目列表
            </Link>
          </div>
        </>
      ) : currentStatus === 'GRADING_FAILED' ? (
        <>
          <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-2">批改失败</h3>
            <p className="text-red-700 dark:text-red-300">AI 批改过程中遇到了错误，请重新尝试批改。</p>
          </div>
          <div className="space-y-4">
            {questions.map((question, index) => {
              const userAnswer = lastAnswer ? (lastAnswer[question.id] as string) : '';
              return (
                <div key={question.id} className="p-4 rounded-lg border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">第 {index + 1} 题</p>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{question.chinese}</p>
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的答案：</p>
                    <p className="text-sm bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                      {userAnswer || '(未作答)'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {submitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Link href="/practice" className="flex-1 text-center py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
              返回题目列表
            </Link>
            <button onClick={handleRetryGrading} disabled={isRetryingGrading} className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
              {isRetryingGrading ? '重试中...' : '重新批改'}
            </button>
          </div>
        </>
      ) : displayGradingResults || (currentStatus === 'ANSWERED' && !displayGradingResults) ? (
        <>
          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
              {currentStatus === 'ANSWERED' && !gradingResults ? '上次作答结果' : '批改完成'}
            </h3>
            <div className="flex items-center justify-between">
              {totalScore > 0 || maxScore > 0 ? (
                <p className="text-green-700 dark:text-green-300">
                  总分：<span className="font-bold text-xl">{totalScore}</span> / {maxScore}
                </p>
              ) : (
                currentStatus === 'ANSWERED' && !gradingResults ? (
                  <p className="text-green-700 dark:text-green-300">正在加载批改结果...</p>
                ) : (
                  <p className="text-green-700 dark:text-green-300">本次练习共{questions.length}题</p>
                )
              )}
            </div>
          </div>
          {displayGradingResults && (
            <div className="space-y-4">
              {displayGradingResults.map((result, index) => {
                const question = questions.find(q => q.id === result.questionId);
                const score = result.score ?? 0;
                const qMaxScore = result.maxScore ?? 0;
                return (
                  <div key={result.questionId} className={`p-4 rounded-lg border ${
                    score >= 8
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : score >= 5
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 dark:text-white">第 {index + 1} 题</p>
                      {result.score !== undefined && (
                        <span className={`text-sm font-bold ${
                          score >= 8 ? 'text-green-600 dark:text-green-400'
                            : score >= 5 ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {score} / {qMaxScore}
                        </span>
                      )}
                    </div>
                    {question && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">中文：{question.chinese}</p>
                    )}
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的答案：</p>
                      <p className="text-sm bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                        {answers[result.questionId] || (lastAnswer ? (lastAnswer[result.questionId] as string) : '') || '(未作答)'}
                      </p>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">标准答案：</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {result.standardAnswer || question?.referenceAnswers}
                      </p>
                    </div>
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
          <div className="mt-8">
            <WordMeaningsDisplay questionId={questionId} status={currentStatus || ''} isShowingResults={!!displayGradingResults || currentStatus === 'ANSWERED'} />
          </div>
          {resetError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{resetError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Link href="/practice" className="flex-1 text-center py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
              返回题目列表
            </Link>
            <button onClick={handleReset} disabled={isResetting} className={`flex-1 py-3 font-semibold rounded-xl transition-all shadow-md text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              currentStatus === 'ANSWERED'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
            }`}>
              {isResetting ? '重置中...' : '重新作答'}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 候选单词区 */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">候选单词：</p>
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <span key={i} className="text-sm px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800 font-medium">
                  {word}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              已完成：{completedCount} / {totalCount}
            </p>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => {
              const isAnswered = !!answers[question.id]?.trim();
              return (
                <div key={question.id} className={`p-4 rounded-lg border transition-all ${
                  isAnswered
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">第 {index + 1} 题</p>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{question.chinese}</p>
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="请从候选单词中选择合适的单词，输入英文翻译..."
                    rows={3}
                    disabled={submitting}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              );
            })}
          </div>

          {submitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setAnswers({})}
              disabled={submitting}
              className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              清空重写
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={submitting || hasEmptyAnswers}
              className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '提交中...' : completedCount === 0 ? '开始答题' : `提交全部 (${completedCount}/${totalCount})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
