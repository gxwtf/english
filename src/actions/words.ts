'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import { Word, RelatedWordType } from '@/types/word';
import { Meaning } from '@/types/dict';
import { getWordInfo, type WordInfo } from '@/lib/word.service';

export async function getWordInfoById(wordId: number): Promise<WordInfo | null> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  return getWordInfo(user.userId, wordId);
}

function buildWordResult(
  word: { id: number; text: string; wordTags: { tag: { name: string } }[]; meanings: any[] },
  relatedWordsList: { text: string; type: string }[],
): Word {
  return {
    id: word.id,
    text: word.text,
    tags: word.wordTags.map((wt) => wt.tag.name),
    meanings: word.meanings as Meaning[],
    relatedWords: relatedWordsList.map((rw) => ({
      text: rw.text,
      type: rw.type as RelatedWordType,
    })),
  };
}

// GET /api/words -> loadWords
export async function loadWords(): Promise<Word[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const words = await prisma.word.findMany({
    where: { userId: user.userId },
    include: {
      wordTags: { include: { tag: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const relatedWordsDb = await prisma.relatedWord.findMany({
    where: { userId: user.userId },
  });

  return words.map((word: any) => {
    const wordRelated = relatedWordsDb
      .filter((rw: any) => rw.wordText === word.text)
      .map((rw: any) => ({
        text: rw.relatedText,
        type: rw.type as string,
      }));
    return buildWordResult(word, wordRelated);
  });
}

// POST /api/words -> saveWord
export async function saveWord(data: {
  text: string;
  tags?: string[];
  meanings?: Meaning[];
  relatedWords?: { text: string; type: string }[];
}): Promise<Word> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const userId = user.userId;
  const { text, tags = [], meanings = [], relatedWords } = data;
  const textTrim = text.trim();

  if (!textTrim) throw new Error('单词不能为空');

  const rwData = relatedWords ?? [];

  // Always clean up and recreate related words
  await prisma.relatedWord.deleteMany({
    where: { userId, wordText: textTrim },
  });

  if (rwData.length > 0) {
    await prisma.relatedWord.createMany({
      data: rwData.map((rw) => ({
        userId,
        wordText: textTrim,
        relatedText: rw.text,
        type: rw.type,
      })),
    });
  }

  // Upsert word (update or create)
  const existing = await prisma.word.findFirst({
    where: { userId, text: textTrim },
  });

  if (existing) {
    await prisma.word.update({
      where: { id: existing.id },
      data: {
        meanings: meanings as any,
        wordTags: {
          deleteMany: {},
          create: tags.map((tag: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag, colorId: 'blue' },
              },
            },
          })),
        },
      },
    });
  } else {
    await prisma.word.create({
      data: {
        userId,
        text: textTrim,
        meanings: meanings as any,
        wordTags: {
          create: tags.map((tag: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag, colorId: 'blue' },
              },
            },
          })),
        },
      },
    });
  }

  // Re-fetch final result
  const resultWord = await prisma.word.findFirstOrThrow({
    where: { userId, text: textTrim },
    include: { wordTags: { include: { tag: true } } },
  });

  return buildWordResult(resultWord, rwData);
}

// DELETE /api/words -> deleteWords
export async function deleteWords(ids: number[]) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const words = await prisma.word.findMany({
    where: { id: { in: ids }, userId: user.userId },
    select: { text: true },
  });

  await prisma.word.deleteMany({
    where: { id: { in: ids }, userId: user.userId },
  });

  for (const word of words) {
    await prisma.relatedWord.deleteMany({
      where: { userId: user.userId, wordText: word.text },
    });
  }

  return { success: true };
}

// GET /api/tags/config -> loadTagConfigs
export async function loadTagConfigs() {
  const user = await getAuthUser();
  if (!user) return {};

  const tagConfigs = await prisma.tagConfig.findMany({
    where: { userId: user.userId },
  });

  const result: Record<string, any> = {};
  for (const tag of tagConfigs) {
    result[tag.name] = {
      id: tag.name,
      name: tag.name,
      colorId: tag.colorId,
      description: tag.description || tag.name,
    };
  }

  return result;
}

// POST /api/tags/config -> saveTagConfigs
export async function saveTagConfigs(tagConfigs: Record<string, { name: string; colorId: string; description?: string }>) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  await prisma.tagConfig.deleteMany({
    where: { userId: user.userId },
  });

  if (tagConfigs && typeof tagConfigs === 'object') {
    const entries = Object.entries(tagConfigs);
    if (entries.length > 0) {
      await prisma.tagConfig.createMany({
        data: entries.map(([, config]: [string, any]) => ({
          userId: user.userId,
          name: config.name || config.id,
          colorId: config.colorId || 'blue',
          description: config.description,
        })),
      });
    }
  }

  const updated = await prisma.tagConfig.findMany({
    where: { userId: user.userId },
  });

  const result: Record<string, any> = {};
  for (const tag of updated) {
    result[tag.name] = {
      id: tag.name,
      name: tag.name,
      colorId: tag.colorId,
      description: tag.description || tag.name,
    };
  }

  return result;
}

// 批量更新单词标签
export async function updateWordTags(wordIds: number[], tags: string[]): Promise<Word[]> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const userId = user.userId;

  // 更新每个单词的标签
  for (const wordId of wordIds) {
    const word = await prisma.word.findFirst({
      where: { id: wordId, userId },
    });

    if (!word) continue;

    await prisma.word.update({
      where: { id: wordId },
      data: {
        wordTags: {
          deleteMany: {},
          create: tags.map((tag: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag, colorId: 'blue' },
              },
            },
          })),
        },
      },
    });
  }

  // 返回更新后的单词列表
  const updatedWords = await prisma.word.findMany({
    where: { id: { in: wordIds }, userId },
    include: {
      wordTags: { include: { tag: true } },
    },
  });

  const relatedWordsDb = await prisma.relatedWord.findMany({
    where: { userId },
  });

  return updatedWords.map((word: any) => {
    const wordRelated = relatedWordsDb
      .filter((rw: any) => rw.wordText === word.text)
      .map((rw: any) => ({
        text: rw.relatedText,
        type: rw.type as string,
      }));
    return buildWordResult(word, wordRelated);
  });
}
