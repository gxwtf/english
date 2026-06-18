'use client';

import { useState, useCallback } from 'react';
import { submitAnswer, markQuestionAsAnswered, resetQuestion as resetQuestionAction } from '@/actions/ai-question';
import { WordMeaningsDisplay } from '@/components/WordMeaningsDisplay';

interface MeaningSelectBaseQuestionItem {
  id: number;
  type: string;
  word: string;
  options: string[];
  correctAnswer: string;
  chinese?: string;
  english?: string;
}

interface MeaningSelectBaseAnswerProps {
  questionId: string;
  questions: MeaningSelectBaseQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
  /** 选项布局：英译中用2列，英英释义用1列 */
  optionGridCols?: 1 | 2;
}

export function MeaningSelectBaseAnswer({
  questionId, questions, thinking, lastAnswer, status, onSubmitted, optionGridCols = 2,
}: MeaningSelectBaseAnswerProps) {
  const initialAnswers = status === 'ANSWERED' && lastAnswer
    ? questions.map((_, i) => (lastAnswer[i] as string) || '')
    : Array(questions.length).fill('');

  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [submitted, setSubmitted] = useState(status === 'ANSWERED');
  const [submitting, setSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleAnswerChange = useCallback((index: number, value: string) => {
    setAnswers(prev => { const next = [...prev]; next[index] = value; return next; });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (answers.some(a => !a.trim())) { alert('请选择所有题目的答案后再提交'); return; }
    setSubmitting(true);
    try {
      const answerMap: Record<number, string> = {};
      for (let i = 0; i < answers.length; i++) answerMap[i] = answers[i];
      await submitAnswer(questionId, answerMap);
      await markQuestionAsAnswered(questionId);
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      console.error('提交答案失败:', error);
      alert('提交答案失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questionId, onSubmitted]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await resetQuestionAction(questionId);
      setAnswers(Array(questions.length).fill(''));
      setSubmitted(false);
      onSubmitted?.();
    } catch (error) {
      console.error('重置失败:', error);
      setResetError('重置失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  }, [questionId, questions.length, onSubmitted]);

  const isShowingResults = submitted || status === 'ANSWERED';

  return (
    <div className="space-y-6">
      {thinking && isShowingResults && (
        <details className="text-xs">
          <summary className="cursor-pointer text-amber-600 dark:text-amber-400 font-medium">
            查看 AI 思考过程
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg whitespace-pre-wrap text-xs overflow-auto max-h-48">
            {thinking}
          </pre>
        </details>
      )}

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">第 {i + 1} 题</p>

            <div className="mb-4">
              <p className="text-lg font-bold text-center text-gray-900 dark:text-white py-2">
                {q.word}
              </p>
            </div>

            <div className={`grid grid-cols-${optionGridCols} gap-3`}>
              {q.options.map((option, optionIndex) => {
                const isSelected = answers[i] === option;
                const isCorrect = option === q.correctAnswer;
                const showResult = isShowingResults;

                let buttonClass = "p-3 text-sm rounded-lg border-2 transition-all duration-200 text-left ";

                if (showResult) {
                  if (isCorrect) {
                    buttonClass += "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
                  } else if (isSelected && !isCorrect) {
                    buttonClass += "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
                  } else {
                    buttonClass += "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500";
                  }
                } else {
                  buttonClass += isSelected
                    ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-700";
                }

                return (
                  <button
                    key={optionIndex}
                    onClick={() => !isShowingResults && handleAnswerChange(i, option)}
                    disabled={isShowingResults}
                    className={buttonClass}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + optionIndex)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {isShowingResults && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">正确答案：</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {q.correctAnswer}
                </p>
                {answers[i] && (
                  <p className="text-xs mt-1">
                    {answers[i] === q.correctAnswer ? (
                      <span className="text-green-600 dark:text-green-400">回答正确</span>
                    ) : (
                      <span className="text-red-500 dark:text-red-400">回答错误</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isShowingResults ? (
        <button
          onClick={handleSubmit}
          disabled={submitting || answers.some(a => !a.trim())}
          className={`w-full py-3 font-semibold rounded-xl transition-all shadow-md ${
            submitting || answers.some(a => !a.trim())
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-lg'
          }`}
        >
          {submitting ? '提交中...' : '提交答案'}
        </button>
      ) : (
        <div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {status === 'ANSWERED' ? '上次作答结果（点击下方"重新作答"可重新回答）：' : '答案已提交！'}
            </p>
            <div className="mt-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                正确率：{questions.filter((q, i) => answers[i] === q.correctAnswer).length} / {questions.length}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <WordMeaningsDisplay questionId={questionId} status={status || ''} isShowingResults={isShowingResults} />
          </div>

          {resetError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 mb-4">
              <p className="text-sm text-red-700 dark:text-red-300">{resetError}</p>
            </div>
          )}

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
              className={`flex-1 py-3 font-semibold rounded-xl transition-all shadow-md text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                status === 'ANSWERED'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
              }`}
            >
              {isResetting ? '重置中...' : '重新作答'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
