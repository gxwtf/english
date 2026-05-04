'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Type, ListFilter } from 'lucide-react';
import type { QuestionType } from '@/types/word';
import type { FillBlankOptions, TranslateOptions, MeaningSelectOptions, MeaningSelectEnOptions } from '@/types/problem';

const STORAGE_KEY_INCLUDE_RELATED = 'ai-question-include-related';
const STORAGE_KEY_ALLOW_FORM_CHANGE = 'ai-question-allow-form-change';

export type QuestionGenerationOptions = {
  type: QuestionType;
  fillBlank?: FillBlankOptions;
  translate?: TranslateOptions;
  meaningSelect?: MeaningSelectOptions;
  meaningSelectEn?: MeaningSelectEnOptions;
  deepThinking?: boolean;
  includeRelatedWords?: boolean;
  allowFormChange?: boolean;
};

interface AIQuestionTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: QuestionGenerationOptions) => void;
  maxWords?: number;
  relatedWordsCount?: number;
}

export const AIQuestionTypeSelector = ({ isOpen, onClose, onGenerate, maxWords, relatedWordsCount }: AIQuestionTypeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<QuestionType | null>(null);
  const [questionN, setQuestionN] = useState<number | ''>(5);
  const [questionM, setQuestionM] = useState<number | ''>(0);
  const [translateN, setTranslateN] = useState<number | ''>(5);
  const [meaningSelectN, setMeaningSelectN] = useState<number | ''>(5);
  const [meaningSelectEnN, setMeaningSelectEnN] = useState<number | ''>(5);
  const [includeRelatedWords, setIncludeRelatedWords] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY_INCLUDE_RELATED);
    return stored === 'true';
  });
  const [allowFormChange, setAllowFormChange] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY_ALLOW_FORM_CHANGE);
    return stored === 'true';
  });

  // Persist checkbox values to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_INCLUDE_RELATED, String(includeRelatedWords));
  }, [includeRelatedWords]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_ALLOW_FORM_CHANGE, String(allowFormChange));
  }, [allowFormChange]);

  const effectiveMaxWords = maxWords ?? 11;
  const effectiveRelatedCount = relatedWordsCount ?? 0;
  const effectiveTotalPool = includeRelatedWords ? effectiveMaxWords + effectiveRelatedCount : effectiveMaxWords;
  const totalWords = (typeof questionN === 'number' ? questionN : 0) + (typeof questionM === 'number' ? questionM : 0);
  const isFillBlank = selectedType === 'fill-blank';

  const fillBlankValidationError = !isFillBlank
    ? null
    : typeof questionN !== 'number' || questionN < 1
      ? '至少要有 1 道题'
      : totalWords > effectiveTotalPool
        ? `n + m (${totalWords}) 不能超过可用单词数量 (${effectiveTotalPool})`
        : totalWords > 11
          ? `n + m (${totalWords}) 不能超过 11`
          : null;

  const isTranslate = selectedType === 'translate';
  const translateValidationError = isTranslate
    ? translateN === '' || translateN < 1
      ? '至少要有 1 道题'
      : translateN > 5
        ? '最多只能出 5 道题'
        : translateN > effectiveTotalPool
          ? `题目数量不能超过可用单词数量 (${effectiveTotalPool})`
          : null
    : null;

  const isMeaningSelect = selectedType === 'meaning-select';
  const meaningSelectValidationError = isMeaningSelect
    ? meaningSelectN === '' || meaningSelectN < 1
      ? '至少要有 1 道题'
      : meaningSelectN > 5
        ? '最多只能出 5 道题'
        : meaningSelectN > effectiveTotalPool
          ? `题目数量不能超过可用单词数量 (${effectiveTotalPool})`
          : null
    : null;

  const isMeaningSelectEn = selectedType === 'meaning-select-en';
  const meaningSelectEnValidationError = isMeaningSelectEn
    ? meaningSelectEnN === '' || meaningSelectEnN < 1
      ? '至少要有 1 道题'
      : meaningSelectEnN > 5
        ? '最多只能出 5 道题'
        : meaningSelectEnN > effectiveTotalPool
          ? `题目数量不能超过可用单词数量 (${effectiveTotalPool})`
          : null
    : null;

  const validationError = fillBlankValidationError || translateValidationError || meaningSelectValidationError || meaningSelectEnValidationError;

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
    {
      id: 'meaning-select' as const,
      title: '英译中',
      description: '从 4 个中文释义中选择正确的意思',
      icon: ListFilter,
    },
    {
      id: 'meaning-select-en' as const,
      title: '英英释义',
      description: '从 4 个英文释义中选择正确的意思',
      icon: ListFilter,
    },
  ];

  const handleGenerate = () => {
    if (!selectedType || validationError) return;
    const options: QuestionGenerationOptions = {
      type: selectedType,
      includeRelatedWords,
      allowFormChange: selectedType === 'fill-blank' ? allowFormChange : false,
    };
    if (selectedType === 'fill-blank') {
      options.fillBlank = { n: typeof questionN === 'number' ? questionN : 1, m: typeof questionM === 'number' ? questionM : 0 };
    } else if (selectedType === 'translate') {
      options.translate = { n: typeof translateN === 'number' ? translateN : 5 };
    } else if (selectedType === 'meaning-select') {
      options.meaningSelect = { n: typeof meaningSelectN === 'number' ? meaningSelectN : 5 };
    } else if (selectedType === 'meaning-select-en') {
      options.meaningSelectEn = { n: typeof meaningSelectEnN === 'number' ? meaningSelectEnN : 5 };
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
          {/* 通用选项 - 在题型选择之前展示 */}
          <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              选项设置
            </h4>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeRelatedWords}
                onChange={(e) => setIncludeRelatedWords(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                包含这些词的关联词
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                — 关联词会以较低概率被随机抽取加入单词列表，AI 可考察其任意释义
                {effectiveRelatedCount > 0 && `（当前有 ${effectiveRelatedCount} 个关联词可用）`}
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {questionTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`group flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 shadow-lg'
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-green-500 dark:hover:border-green-400 hover:shadow-lg'
                  }`}
                >
                  <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 ${
                    isSelected
                      ? 'bg-green-500 dark:bg-green-600 text-white shadow-sm'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-800/40'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
                      {type.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                      {type.description}
                    </p>
                  </div>
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
              {/* 允许改变形式 - 仅适用于选词填空 */}
              <label className="flex items-center gap-3 cursor-pointer select-none mb-4">
                <input
                  type="checkbox"
                  checked={allowFormChange}
                  onChange={(e) => setAllowFormChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 accent-green-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  允许改变形式
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  — 以一定概率允许单词变为不同形式（如不同时态、动词/名词形式等）
                </span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    题目数量 n（需回答的句子数）
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={11}
                    value={questionN}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty string or valid positive integers
                      if (val === '') {
                        setQuestionN('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(1, Math.min(11, parseInt(val) || 1));
                        setQuestionN(numVal);
                      }
                      // Ignore invalid input (non-numeric characters)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    干扰词数量 m（多余单词数）
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    value={questionM}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty string or valid non-negative integers
                      if (val === '') {
                        setQuestionM('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(0, Math.min(11, parseInt(val) || 0));
                        setQuestionM(numVal);
                      }
                      // Ignore invalid input (non-numeric characters)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                共需 n + m = {totalWords} 个单词（n 道题，m 个干扰词）
                {includeRelatedWords && effectiveRelatedCount > 0
                  ? `，可用单词池：${effectiveMaxWords} + ${effectiveRelatedCount} 关联词 = ${effectiveTotalPool}`
                  : `，当前选中 ${effectiveMaxWords} 个单词`}
              </p>
              {validationError && (
                <p className="text-xs text-red-500 mt-1">{validationError}</p>
              )}
            </div>
          )}

          {/* 翻译句子参数 */}
          {selectedType === 'translate' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目参数设置
              </h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  题目数量 n
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  value={translateN ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    // 空输入时设置为空字符串，有效数字输入时解析为数字
                    if (val === '') {
                      setTranslateN('');
                    } else if (/^\d+$/.test(val)) {
                      const numVal = parseInt(val) || 1;
                      setTranslateN(numVal);
                    }
                    // 忽略无效输入（非数字字符）
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {translateValidationError && (
                  <p className="text-xs text-red-500 mt-1">{translateValidationError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                将生成 {typeof translateN === 'number' ? translateN : 0} 道翻译小题，每题恰好一个必用单词
              </p>
            </div>
          )}

          {/* 英译中参数 */}
          {selectedType === 'meaning-select' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目参数设置
              </h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  题目数量 n
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  value={meaningSelectN ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setMeaningSelectN('');
                    } else if (/^\d+$/.test(val)) {
                      const numVal = parseInt(val) || 1;
                      setMeaningSelectN(numVal);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {meaningSelectValidationError && (
                  <p className="text-xs text-red-500 mt-1">{meaningSelectValidationError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                将生成 {typeof meaningSelectN === 'number' ? meaningSelectN : 0} 道英译中小题，每题 4 个选项
              </p>
            </div>
          )}

          {/* 英英释义参数 */}
          {selectedType === 'meaning-select-en' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目参数设置
              </h4>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  题目数量 n
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  value={meaningSelectEnN ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setMeaningSelectEnN('');
                    } else if (/^\d+$/.test(val)) {
                      const numVal = parseInt(val) || 1;
                      setMeaningSelectEnN(numVal);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {meaningSelectEnValidationError && (
                  <p className="text-xs text-red-500 mt-1">{meaningSelectEnValidationError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                将生成 {typeof meaningSelectEnN === 'number' ? meaningSelectEnN : 0} 道英英释义小题，每题 4 个选项
              </p>
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
                ? `生成选词填空（${typeof questionN === 'number' ? questionN : 0} 道小题，${typeof questionM === 'number' ? questionM : 0} 个干扰词）`
                : selectedType === 'meaning-select'
                  ? `生成英译中（${typeof meaningSelectN === 'number' ? meaningSelectN : 0} 道小题）`
                  : selectedType === 'meaning-select-en'
                    ? `生成英英释义（${typeof meaningSelectEnN === 'number' ? meaningSelectEnN : 0} 道小题）`
                    : `生成翻译句子题目（${typeof translateN === 'number' ? translateN : 0} 道小题）`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
