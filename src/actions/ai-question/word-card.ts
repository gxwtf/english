'use server';

import { fetchEnrichedWords, enqueueQuestion } from './utils';
import type { RelatedWordEntry } from '@/lib/word-selection';
import type { Meaning } from '@/types/dict';
import { prisma } from '@/lib/db';

export interface WordCardItem {
  id: number;
  /** 对应数据库中的 Word.id；关联词若不在用户词库中则为 null（无法标记复习） */
  wordId: number | null;
  word: string;
  meanings: Meaning[];
}

export interface WordCardQuestion {
  title: string;
  cards: WordCardItem[];
}

/**
 * 直接生成单词卡片题目（不需要 AI）。
 * 单词卡片直接从单词数据生成，无需异步处理。
 */
export async function createWordCardQuestion(
  wordIds: number[],
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) throw new Error('所选单词不存在');

  // 合并关联词数据
  const allCards: WordCardItem[] = [];

  // 核心词卡片
  for (let i = 0; i < wordData.length; i++) {
    allCards.push({
      id: i + 1,
      wordId: wordData[i].id,
      word: wordData[i].text,
      meanings: wordData[i].meanings as unknown as Meaning[],
    });
  }

  // 关联词卡片（如果有）
  if (relatedWordEntries && relatedWordEntries.length > 0) {
    // 解析关联词在用户词库中的真实 wordId（用于标记复习状态）
    const owner = await prisma.word.findUnique({
      where: { id: wordIds[0] },
      select: { userId: true },
    });
    const relatedTextToId = new Map<string, number>();
    if (owner) {
      const relatedTexts = relatedWordEntries.map((rw) => rw.text);
      const relatedWords = await prisma.word.findMany({
        where: {
          userId: owner.userId,
          text: { in: relatedTexts, mode: 'insensitive' },
        },
        select: { id: true, text: true },
      });
      for (const rw of relatedWords) {
        relatedTextToId.set(rw.text.toLowerCase(), rw.id);
      }
    }

    const startId = allCards.length + 1;
    for (let i = 0; i < relatedWordEntries.length; i++) {
      const rw = relatedWordEntries[i];
      // 尝试获取关联词的释义
      const sourceMeanings: Meaning[] = [];
      for (const sourceText of rw.sourceWords) {
        const sourceWord = wordData.find(w => w.text.toLowerCase() === sourceText.toLowerCase());
        if (sourceWord && sourceWord.meanings.length > 0) {
          sourceMeanings.push(...(sourceWord.meanings as unknown as Meaning[]));
        }
      }
      allCards.push({
        id: startId + i,
        wordId: relatedTextToId.get(rw.text.toLowerCase()) ?? null,
        word: rw.text,
        meanings: sourceMeanings.length > 0 ? sourceMeanings : [],
      });
    }
  }

  const content: WordCardQuestion = {
    title: '单词卡片',
    cards: allCards,
  };

  // 单词卡片不需要作答，直接创建为已作答状态
  const allWordIds = [...wordIds];
  const result = await enqueueQuestion(content, 'word-card', allWordIds, 'ANSWERED');

  return result;
}
