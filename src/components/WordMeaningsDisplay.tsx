'use client';

import { useEffect, useState } from 'react';
import { getQuestionWordMeanings, type QuestionWordMeaning } from '@/actions/ai-question';

interface WordMeaningsDisplayProps {
  questionId: string;
  status: string;
  isShowingResults?: boolean;
}

export function WordMeaningsDisplay({ questionId, status, isShowingResults }: WordMeaningsDisplayProps) {
  const [wordMeanings, setWordMeanings] = useState<QuestionWordMeaning[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldShow = status === 'ANSWERED' || isShowingResults;

  useEffect(() => {
    if (!shouldShow) return;

    setLoading(true);
    setError(null);
    getQuestionWordMeanings(questionId)
      .then(data => {
        setWordMeanings(data);
      })
      .catch(err => {
        console.error('获取单词释义失败:', err);
        setError('获取单词释义失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [questionId, shouldShow]);

  if (!shouldShow) return null;

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">加载单词释义中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (wordMeanings.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3">
        本次练习涉及的单词及释义
      </h3>
      <div className="space-y-2">
        {wordMeanings.map((word, index) => (
          <div key={index} className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[80px]">
              {word.text}
              {word.isRelatedWord && word.sourceWords && word.sourceWords.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  ({word.sourceWords.join('、')}的关联词)
                </span>
              )}
              :
            </span>
            <div className="flex flex-wrap gap-1 flex-1">
              {word.meanings.length > 0 ? (
                word.meanings.map((meaning, mIndex) => (
                  <span
                    key={mIndex}
                    className="text-xs px-2 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600"
                  >
                    {meaning}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">暂无释义</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
