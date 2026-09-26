'use client';

import {
  generateFillBlankWithQuestion,
  generateTranslateWithQuestion,
  generateMeaningSelectWithQuestion,
  generateMeaningSelectEnWithQuestion,
  generateDefinitionFillBlankWithQuestion,
  generateWordSelectTranslateWithQuestion,
  markQuestionAsFailed,
} from '@/actions/ai-question';

export interface PendingQuestionItem {
  questionId: string;
  questionType: string;
  wordIds: number[];
  options: any;
  relatedWordEntries: any[];
}

/**
 * 客户端触发单道 AI 题目的生成（不阻塞调用方）。
 * 生成成功/失败会由服务端更新题目状态，调用方通过轮询获取最新状态。
 */
export async function dispatchQuestionGeneration(item: PendingQuestionItem): Promise<void> {
  const { questionId, questionType, wordIds, options, relatedWordEntries } = item;

  try {
    switch (questionType) {
      case 'fill-blank': {
        const fillBlankOptions = options?.fillBlank ?? { n: 5, m: 0 };
        await generateFillBlankWithQuestion(
          questionId, wordIds, fillBlankOptions,
          undefined, options?.deepThinking,
          relatedWordEntries, options?.allowFormChange
        );
        break;
      }
      case 'translate': {
        const translateOptions = options?.translate ?? { n: 5 };
        await generateTranslateWithQuestion(
          questionId, wordIds, translateOptions,
          undefined, options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'meaning-select': {
        const meaningSelectOptions = options?.meaningSelect ?? { n: 5 };
        await generateMeaningSelectWithQuestion(
          questionId, wordIds, meaningSelectOptions,
          options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'meaning-select-en': {
        const meaningSelectEnOptions = options?.meaningSelectEn ?? { n: 5 };
        await generateMeaningSelectEnWithQuestion(
          questionId, wordIds, meaningSelectEnOptions,
          options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'definition-fill-blank': {
        const definitionFillBlankOptions = options?.definitionFillBlank ?? { n: 5, m: 0 };
        await generateDefinitionFillBlankWithQuestion(
          questionId, wordIds, definitionFillBlankOptions,
          undefined, options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'word-select-translate': {
        const wordSelectTranslateOptions = options?.wordSelectTranslate ?? { n: 5, m: 0 };
        await generateWordSelectTranslateWithQuestion(
          questionId, wordIds, wordSelectTranslateOptions,
          undefined, options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'word-card': {
        // word-card 不需要 AI 生成
        break;
      }
      default: {
        console.warn('[dispatchQuestionGeneration] unknown questionType', questionType);
      }
    }
  } catch (error) {
    console.error('AI 出题异常:', error);
    try {
      await markQuestionAsFailed(questionId);
    } catch {
      // ignore
    }
  }
}

/**
 * 从 sessionStorage 中取出指定题目的待生成项，并移除该项。
 */
export function takePendingQuestion(questionId: string): PendingQuestionItem | null {
  const raw = sessionStorage.getItem('pendingQuestions');
  if (!raw) return null;

  let items: PendingQuestionItem[];
  try {
    items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      sessionStorage.removeItem('pendingQuestions');
      return null;
    }
  } catch {
    sessionStorage.removeItem('pendingQuestions');
    return null;
  }

  const index = items.findIndex((it) => it?.questionId === questionId);
  if (index === -1) return null;

  const [found] = items.splice(index, 1);
  if (items.length > 0) {
    sessionStorage.setItem('pendingQuestions', JSON.stringify(items));
  } else {
    sessionStorage.removeItem('pendingQuestions');
  }
  return found;
}

/**
 * 从 sessionStorage 中取出所有待生成项并清空。
 */
export function takeAllPendingQuestions(): PendingQuestionItem[] {
  const raw = sessionStorage.getItem('pendingQuestions');
  if (!raw) return [];

  let items: PendingQuestionItem[];
  try {
    items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      sessionStorage.removeItem('pendingQuestions');
      return [];
    }
  } catch {
    sessionStorage.removeItem('pendingQuestions');
    return [];
  }

  sessionStorage.removeItem('pendingQuestions');
  return items;
}
