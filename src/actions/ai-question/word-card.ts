'use server';

import { fetchEnrichedWords, enqueueQuestion } from './utils';
import type { RelatedWordEntry } from '@/lib/word-selection';
import type { Meaning } from '@/types/dict';
import { prisma } from '@/lib/db';
import { query as queryDict } from '@/lib/dict/query';

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
    const relatedTextToMeanings = new Map<string, Meaning[]>();
    if (owner) {
      const relatedTexts = relatedWordEntries.map((rw) => rw.text);
      const relatedWords = await prisma.word.findMany({
        where: {
          userId: owner.userId,
          text: { in: relatedTexts, mode: 'insensitive' },
        },
        select: { id: true, text: true, meanings: true },
      });
      for (const rw of relatedWords) {
        relatedTextToId.set(rw.text.toLowerCase(), rw.id);
        relatedTextToMeanings.set(
          rw.text.toLowerCase(),
          (rw.meanings as unknown as Meaning[]) ?? [],
        );
      }
    }

    const startId = allCards.length + 1;
    for (let i = 0; i < relatedWordEntries.length; i++) {
      const rw = relatedWordEntries[i];
      // 关联词释义：优先使用词库中的释义，否则回退到词典释义。
      // 注意不能使用来源词的释义，否则会把来源词的释义错误地标注在关联词上。
      const key = rw.text.toLowerCase();
      const ownMeanings = relatedTextToMeanings.get(key);
      let meanings: Meaning[];
      if (ownMeanings && ownMeanings.length > 0) {
        meanings = ownMeanings;
      } else {
        const dictEntry = queryDict(rw.text);
        meanings = dictEntry
          ? dictEntry.meaning.map((m) => ({ type: m.type, content: m.content }))
          : [];
      }
      allCards.push({
        id: startId + i,
        wordId: relatedTextToId.get(key) ?? null,
        word: rw.text,
        meanings,
      });
    }
  }

  const content: WordCardQuestion = {
    title: '单词卡片',
    cards: allCards,
  };

  // 单词卡片通过逐张标记「会/不会」完成，创建时保持未作答状态
  const allWordIds = [...wordIds];
  const result = await enqueueQuestion(content, 'word-card', allWordIds, 'GENERATED');

  return result;
}
