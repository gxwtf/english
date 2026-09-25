'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import { Wordbook } from '@/types/word';
import { importSystemWordsToWordbook } from '@/lib/system-wordbook-import';

async function buildWordbookSummary(wordbook: {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  words: { word: { text: string } }[];
}): Promise<Wordbook> {
  return {
    id: wordbook.id,
    name: wordbook.name,
    wordCount: wordbook.words.length,
    previewWords: wordbook.words.slice(0, 6).map((ww) => ww.word.text),
    createdAt: wordbook.createdAt.toISOString(),
    updatedAt: wordbook.updatedAt.toISOString(),
  };
}

// 加载当前用户的所有单词本
export async function loadWordbooks(): Promise<Wordbook[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const wordbooks = await prisma.wordbook.findMany({
    where: { userId: user.userId },
    include: {
      words: {
        include: { word: { select: { text: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return Promise.all(wordbooks.map(buildWordbookSummary));
}

// 加载单个单词本
export async function getWordbook(id: number): Promise<Wordbook | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const wordbook = await prisma.wordbook.findFirst({
    where: { id, userId: user.userId },
    include: {
      words: {
        include: { word: { select: { text: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      },
    },
  });

  if (!wordbook) return null;
  return buildWordbookSummary(wordbook);
}

// 新建单词本
// 传入 systemWordbookId 时，会把该系统单词本的全部单词复制一份到新单词本
export async function createWordbook(
  name: string,
  systemWordbookId?: number,
): Promise<Wordbook> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const nameTrim = name.trim();
  if (!nameTrim) throw new Error('单词本名称不能为空');

  const existing = await prisma.wordbook.findFirst({
    where: { userId: user.userId, name: nameTrim },
  });
  if (existing) throw new Error('已存在同名单词本');

  const created = await prisma.wordbook.create({
    data: { userId: user.userId, name: nameTrim },
    include: { words: { include: { word: { select: { text: true } } }, orderBy: { id: 'asc' } } },
  });

  if (systemWordbookId) {
    const systemWordbook = await prisma.systemWordbook.findUnique({
      where: { id: systemWordbookId },
    });
    if (!systemWordbook) {
      await prisma.wordbook.delete({ where: { id: created.id } });
      throw new Error('系统单词本不存在');
    }

    await importSystemWordsToWordbook(user.userId, created.id, systemWordbookId);

    const refreshed = await prisma.wordbook.findUniqueOrThrow({
      where: { id: created.id },
      include: { words: { include: { word: { select: { text: true } } }, orderBy: { id: 'asc' } } },
    });
    return buildWordbookSummary(refreshed);
  }

  return buildWordbookSummary(created);
}

// 重命名单词本
export async function renameWordbook(id: number, name: string): Promise<Wordbook> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const nameTrim = name.trim();
  if (!nameTrim) throw new Error('单词本名称不能为空');

  const wordbook = await prisma.wordbook.findFirst({
    where: { id, userId: user.userId },
  });
  if (!wordbook) throw new Error('单词本不存在');

  const duplicate = await prisma.wordbook.findFirst({
    where: { userId: user.userId, name: nameTrim, id: { not: id } },
  });
  if (duplicate) throw new Error('已存在同名单词本');

  const updated = await prisma.wordbook.update({
    where: { id },
    data: { name: nameTrim },
    include: { words: { include: { word: { select: { text: true } } }, orderBy: { id: 'asc' } } },
  });

  return buildWordbookSummary(updated);
}

// 删除单词本
// 仅属于该单词本的单词会被一并删除；被其他单词本共享的单词只解除关联并保留
export async function deleteWordbook(id: number): Promise<{ success: boolean; deletedWords: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const wordbook = await prisma.wordbook.findFirst({
    where: { id, userId: user.userId },
  });
  if (!wordbook) throw new Error('单词本不存在');

  return prisma.$transaction(async (tx) => {
    // 该单词本内的所有单词
    const links = await tx.wordbookWord.findMany({
      where: { wordbookId: id },
      select: { wordId: true },
    });
    const wordIds = links.map((l) => l.wordId);

    let exclusiveWordIds: number[] = [];
    if (wordIds.length > 0) {
      // 找出同时存在于其他单词本的单词，其余即为独占单词
      const shared = await tx.wordbookWord.findMany({
        where: { wordId: { in: wordIds }, wordbookId: { not: id } },
        select: { wordId: true },
      });
      const sharedIds = new Set(shared.map((s) => s.wordId));
      exclusiveWordIds = wordIds.filter((wid) => !sharedIds.has(wid));
    }

    let deletedWords = 0;
    if (exclusiveWordIds.length > 0) {
      const words = await tx.word.findMany({
        where: { id: { in: exclusiveWordIds }, userId: user.userId },
        select: { id: true, text: true },
      });

      await tx.word.deleteMany({
        where: { id: { in: exclusiveWordIds }, userId: user.userId },
      });

      // 清理这些单词的关联词（RelatedWord 以 userId + wordText 关联，无外键级联）
      for (const w of words) {
        await tx.relatedWord.deleteMany({
          where: { userId: user.userId, wordText: w.text },
        });
      }

      deletedWords = words.length;
    }

    // 删除单词本（级联删除剩余关联，共享单词保留）
    await tx.wordbook.delete({
      where: { id },
    });

    return { success: true, deletedWords };
  });
}

// 将单词加入单词本（单词可在多个单词本间共享）
export async function addWordsToWordbook(wordbookId: number, wordIds: number[]): Promise<{ added: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const wordbook = await prisma.wordbook.findFirst({
    where: { id: wordbookId, userId: user.userId },
  });
  if (!wordbook) throw new Error('单词本不存在');

  const ownedWords = await prisma.word.findMany({
    where: { id: { in: wordIds }, userId: user.userId },
    select: { id: true },
  });

  const existing = await prisma.wordbookWord.findMany({
    where: { wordbookId, wordId: { in: ownedWords.map((w) => w.id) } },
    select: { wordId: true },
  });
  const existingIds = new Set(existing.map((e) => e.wordId));
  const toAdd = ownedWords.filter((w) => !existingIds.has(w.id));

  if (toAdd.length > 0) {
    await prisma.wordbookWord.createMany({
      data: toAdd.map((w) => ({ wordbookId, wordId: w.id })),
    });
    await prisma.wordbook.update({
      where: { id: wordbookId },
      data: { updatedAt: new Date() },
    });
  }

  return { added: toAdd.length };
}

// 将单词移出单词本（不删除单词本身）
export async function removeWordsFromWordbook(wordbookId: number, wordIds: number[]): Promise<{ removed: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const wordbook = await prisma.wordbook.findFirst({
    where: { id: wordbookId, userId: user.userId },
  });
  if (!wordbook) throw new Error('单词本不存在');

  const result = await prisma.wordbookWord.deleteMany({
    where: { wordbookId, wordId: { in: wordIds } },
  });

  if (result.count > 0) {
    await prisma.wordbook.update({
      where: { id: wordbookId },
      data: { updatedAt: new Date() },
    });
  }

  return { removed: result.count };
}
