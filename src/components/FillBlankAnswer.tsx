'use client';

import { useState, useCallback } from 'react';
import { submitAnswer } from '@/actions/ai-question';

interface FillBlankQuestionItem {
  sentence: string;
  answer: string;
}

interface FillBlankAnswerProps {
  questionId: string;
  words: string[];
  questions: FillBlankQuestionItem[];
  thinking?: string;
  onSubmitted?: () => void;
}

export function FillBlankAnswer({ questionId, words, questions, thinking, onSubmitted }: FillBlankAnswerProps) {
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(''));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      console.error('提交答案失败:', error);
      alert('提交答案失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questionId, onSubmitted]);

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
              correctAnswer={submitted ? q.answer : undefined}
              userAnswer={submitted ? answers[i] : undefined}
            />
          </div>
        ))}
      </div>

      {/* 提交按钮或正确答案展示 */}
      {!submitted ? (
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
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">答案已提交！以下是正确答案：</p>
          <div className="mt-2 space-y-2">
            {questions.map((q, i) => (
              <p key={i} className="text-sm text-green-600 dark:text-green-400">
                第 {i + 1} 题: {q.answer}
              </p>
            ))}
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
  userAnswer,
}: {
  sentence: string;
  value: string;
  onChange: (val: string) => void;
  correctAnswer?: string;
  userAnswer?: string;
}) {
  const parts = sentence.replace(/_+/g, '_').split('_');
  const isCorrect = userAnswer !== undefined && userAnswer.trim() === correctAnswer;

  return (
    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={userAnswer !== undefined}
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
        <span className="text-xs text-green-600 dark:text-green-400 ml-1">正确答案: {correctAnswer}</span>
      )}
    </p>
  );
}
