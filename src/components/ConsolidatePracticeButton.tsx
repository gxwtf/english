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

  const handleGenerate = useCallback(async (options: QuestionGenerationOptions) => {
    setShowSelector(false);

    try {
      let pendingItem;
      let questionType: QuestionType;

      switch (options.type) {
        case 'fill-blank': {
          const fillBlankOptions = options.fillBlank ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingFillBlank(
            wordIds, fillBlankOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'fill-blank';
          break;
        }
        case 'translate': {
          const translateOptions = options.translate ?? { n: 5 };
          pendingItem = await enqueuePendingTranslate(
            wordIds, translateOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'translate';
          break;
        }
        case 'meaning-select': {
          pendingItem = await enqueuePendingMeaningSelect(
            wordIds, options.deepThinking, relatedWordEntries
          );
          questionType = 'meaning-select';
          break;
        }
        case 'meaning-select-en': {
          pendingItem = await enqueuePendingMeaningSelectEn(
            wordIds, options.deepThinking, relatedWordEntries
          );
          questionType = 'meaning-select-en';
          break;
        }
        case 'definition-fill-blank': {
          const definitionFillBlankOptions = options.definitionFillBlank ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingDefinitionFillBlank(
            wordIds, definitionFillBlankOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'definition-fill-blank';
          break;
        }
        case 'word-select-translate': {
          const wordSelectTranslateOptions = options.wordSelectTranslate ?? { n: 5, m: 0 };
          pendingItem = await enqueuePendingWordSelectTranslate(
            wordIds, wordSelectTranslateOptions, options.deepThinking, relatedWordEntries
          );
          questionType = 'word-select-translate';
          break;
        }
        case 'word-card': {
          // 单词卡片不需要 AI 生成，直接创建
          const cardQuestion = await createWordCardQuestion(wordIds, relatedWordEntries);
          // 跳转到题目列表页面
          router.push('/practice');
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
        wordIds,
        options,
        relatedWordEntries,
      };
      const existing = JSON.parse(sessionStorage.getItem('pendingQuestions') || '[]');
      existing.push(pendingItemData);
      sessionStorage.setItem('pendingQuestions', JSON.stringify(existing));

      // 跳转到题目列表页面，等待题目生成完成
      router.push('/practice');
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
          onClick={() => setShowSelector(true)}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-xl shadow-md hover:shadow-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed h-auto"
        >
          <GraduationCap className="h-5 w-5" />
          巩固练习
        </Button>
      </div>

      <AIQuestionTypeSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        onGenerate={handleGenerate}
        maxWords={wordIds.length}
        relatedWordsCount={relatedWordEntries.length}
      />
    </>
  );
}