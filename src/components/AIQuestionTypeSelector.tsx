'use client';

import { useState } from 'react';
import { BookOpen, Type } from 'lucide-react';
import type { QuestionType } from '@/types/word';
import type { FillBlankOptions } from '@/types/problem';


export type QuestionGenerationOptions = {
  type: QuestionType;
  fillBlank?: FillBlankOptions;
};

interface AIQuestionTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: QuestionGenerationOptions) => void;
  /** 选中的单词数量，用于限制 n+m */
  maxWords?: number;
}

export const AIQuestionTypeSelector = ({ isOpen, onClose, onGenerate, maxWords }: AIQuestionTypeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<QuestionType | null>(null);
  const [questionN, setQuestionN] = useState(5);
  const [questionM, setQuestionM] = useState(0);

  const effectiveMaxWords = maxWords ?? 11;
  const totalWords = questionN + questionM;
  const validationError = totalWords > effectiveMaxWords
    ? `n + m (${totalWords}) 不能超过选中的单词数量 (${effectiveMaxWords})`
    : totalWords > 11
      ? `n + m (${totalWords}) 不能超过 11`
      : null;

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

  const handleGenerate = () => {
    if (!selectedType || validationError) return;
    const options: QuestionGenerationOptions = { type: selectedType };
    if (selectedType === 'fill-blank') {
      options.fillBlank = { n: questionN, m: questionM };
    }
    onGenerate(options);
  };

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
                AI 出题
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                选择题目类型并生成练习题
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

        {/* 内容区 - 题目类型选择 */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {questionTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`group flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 shadow-lg'
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-green-500 dark:hover:border-green-400 hover:shadow-lg'
                  }`}
                >
                  <div className={`w-14 h-14 mb-4 flex items-center justify-center rounded-full transition-transform ${
                    isSelected
                      ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 scale-110'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:scale-110'
                  }`}>
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

          {/* 选词填空参数 */}
          {selectedType === 'fill-blank' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目参数设置
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    题目数量 n（需回答的句子数）
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={11}
                    value={questionN}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(11, parseInt(e.target.value) || 1));
                      setQuestionN(val);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    干扰词数量 m（多余单词数）
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={questionM}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(11, parseInt(e.target.value) || 0));
                      setQuestionM(val);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                共需 n + m = {totalWords} 个单词（n 道题，m 个干扰词）
                {effectiveMaxWords < 11 && `，当前选中 ${effectiveMaxWords} 个单词`}
              </p>
              {validationError && (
                <p className="text-xs text-red-500 mt-1">{validationError}</p>
              )}
            </div>
          )}

          {/* 生成按钮 */}
          {selectedType && (
            <button
              onClick={handleGenerate}
              disabled={!!validationError}
              className={`mt-4 w-full py-3 font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg ${
                validationError
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
              }`}
            >
              {selectedType === 'fill-blank'
                ? `生成选词填空（${questionN} 道小题，${questionM} 个干扰词）`
                : `生成翻译句子题目`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
