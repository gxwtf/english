'use client';

import { useState, useCallback } from 'react';
import { submitAnswer, markQuestionAsAnswered, resetQuestion as resetQuestionAction } from '@/actions/ai-question';
import { WordMeaningsDisplay } from '@/components/WordMeaningsDisplay';

interface FillBlankQuestionItem {
  sentence: string;
  answer: string;
  originalWord?: string;
}

interface FillBlankAnswerProps {
  questionId: string;
  words: string[];
  questions: FillBlankQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
}

export function FillBlankAnswer({ questionId, words, questions, thinking, lastAnswer, status, onSubmitted }: FillBlankAnswerProps) {
  // 如果题目已作答，从 lastAnswer 初始化答案
  const initialAnswers = status === 'ANSWERED' && lastAnswer
    ? questions.map((_, i) => (lastAnswer[i] as string) || '')
    : Array(questions.length).fill('');

  const [answers, setAnswers] = useState<string[]>(initialAnswers);
  const [submitted, setSubmitted] = useState(status === 'ANSWERED');
  const [submitting, setSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  // 用于存储上次提交的答案，以便在已作答时显示
  const [savedAnswers, setSavedAnswers] = useState<string[]>(initialAnswers);

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
      for (let i = 0; i < answers.length; i++) {
        answerMap[i] = answers[i];
      }
      await submitAnswer(questionId, answerMap);
      await markQuestionAsAnswered(questionId);
      
      // 保存当前答案以便显示
      setSavedAnswers([...answers]);
      
      // 【关键修改】设置 submitted 为 true，立即在当前页面展示评分结果
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
      // Save current answers before resetting
      setSavedAnswers([...answers]);
      setAnswers(Array(questions.length).fill(''));
      setSubmitted(false);
      
      // 【关键修改】去掉了重置后的页面跳转，允许用户留在当前页重新作答
      onSubmitted?.();
    } catch (error) {
      console.error('重置失败:', error);
      setResetError('重置失败，请稍后重试');
    } finally {
      setIsResetting(false);
    }
  }, [questionId, questions.length, answers, onSubmitted]);

  // 判断是否处于展示结果的阶段
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

      {/* 单词池 */}
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">可选单词：</p>
        <div className="flex flex-wrap gap-2">
          {words.map((word, i) => (
            <span
              key={i}
              className="text-sm px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full border border-green-200 dark:border-green-800"
            >
              {word}
            </span>
          ))}
          {/* Show changed forms as hints */}
          {questions.some(q => q.originalWord) && (
            <span className="text-xs text-gray-500 dark:text-gray-400 self-center ml-1">
              (部分题目可能需要填写单词的不同形式)
            </span>
          )}
        </div>
      </div>

      {/* 题目列表 */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">第 {i + 1} 题</p>
            <BlankInput
              sentence={q.sentence}
              value={answers[i]}
              onChange={(val) => handleAnswerChange(i, val)}
              correctAnswer={q.answer}
              originalWord={q.originalWord}
              userAnswer={isShowingResults ? (savedAnswers[i] || answers[i]) : undefined}
              questionIndex={i}
              disabled={isShowingResults} // 提交后立即禁用输入框
            />
          </div>
        ))}
      </div>

      {/* 提交按钮或正确答案展示 */}
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
              {status === 'ANSWERED' ? '上次作答结果（点击下方"重新作答"可重新回答）：' : '答案已提交！评分结果如下：'}
            </p>
            <div className="mt-2 space-y-2">
              {/* 【关键修改】统一评分结果的展示逻辑，即便是刚提交也展示对错及订正 */}
              {questions.map((q, i) => {
                const userAnswer = savedAnswers[i] || answers[i];
                const isCorrect = userAnswer?.trim() === q.answer;
                return (
                  <div key={i} className="text-sm">
                    <p className={`font-medium ${
                      isCorrect
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500 dark:text-red-400 line-through'
                    }`}>
                      第 {i + 1} 题：{userAnswer || '(未回答)'}
                    </p>
                    {!isCorrect && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">正确答案：{q.answer}{q.originalWord && q.originalWord !== q.answer ? `（原词：${q.originalWord}）` : ''}</p>
                    )}
                  </div>
                );
              })}
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

function BlankInput({
  sentence,
  value,
  onChange,
  correctAnswer,
  originalWord,
  userAnswer,
  questionIndex,
  disabled,
}: {
  sentence: string;
  value: string;
  onChange: (val: string) => void;
  correctAnswer?: string;
  originalWord?: string;
  userAnswer?: string;
  questionIndex: number;
  disabled?: boolean;
}) {
  const parts = sentence.replace(/_+/g, '_').split('_');
  const isCorrect = userAnswer !== undefined && userAnswer.trim() === correctAnswer;

  return (
    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      {parts.map((part, i) => (
        <span key={`q${questionIndex}-part${i}`}>
          {part}
          {i < parts.length - 1 && (
            <input
              key={`q${questionIndex}-blank${i}`}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled || userAnswer !== undefined}
              className={`inline-block min-w-[120px] border-b-2 text-center bg-transparent px-1 py-0.5 outline-none transition-colors
                ${userAnswer !== undefined
                  ? isCorrect
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-red-400 text-red-500 dark:text-red-400 line-through'
                  : 'border-dashed border-green-400 dark:border-green-600 focus:border-blue-500'
                }`}
              placeholder="填入单词"
            />
          )}
        </span>
      ))}
      {userAnswer !== undefined && correctAnswer && !isCorrect && (
        <span className="text-xs text-green-600 dark:text-green-400 ml-1">正确答案：{correctAnswer}{originalWord && originalWord !== correctAnswer ? `（原词：${originalWord}）` : ''}</span>
      )}
    </p>
  );
}