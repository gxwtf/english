'use server';

import { retryQuestion } from './utils';
import { generateFillBlankWithQuestion } from './fill-blank';
import { generateTranslateWithQuestion } from './translate';
import { generateMeaningSelectWithQuestion } from './meaning-select';
import { generateMeaningSelectEnWithQuestion } from './meaning-select-en';
import { generateDefinitionFillBlankWithQuestion } from './definition-fill-blank';
import { generateWordSelectTranslateWithQuestion } from './word-select-translate';
// word-card 不需要 AI，不需要 retry 流程

interface RetryResult {
  id: string;
  questionType: string;
  wordIds: number[];
  relatedWordEntries: any[];
}

function startGenerate(item: RetryResult) {
  const { id, questionType, wordIds } = item;
  const relatedWordEntries = item.relatedWordEntries || [];
  const wordCount = wordIds?.length || 2;
  const n = Math.min(1, wordCount);
  const m = Math.max(0, wordCount - n);

  // 不 await，让 AI Queue 在后台并行处理
  switch (questionType) {
    case 'fill-blank': {
      generateFillBlankWithQuestion(id, wordIds, { n, m }, undefined, undefined, relatedWordEntries, undefined);
      break;
    }
    case 'translate': {
      generateTranslateWithQuestion(id, wordIds, { n }, undefined, undefined, relatedWordEntries);
      break;
    }
    case 'meaning-select': {
      generateMeaningSelectWithQuestion(id, wordIds, { n }, undefined, relatedWordEntries);
      break;
    }
    case 'meaning-select-en': {
      generateMeaningSelectEnWithQuestion(id, wordIds, { n }, undefined, relatedWordEntries);
      break;
    }
    case 'definition-fill-blank': {
      generateDefinitionFillBlankWithQuestion(id, wordIds, { n, m }, undefined, undefined, relatedWordEntries);
      break;
    }
    case 'word-select-translate': {
      generateWordSelectTranslateWithQuestion(id, wordIds, { n, m }, undefined, undefined, relatedWordEntries);
      break;
    }
    case 'word-card': {
      // word-card 不需要 AI，不需要 retry
      break;
    }
  }
}

/**
 * 批量重试失败的题目，并在服务器端并行启动 AI 生成。
 * 由于 Next.js 客户端会顺序调度多个 Server Action，需要在单个 Server Action 中完成重试和生成启动。
 */
export async function retryQuestionsAndGenerate(questionIds: string[]): Promise<RetryResult[]> {
  if (!questionIds?.length) return [];

  const results: RetryResult[] = [];
  for (const questionId of questionIds) {
    try {
      const result = await retryQuestion(questionId);
      const item: RetryResult = {
        id: result.id,
        questionType: result.questionType,
        wordIds: result.wordIds,
        relatedWordEntries: result.relatedWordEntries || [],
      };
      results.push(item);
    } catch (error) {
      console.error(`批量重试中题目 ${questionId} 失败:`, error);
    }
  }

  // 并行启动所有 AI 生成任务
  for (const item of results) {
    startGenerate(item);
  }

  return results;
}
