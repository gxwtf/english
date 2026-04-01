'use client';

import { BookOpen, Type } from 'lucide-react';

interface AIQuestionTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: AIQuestionType) => void;
}

export type AIQuestionType = 'fill-blank' | 'translate';

export const AIQuestionTypeSelector = ({ isOpen, onClose, onSelectType }: AIQuestionTypeSelectorProps) => {
  if (!isOpen) return null;

  const questionTypes = [
    {
      id: 'fill-blank' as const,
      title: '选词填空',
      description: '根据句子上下文，选择合适的单词填空',
      icon: BookOpen,
    },
    {
      id: 'translate' as const,
      title: '翻译句子',
      description: '将中文/英文句子翻译成对应的英文/中文',
      icon: Type,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white">
              <Type className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                选择题目类型
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI 将根据所选单词生成练习题
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区 - 网格布局 */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {questionTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => onSelectType(type.id)}
                  className="group flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:shadow-lg transition-all duration-200"
                >
                  <div className="w-14 h-14 mb-4 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {type.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    {type.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
