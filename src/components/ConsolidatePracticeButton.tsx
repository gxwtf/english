'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AIQuestionTypeSelector, type QuestionGenerationOptions } from '@/components/AIQuestionTypeSelector';
import { Button } from '@/components/ui/button';
import {
  enqueuePendingFillBlank,
  enqueuePendingTranslate,
  enqueuePendingMeaningSelect,
  enqueuePendingMeaningSelectEn,
  enqueuePendingDefinitionFillBlank,
  enqueuePendingWordSelectTranslate,
  createWordCardQuestion,
} from '@/actions/ai-question';
import { selectWordIdsFromPool } from '@/lib/word-selection';
import { getExistingWordIds } from '@/actions/words';
import { GraduationCap } from 'lucide-react';
import type { QuestionType } from '@/types/word';

interface RelatedWordEntry {
  text: string;
  types: string[];
  sourceWords: string[];
}

interface ConsolidatePracticeButtonProps {
  wordIds: number[];
  relatedWordEntries: RelatedWordEntry[];
  disabled?: boolean;
}

export function ConsolidatePracticeButton({ wordIds, relatedWordEntries, disabled }: ConsolidatePracticeButtonProps) {
  const router = useRouter();
  const [showSelector, setShowSelector] = useState(false);
  const [validWordCount, setValidWordCount] = useState(wordIds.length);

  const handleOpenSelector = useCallback(async () => {
    try {
      const validIds = await getExistingWordIds(wordIds);
      if (validIds.length === 0) {
        alert('本次涉及的单词已被删除，无法继续练习');
        return;
      }
      setValidWordCount(validIds.length);
      setShowSelector(true);
    } catch (error) {
      console.error('加载可练习单词失败:', error);
      alert('加载失败，请稍后重试');
    }
  }, [wordIds]);

  const handleGenerate = useCallback(async (options: QuestionGenerationOptions) => {
    setShowSelector(false);

    try {
      // 过滤掉已被删除的单词，避免用已删除的单词出题
      const validWordIds = await getExistingWordIds(wordIds);
      if (validWordIds.length === 0) {
        alert('本次涉及的单词已被删除，无法继续练习');
        return;
      }

      let pendingItem;
      let questionType: QuestionType;

      switch (options.type) {
        case 'fill-blank': {
          const fillBlankOptions = options.fillBlank ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingFillBlank(
            validWordIds, fillBlankOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'fill-blank';
          break;
        }
        case 'translate': {
          const translateOptions = options.translate ?? { n: 5 };
          pendingItem = await enqueuePendingTranslate(
            validWordIds, translateOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'translate';
          break;
        }
        case 'meaning-select': {
          pendingItem = await enqueuePendingMeaningSelect(
            validWordIds, options.meaningSelect, options.deepThinking, relatedWordEntries
          );
          questionType = 'meaning-select';
          break;
        }
        case 'meaning-select-en': {
          pendingItem = await enqueuePendingMeaningSelectEn(
            validWordIds, options.meaningSelectEn, options.deepThinking, relatedWordEntries
          );
          questionType = 'meaning-select-en';
          break;
        }
        case 'definition-fill-blank': {
          const definitionFillBlankOptions = options.definitionFillBlank ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingDefinitionFillBlank(
            validWordIds, definitionFillBlankOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'definition-fill-blank';
          break;
        }
        case 'word-select-translate': {
          const wordSelectTranslateOptions = options.wordSelectTranslate ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingWordSelectTranslate(
            validWordIds, wordSelectTranslateOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'word-select-translate';
          break;
        }
        case 'word-card': {
          // 单词卡片不需要 AI 生成，直接创建
          // 支持指定卡片数量：从本次涉及的单词中加权抽取 n 个
          const cardCount = Math.max(
            1,
            Math.min(options.wordCard?.n ?? validWordIds.length, validWordIds.length)
          );
          const selectedIds = await selectWordIdsFromPool(
            validWordIds,
            cardCount,
            options.useSpacedRepetition
          );
          const wordCardResult = await createWordCardQuestion(selectedIds, relatedWordEntries);
          // 跳转到单词卡片页面
          router.push(`/practice/${wordCardResult.id}`);
          return;
        }
        default: {
          throw new Error(`不支持的题目类型: ${options.type}`);
        }
      }

      // 将题目信息存入 sessionStorage，practice 页面会自动处理
      const pendingItemData = {
        questionId: pendingItem.id,
        questionType,
        wordIds: validWordIds,
        options,
        relatedWordEntries,
      };
      const existing = JSON.parse(sessionStorage.getItem('pendingQuestions') || '[]');
      existing.push(pendingItemData);
      sessionStorage.setItem('pendingQuestions', JSON.stringify(existing));

      // 跳转到题目页面，等待题目生成完成
      router.push(`/practice/${pendingItem.id}`);
    } catch (error) {
      console.error('创建巩固练习题目失败:', error);
      alert('创建题目失败，请稍后重试');
    }
  }, [wordIds, relatedWordEntries, router]);

  return (
    <>
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            想要继续练习这些单词？
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            点击下方按钮，选择其他题型继续练习本次涉及的单词
          </p>
        </div>
        <Button
          onClick={handleOpenSelector}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-xl shadow-md hover:shadow-lg bg-gradient-to-r from-brand-crimson to-brand-orange hover:from-brand-red hover:to-brand-orange text-white disabled:opacity-50 disabled:cursor-not-allowed h-auto"
        >
          <GraduationCap className="h-5 w-5" />
          巩固练习
        </Button>
      </div>

      <AIQuestionTypeSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        onGenerate={handleGenerate}
        maxWords={validWordCount}
        relatedWordsCount={relatedWordEntries.length}
      />
    </>
  );
}