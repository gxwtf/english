'use client';

import { useState, useCallback } from 'react';
import { gradeTranslateAnswerSingle } from '@/actions/ai-question';

interface TranslateQuestionItem {
  id: number;
  type: string;
  chinese: string;
  hint: string;
  referenceAnswers: string;
  keyWords: string[];
}

interface GradeScore {
  questionId: number;
  score: number;
  maxScore: number;
  feedback: string;
}

interface TranslateAnswerProps {
  questionId: string;
  questions: TranslateQuestionItem[];
  thinking?: string;
  onSubmitted?: () => void;
}

export function TranslateAnswer({ questionId, questions, thinking, onSubmitted }: TranslateAnswerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [scores, setScores] = useState<Record<number, GradeScore>>({});
  const [submitting, setSubmitting] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion?.id] || '';
  const currentScore = scores[currentQuestion?.id];
  const isLastQuestion = currentIndex === questions.length - 1;
  const allCompleted = Object.keys(scores).length === questions.length;

  const handleAnswerChange = useCallback((value: string) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
  }, [currentQuestion]);

  const handleSubmitCurrent = useCallback(async () => {
    if (!currentQuestion) return;

    const answer = currentAnswer.trim();
    if (!answer) {
      alert('请先输入答案');
      return;
    }

    setSubmitting(true);
    setGradingError(null);
    try {
      const gradeResult = await gradeTranslateAnswerSingle(questionId, currentQuestion.id, answer);
      setScores(prev => ({ ...prev, [currentQuestion.id]: gradeResult }));

      // 移动到下一题
      if (!isLastQuestion) {
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
        }, 300);
      } else {
        // 最后一题已完成
        onSubmitted?.();
      }
    } catch (error) {
      console.error('批改失败:', error);
      setGradingError('AI 批改失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [currentAnswer, currentQuestion, questionId, isLastQuestion, onSubmitted]);

  const handleNavigation = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('确定要重新开始吗？当前的答题进度将被清空')) {
      setScores({});
      setAnswers({});
      setCurrentIndex(0);
    }
  }, []);

  if (!questions.length) {
    return <div className="text-center py-8 text-gray-500">暂无题目</div>;
  }

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

      {/* 进度条 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          进度：{Object.keys(scores).length} / {questions.length}
        </p>
        <button
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          重新开始
        </button>
      </div>

      {/* 进度指示器 */}
      <div className="flex gap-1 justify-center">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => handleNavigation(i)}
            className={`h-2 flex-1 max-w-[60px] rounded-full transition-all ${
              i === currentIndex
                ? 'bg-green-500'
                : scores[questions[i]?.id]
                  ? 'bg-green-300 dark:bg-green-700'
                  : 'bg-gray-200 dark:bg-gray-700'
            }`}
            title={`第 ${i + 1} 题`}
          />
        ))}
      </div>

      {/* 当前题目 */}
      {currentQuestion && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            第 {currentIndex + 1} / {questions.length} 题
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200 mb-1">{currentQuestion.chinese}</p>
          {currentQuestion.hint && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">提示：{currentQuestion.hint}</p>
          )}
          {currentQuestion.keyWords && currentQuestion.keyWords.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              必用单词：
              <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full ml-1">
                {currentQuestion.keyWords.join(', ')}
              </span>
            </p>
          )}

          {/* 已作答：显示答案和评分 */}
          {currentScore ? (
            <div className="space-y-3 mt-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的答案：</p>
                <p className="text-sm bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                  {answers[currentQuestion.id]}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">参考答案：</p>
                <p className="text-sm text-green-600 dark:text-green-400">{currentQuestion.referenceAnswers}</p>
              </div>
              <div className={`p-3 rounded-lg text-sm ${
                currentScore.score >= 8
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : currentScore.score >= 5
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                <p className="font-semibold">AI 评分：{currentScore.score}/{currentScore.maxScore}</p>
                <p className="mt-1">{currentScore.feedback}</p>
              </div>
            </div>
          ) : (
            /* 未作答：显示输入框 */
            <textarea
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="请输入英文翻译..."
              rows={4}
              className="w-full mt-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
            />
          )}
        </div>
      )}

      {/* 错误提示 */}
      {gradingError && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{gradingError}</p>
        </div>
      )}

      {/* 导航和提交按钮 */}
      <div className="flex gap-3">
        <button
          onClick={() => handleNavigation(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一题
        </button>
        {!currentScore ? (
          <button
            onClick={handleSubmitCurrent}
            disabled={submitting || !currentAnswer.trim()}
            className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '批改中...' : '提交'}
          </button>
        ) : (
          <button
            onClick={() => handleNavigation(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
            className="flex-1 py-3 font-semibold rounded-xl transition-all shadow-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLastQuestion ? '完成' : '下一题'}
          </button>
        )}
      </div>

      {/* 全部完成 */}
      {allCompleted && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
            全部完成！
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-600 dark:text-green-400">
              总分：{Object.values(scores).reduce((sum, s) => sum + s.score, 0)} / {Object.values(scores).reduce((sum, s) => sum + s.maxScore, 0)}
            </p>
            <a
              href="/practice"
              className="text-sm font-medium text-green-700 dark:text-green-300 hover:underline"
            >
              返回题目列表 →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
