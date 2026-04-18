'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { QuestionQueueItem } from '@/types/word';
import { loadQuestionById } from '@/actions/ai-question';
import { FillBlankAnswer } from '@/components/FillBlankAnswer';
import { TranslateAnswer } from '@/components/TranslateAnswer';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { UnauthenticatedPage } from '@/components/UnauthenticatedPage';
import { Navbar } from '@/components/Navbar';

export default function PracticeQuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = use(params);
  const { isLoggedIn, isClient } = useAuth();
  const [question, setQuestion] = useState<QuestionQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isClient || !isLoggedIn) return;
    setLoading(true);
    loadQuestionById(questionId)
      .then(data => {
        setQuestion(data);
      })
      .catch(err => {
        setError(err.message || '加载题目失败');
      })
      .finally(() => setLoading(false));
  }, [questionId, isClient, isLoggedIn]);

  if (!isClient || !isLoggedIn || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedPage />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400">{error}</p>
            <a href="/practice" className="text-sm text-blue-500 mt-4 inline-block">
              返回题目列表
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar currentPage="practice" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="/practice" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
            &larr; 返回题目列表
          </a>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {question.questionType === 'fill-blank' ? '选词填空' : '翻译句子'}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            创建于 {new Date(question.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>

        {/* Status check */}
        {question.status === 'GENERATING' && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">题目正在生成中，请稍候...</p>
          </div>
        )}

        {question.status === 'FAILED' && (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400">题目生成失败</p>
            <a href="/practice" className="text-sm text-blue-500 mt-2 inline-block">
              返回题目列表重试
            </a>
          </div>
        )}

        {(question.status === 'GENERATED' || question.status === 'ANSWERED') && question.questionContent ? (
          <div>
            {question.questionType === 'fill-blank' && question.questionContent.words ? (
              <FillBlankAnswer
                key={question.id}
                questionId={question.id}
                words={question.questionContent.words as string[]}
                questions={question.questionContent.questions as { sentence: string; answer: string }[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={() => { }}
              />
            ) : question.questionType === 'translate' ? (
              <TranslateAnswer
                key={question.id}
                questionId={question.id}
                questions={question.questionContent.questions as any[]}
                thinking={question.questionContent.thinking as string | null ?? undefined}
                lastAnswer={question.lastAnswer}
                status={question.status}
                onSubmitted={() => { }}
              />
            ) : (
              <QuestionDisplay
                content={question.questionContent}
                questionId={question.id}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
