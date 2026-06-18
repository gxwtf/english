'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitAnswer, gradeFillBlankAnswerBatch, loadGradingResult, GradeResult, resetQuestion as resetQuestionAction, markQuestionAsGradingFailed } from '@/actions/ai-question';
import { WordMeaningsDisplay } from '@/components/WordMeaningsDisplay';
import Link from 'next/link';

interface DefinitionFillBlankQuestionItem {
  definition: string;
  answer: string;
}

interface DefinitionFillBlankAnswerProps {
  questionId: string;
  words: string[];
  questions: DefinitionFillBlankQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
}

export function DefinitionFillBlankAnswer({ questionId, words, questions, thinking, lastAnswer, status, onSubmitted }: DefinitionFillBlankAnswerProps) {
  const router = useRouter();

  const [isReset, setIsReset] = useState(false);
  const currentStatus = isReset ? 'UNANSWERED' : status;

  const initialAnswers = currentStatus === 'ANSWERED' && lastAnswer
    ? questions.map((_, i) => (lastAnswer[i] as string) || '')
    : Array(questions.length).fill('');

  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [gradingResults, setGradingResults] = useState<GradeResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isLoadingGrading, setIsLoadingGrading] = useState(false);
  const [savedGradingResults, setSavedGradingResults] = useState<GradeResult[] | null>(null);
  const [isRetryingGrading, setIsRetryingGrading] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<string[]>(initialAnswers);

  useEffect(() => {
    if (currentStatus === 'ANSWERED' && lastAnswer && !savedGradingResults && !isLoadingGrading) {
      setIsLoadingGrading(true);
      loadGradingResult(questionId)
        .then(cachedResults => {
          if (cachedResults && cachedResults.length > 0) {
            setGradingResults(cachedResults);
            setSavedGradingResults(cachedResults);
          } else {
            return gradeFillBlankAnswerBatch(questionId, initialAnswers.reduce((acc, ans, i) => {
              acc[i] = ans;
              return acc;
            }, {} as Record<number, string>))
              .then(results => {
                setGradingResults(results);
                setSavedGradingResults(results);
              });
          }
        })
        .catch(error => {
          console.error('加载批改结果失败:', error);
        })
        .finally(() => setIsLoadingGrading(false));
    }
  }, [currentStatus, lastAnswer, savedGradingResults, isLoadingGrading, questionId, initialAnswers]);

  useEffect(() => {
    if (currentStatus === 'GRADING' && lastAnswer && !savedGradingResults && !isLoadingGrading) {
      setIsLoadingGrading(true);
      const gradingAnswers = Object.fromEntries(
        Object.entries(lastAnswer).map(([key, value]) => [Number(key), value as string])
      );
      gradeFillBlankAnswerBatch(questionId, gradingAnswers)
        .then(results => {
          setGradingResults(results);
          setSavedGradingResults(results);
          router.refresh();
        })
        .catch(error => {
          console.error('批改失败:', error);
          markQuestionAsGradingFailed(questionId)
            .then(() => router.refresh())
            .catch(e => console.error('标记批改失败状态失败:', e));
        })
        .finally(() => setIsLoadingGrading(false));
    }
  }, [currentStatus, lastAnswer, savedGradingResults, isLoadingGrading, questionId, router]);

  const handleAnswerChange = useCallback((index: number, value: string) => {
    setAnswers(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (answers.some(a => !a.trim())) {
      alert('请填写所有空白后再提交');
      return;
    }
    setSubmitting(true);
    try {
      const answerMap: Record<number, string> = {};
      for (let i = 0; i < answers.length; i++) answerMap[i] = answers[i];
      await submitAnswer(questionId, answerMap);
      setSavedAnswers([...answers]);
      setSavedGradingResults(null);
      setIsLoadingGrading(true);
      gradeFillBlankAnswerBatch(questionId, answerMap)
        .then(results => {
          setGradingResults(results);
          setSavedGradingResults(results);
          router.refresh();
        })
        .catch(error => {
          console.error('批改失败:', error);
          markQuestionAsGradingFailed(questionId)
            .then(() => router.refresh())
            .catch(e => console.error('标记批改失败状态失败:', e));
        })
        .finally(() => setIsLoadingGrading(false));
      onSubmitted?.();
    } catch (error) {
      console.error('提交答案失败:', error);
      alert('提交答案失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questionId, onSubmitted, router]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await resetQuestionAction(questionId);
      setIsReset(true);
      setAnswers(Array(questions.length).fill(''));
      setGradingResults(null);
      setSavedGradingResults(null);
      router.refresh();
      onSubmitted?.();
    } catch (error) {
      console.error('重置失败:', error);
      setResetError('重置失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  }, [questionId, questions.length, onSubmitted, router]);

  const handleRetryGrading = useCallback(async () => {
    setIsRetryingGrading(true);
    try {
      await submitAnswer(questionId, lastAnswer || {});
      setSavedGradingResults(null);
      setGradingResults(null);
      setIsLoadingGrading(true);
      const gradingAnswers = Object.fromEntries(
        Object.entries(lastAnswer || {}).map(([key, value]) => [Number(key), value as string])
      );
      gradeFillBlankAnswerBatch(questionId, gradingAnswers)
        .then(results => {
          setGradingResults(results);
          setSavedGradingResults(results);
          router.refresh();
        })
        .catch(error => {
          console.error('批改失败:', error);
          markQuestionAsGradingFailed(questionId)
            .then(() => router.refresh())
            .catch(e => console.error('标记批改失败状态失败:', e));
        })
        .finally(() => setIsLoadingGrading(false));
    } catch (error) {
      console.error('重试批改失败:', error);
    } finally {
      setIsRetryingGrading(false);
    }
  }, [questionId, lastAnswer, router]);

  const displayGradingResults = gradingResults || savedGradingResults;

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
            <p className="text-blue-700 dark:text-blue-300">正在为您生成 AI 点评，请稍候...</p>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const userAnswer = lastAnswer ? (lastAnswer[i] as string) : '';
              return (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">第 {i + 1} 题</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 italic">{q.definition}</p>
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
            <p className="text-red-700 dark:text-red-300">AI 点评生成过程中遇到了错误，请重新尝试。</p>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const userAnswer = lastAnswer ? (lastAnswer[i] as string) : '';
              return (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">第 {i + 1} 题</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 italic">{q.definition}</p>
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
            <button onClick={handleRetryGrading} disabled={isRetryingGrading} className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
              {isRetryingGrading ? '重试中...' : '重新批改'}
            </button>
          </div>
        </>
      ) : displayGradingResults || currentStatus === 'ANSWERED' ? (
        <>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {currentStatus === 'ANSWERED' && !gradingResults ? '正在加载批改结果...' : '答案已提交！评分结果如下：'}
            </p>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const userAnswer = savedAnswers[i] || answers[i];
              const isCorrect = userAnswer?.trim().toLowerCase() === q.answer.toLowerCase();
              const result = displayGradingResults?.find(r => r.questionId === i);
              return (
                <div key={i} className={`p-4 rounded-lg border ${
                  isCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">第 {i + 1} 题</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 italic">{q.definition}</p>
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的答案：</p>
                    <p className={`text-sm ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400 line-through'}`}>
                      {userAnswer || '(未回答)'}
                    </p>
                  </div>
                  {!isCorrect && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">正确答案：</p>
                      <p className="text-sm text-green-600 dark:text-green-400">{q.answer}</p>
                    </div>
                  )}
                  {result?.feedback && (
                    <div className="mt-3 p-3 rounded-lg text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">AI 点评：</p>
                      <p className="text-gray-600 dark:text-gray-400">{result.feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-8">
            <WordMeaningsDisplay questionId={questionId} status={currentStatus || ''} isShowingResults={!!displayGradingResults || currentStatus === 'ANSWERED'} />
          </div>
          {resetError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 mb-4">
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
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">可选单词：</p>
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <span key={i} className="text-sm px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800 font-medium">
                  {word}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">第 {i + 1} 题</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 italic leading-relaxed">{q.definition}</p>
                <input
                  type="text"
                  value={answers[i]}
                  onChange={(e) => handleAnswerChange(i, e.target.value)}
                  placeholder="填入单词"
                  className="w-full px-3 py-2 border-b-2 text-center bg-transparent outline-none transition-colors border-dashed border-purple-400 dark:border-purple-600 focus:border-blue-500 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || answers.some(a => !a.trim())}
            className={`w-full py-3 font-semibold rounded-xl transition-all shadow-md ${
              submitting || answers.some(a => !a.trim())
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white hover:shadow-lg'
            }`}
          >
            {submitting ? '提交中...' : '提交答案'}
          </button>
        </>
      )}
    </div>
  );
}
