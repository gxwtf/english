'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Type, ListFilter, PenLine, Languages, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { QuestionType } from '@/types/word';
import type { FillBlankOptions, TranslateOptions, MeaningSelectOptions, DefinitionFillBlankOptions, WordSelectTranslateOptions, WordCardOptions } from '@/types/problem';

const STORAGE_KEY_INCLUDE_RELATED = 'ai-question-include-related';
const STORAGE_KEY_ALLOW_FORM_CHANGE = 'ai-question-allow-form-change';

export type QuestionGenerationOptions = {
  type: QuestionType;
  fillBlank?: FillBlankOptions;
  translate?: TranslateOptions;
  meaningSelect?: MeaningSelectOptions;
  meaningSelectEn?: MeaningSelectOptions;
  definitionFillBlank?: DefinitionFillBlankOptions;
  wordSelectTranslate?: WordSelectTranslateOptions;
  wordCard?: WordCardOptions;
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
    description: '将中文句子翻译成对应的英文',
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
  {
    id: 'definition-fill-blank' as const,
    title: '词义填空',
    description: '根据英文释义，从候选词中选出正确的单词',
    icon: PenLine,
  },
  {
    id: 'word-select-translate' as const,
    title: '选词翻译句子',
    description: '翻译中文句子，并使用指定的候选单词',
    icon: Languages,
  },
  {
    id: 'word-card' as const,
    title: '单词卡片',
    description: '生成单词卡片，点击翻转查看释义',
    icon: CreditCard,
  },
];

export const AIQuestionTypeSelector = ({ isOpen, onClose, onGenerate, maxWords, relatedWordsCount }: AIQuestionTypeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<QuestionType | null>(null);
  const [questionN, setQuestionN] = useState<number | ''>(5);
  const [questionM, setQuestionM] = useState<number | ''>(0);
  const [translateN, setTranslateN] = useState<number | ''>(5);
  const [meaningSelectN, setMeaningSelectN] = useState<number | ''>(5);
  const [meaningSelectEnN, setMeaningSelectEnN] = useState<number | ''>(5);
  const [definitionFillBlankN, setDefinitionFillBlankN] = useState<number | ''>(5);
  const [definitionFillBlankM, setDefinitionFillBlankM] = useState<number | ''>(0);
  const [wordSelectTranslateN, setWordSelectTranslateN] = useState<number | ''>(5);
  const [wordSelectTranslateM, setWordSelectTranslateM] = useState<number | ''>(0);
  const [includeRelatedWords, setIncludeRelatedWords] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY_INCLUDE_RELATED);
    return stored === 'true';
  });
  const [allowFormChange, setAllowFormChange] = useState<boolean>(() => {
    // 默认开启"允许改变形式"
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY_ALLOW_FORM_CHANGE);
    return stored !== null ? stored === 'true' : true;
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

  // 当可用单词池变化时，自动将各题型的题目数量调整到合法范围
  useEffect(() => {
    const pool = (includeRelatedWords ? (maxWords ?? 11) + (relatedWordsCount ?? 0) : (maxWords ?? 11));
    if (pool < 1) return;
    const n1 = typeof questionN === 'number' ? questionN : 1;
    const m1 = typeof questionM === 'number' ? questionM : 0;
    if (n1 > pool) setQuestionN(Math.max(1, pool));
    if (n1 + m1 > pool) setQuestionM(Math.max(0, pool - Math.min(n1, pool)));
    if (typeof translateN === 'number' && translateN > pool) setTranslateN(Math.min(5, pool));
    if (typeof meaningSelectN === 'number' && meaningSelectN > pool) setMeaningSelectN(Math.min(10, pool));
    if (typeof meaningSelectEnN === 'number' && meaningSelectEnN > pool) setMeaningSelectEnN(Math.min(10, pool));
    const dn = typeof definitionFillBlankN === 'number' ? definitionFillBlankN : 1;
    const dm = typeof definitionFillBlankM === 'number' ? definitionFillBlankM : 0;
    if (dn > pool) setDefinitionFillBlankN(Math.max(1, pool));
    if (dn + dm > pool) setDefinitionFillBlankM(Math.max(0, pool - Math.min(dn, pool)));
    if (typeof wordSelectTranslateN === 'number' && wordSelectTranslateN > pool) setWordSelectTranslateN(Math.min(5, pool));
    const wn = typeof wordSelectTranslateN === 'number' ? wordSelectTranslateN : 1;
    const wm = typeof wordSelectTranslateM === 'number' ? wordSelectTranslateM : 0;
    if (wn + wm > pool) setWordSelectTranslateM(Math.max(0, pool - Math.min(wn, pool)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxWords, relatedWordsCount, includeRelatedWords]);

  const effectiveMaxWords = maxWords ?? 11;
  const effectiveRelatedCount = relatedWordsCount ?? 0;
  const effectiveTotalPool = includeRelatedWords ? effectiveMaxWords + effectiveRelatedCount : effectiveMaxWords;
  const totalWords = (typeof questionN === 'number' ? questionN : 0) + (typeof questionM === 'number' ? questionM : 0);
  const definitionTotalWords = (typeof definitionFillBlankN === 'number' ? definitionFillBlankN : 0) + (typeof definitionFillBlankM === 'number' ? definitionFillBlankM : 0);
  const wordSelectTranslateTotalWords = (typeof wordSelectTranslateN === 'number' ? wordSelectTranslateN : 0) + (typeof wordSelectTranslateM === 'number' ? wordSelectTranslateM : 0);
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
      : meaningSelectN > 10
        ? '最多只能出 10 道题'
        : meaningSelectN > effectiveTotalPool
          ? `题目数量不能超过可用单词数量 (${effectiveTotalPool})`
          : null
    : null;

  const isMeaningSelectEn = selectedType === 'meaning-select-en';
  const meaningSelectEnValidationError = isMeaningSelectEn
    ? meaningSelectEnN === '' || meaningSelectEnN < 1
      ? '至少要有 1 道题'
      : meaningSelectEnN > 10
        ? '最多只能出 10 道题'
        : meaningSelectEnN > effectiveTotalPool
          ? `题目数量不能超过可用单词数量 (${effectiveTotalPool})`
          : null
    : null;

  const isDefinitionFillBlank = selectedType === 'definition-fill-blank';
  const definitionFillBlankValidationError = isDefinitionFillBlank
    ? typeof definitionFillBlankN !== 'number' || definitionFillBlankN < 1
      ? '至少要有 1 道题'
      : definitionTotalWords > effectiveTotalPool
        ? `n + m (${definitionTotalWords}) 不能超过可用单词数量 (${effectiveTotalPool})`
        : definitionTotalWords > 11
          ? `n + m (${definitionTotalWords}) 不能超过 11`
          : null
    : null;

  const isWordSelectTranslate = selectedType === 'word-select-translate';
  const wordSelectTranslateValidationError = isWordSelectTranslate
    ? typeof wordSelectTranslateN !== 'number' || wordSelectTranslateN < 1
      ? '至少要有 1 道题'
      : wordSelectTranslateN > 5
        ? '题目数量不能超过 5'
        : wordSelectTranslateTotalWords > effectiveTotalPool
          ? `n + m (${wordSelectTranslateTotalWords}) 不能超过可用单词数量 (${effectiveTotalPool})`
          : null
    : null;

  const validationError = fillBlankValidationError || translateValidationError || meaningSelectValidationError || meaningSelectEnValidationError || definitionFillBlankValidationError || wordSelectTranslateValidationError;

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
    } else if (selectedType === 'definition-fill-blank') {
      options.definitionFillBlank = { n: typeof definitionFillBlankN === 'number' ? definitionFillBlankN : 5, m: typeof definitionFillBlankM === 'number' ? definitionFillBlankM : 0 };
    } else if (selectedType === 'word-select-translate') {
      options.wordSelectTranslate = { n: typeof wordSelectTranslateN === 'number' ? wordSelectTranslateN : 5, m: typeof wordSelectTranslateM === 'number' ? wordSelectTranslateM : 0 };
    } else if (selectedType === 'word-card') {
      options.wordCard = {};
    }
    onGenerate(options);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
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
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2 h-9 w-9 shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 内容区 - 题目类型选择 */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-90px)]">
          {/* 通用选项 - 在题型选择之前展示 */}
          <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              选项设置
            </h4>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Checkbox
                id="include-related-words"
                checked={includeRelatedWords}
                onCheckedChange={(checked) => setIncludeRelatedWords(!!checked)}
              />
              <label htmlFor="include-related-words" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                包含这些词的关联词
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                — 关联词会以较低概率被随机抽取加入单词列表，AI 可考察其任意释义
                {effectiveRelatedCount > 0 && `（当前有 ${effectiveRelatedCount} 个关联词可用）`}
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none mt-3">
              <Checkbox
                id="allow-form-change"
                checked={allowFormChange}
                onCheckedChange={(checked) => setAllowFormChange(!!checked)}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                允许改变形式
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {questionTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <Button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`group flex items-center gap-3 p-3 rounded-xl h-auto w-full justify-start text-left ${isSelected ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 shadow-lg' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-green-500 dark:hover:border-green-400 hover:shadow-lg'}`}
                >
                  <div className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 ${
                    isSelected
                      ? 'bg-green-500 dark:bg-green-600 text-white shadow-sm'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-800/40'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="font-medium text-sm">{type.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{type.description}</div>
                  </div>
                </Button>
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
                    题目数量 n
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={11}
                    value={questionN}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuestionN('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(1, Math.min(11, parseInt(val) || 1));
                        setQuestionN(numVal);
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    干扰词数量 m（多余单词数）
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    value={questionM}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuestionM('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(0, Math.min(11, parseInt(val) || 0));
                        setQuestionM(numVal);
                      }
                    }}
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
                <Input
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={5}
                  value={translateN ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setTranslateN('');
                    } else if (/^\d+$/.test(val)) {
                      const numVal = parseInt(val) || 1;
                      setTranslateN(numVal);
                    }
                  }}
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
                <Input
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={10}
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
                <Input
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={10}
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

          {/* 词义填空参数 */}
          {selectedType === 'definition-fill-blank' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目参数设置
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    题目数量 n（需回答的释义数）
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={11}
                    value={definitionFillBlankN}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDefinitionFillBlankN('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(1, Math.min(11, parseInt(val) || 1));
                        setDefinitionFillBlankN(numVal);
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    干扰词数量 m（多余单词数）
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    value={definitionFillBlankM}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDefinitionFillBlankM('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(0, Math.min(11, parseInt(val) || 0));
                        setDefinitionFillBlankM(numVal);
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                共需 n + m = {definitionTotalWords} 个单词（n 道题，m 个干扰词）
              </p>
              {definitionFillBlankValidationError && (
                <p className="text-xs text-red-500 mt-1">{definitionFillBlankValidationError}</p>
              )}
            </div>
          )}

          {/* 选词翻译句子参数 */}
          {selectedType === 'word-select-translate' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目参数设置
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    题目数量 n（需回答的句子数）
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={5}
                    value={wordSelectTranslateN}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setWordSelectTranslateN('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(1, Math.min(5, parseInt(val) || 1));
                        setWordSelectTranslateN(numVal);
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    干扰词数量 m（多余单词数）
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    value={wordSelectTranslateM}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setWordSelectTranslateM('');
                      } else if (/^\d+$/.test(val)) {
                        const numVal = Math.max(0, Math.min(11, parseInt(val) || 0));
                        setWordSelectTranslateM(numVal);
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                共需 n + m = {wordSelectTranslateTotalWords} 个单词（n 道题，m 个干扰词）
              </p>
              {wordSelectTranslateValidationError && (
                <p className="text-xs text-red-500 mt-1">{wordSelectTranslateValidationError}</p>
              )}
            </div>
          )}

          {/* 单词卡片参数（不需要参数，只需提示） */}
          {selectedType === 'word-card' && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                题目说明
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                单词卡片直接生成，无需 AI 处理。每个选中的单词生成一张卡片，点击卡片可以翻转查看释义。
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                当前选中 {effectiveMaxWords} 个单词，将生成 {effectiveMaxWords} 张卡片
                {includeRelatedWords && effectiveRelatedCount > 0 && `（关联词 ${effectiveRelatedCount} 个）`}
              </p>
            </div>
          )}

          {/* 生成按钮 */}
          {selectedType && (
            <Button
              onClick={handleGenerate}
              disabled={!!validationError}
              className={`mt-4 w-full py-3 font-semibold rounded-xl shadow-md hover:shadow-lg h-auto ${validationError ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'}`}
            >
              {selectedType === 'fill-blank'
                ? `生成选词填空（${typeof questionN === 'number' ? questionN : 0} 道小题，${typeof questionM === 'number' ? questionM : 0} 个干扰词）`
                : selectedType === 'meaning-select'
                  ? `生成英译中（${typeof meaningSelectN === 'number' ? meaningSelectN : 0} 道小题）`
                  : selectedType === 'meaning-select-en'
                    ? `生成英英释义（${typeof meaningSelectEnN === 'number' ? meaningSelectEnN : 0} 道小题）`
                    : selectedType === 'definition-fill-blank'
                      ? `生成词义填空（${typeof definitionFillBlankN === 'number' ? definitionFillBlankN : 0} 道小题，${typeof definitionFillBlankM === 'number' ? definitionFillBlankM : 0} 个干扰词）`
                      : selectedType === 'word-select-translate'
                        ? `生成选词翻译句子（${typeof wordSelectTranslateN === 'number' ? wordSelectTranslateN : 0} 道小题，${typeof wordSelectTranslateM === 'number' ? wordSelectTranslateM : 0} 个干扰词）`
                        : selectedType === 'word-card'
                          ? `生成单词卡片（${effectiveMaxWords} 张）`
                          : `生成翻译句子题目（${typeof translateN === 'number' ? translateN : 0} 道小题）`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
