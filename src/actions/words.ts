'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import { Word, RelatedWordType } from '@/types/word';
import { Meaning } from '@/types/dict';
import { normalizeMeanings } from '@/lib/meanings';
import { getWordInfo, type WordInfo } from '@/lib/word.service';

export async function getWordInfoById(wordId: number): Promise<WordInfo | null> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  return getWordInfo(user.userId, wordId);
}

function buildWordResult(
  word: { id: number; text: string; wordTags: { tag: { name: string } }[]; meanings: any[]; updatedAt: Date },
  relatedWordsList: { text: string; type: string }[],
): Word {
  return {
    id: word.id,
    text: word.text,
    tags: word.wordTags.map((wt) => wt.tag.name),
    meanings: normalizeMeanings(word.meanings),
    relatedWords: relatedWordsList.map((rw) => ({
      text: rw.text,
      type: rw.type as RelatedWordType,
    })),
    updatedAt: word.updatedAt.toISOString(),
  };
}

/**
 * 收集某个单词的关联词（双向）。
 * 关联关系（容易混淆 / 不同形式）本质是对称的，但数据库只存了用户录入的方向，
 * 因此读取时把「我指向别人」和「别人指向我」两个方向都算作关联词。
 */
function buildRelatedForWord(
  relatedWordsDb: { wordText: string; relatedText: string; type: string }[],
  wordText: string,
): { text: string; type: string }[] {
  const seen = new Set<string>();
  const result: { text: string; type: string }[] = [];
  const push = (text: string, type: string) => {
    if (text.toLowerCase() === wordText.toLowerCase()) return;
    const key = `${text.toLowerCase()}\u0000${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ text, type });
  };

  for (const rw of relatedWordsDb) {
    if (rw.wordText === wordText) push(rw.relatedText, rw.type);
    if (rw.relatedText === wordText) push(rw.wordText, rw.type);
  }

  return result;
}

// GET /api/words -> loadWords
// 传入 wordbookId / wordbookIds 时只加载对应单词本内的单词（传空数组则返回空），
// 不传时加载用户全部单词
export async function loadWords(wordbookId?: number | number[]): Promise<Word[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const hasScope = wordbookId !== undefined && wordbookId !== null;
  const wordbookIds = !hasScope
    ? []
    : (Array.isArray(wordbookId) ? wordbookId : [wordbookId]).filter((id) =>
        Number.isInteger(id)
      );

  const words = await prisma.word.findMany({
    where: {
      userId: user.userId,
      ...(hasScope
        ? { wordbooks: { some: { wordbookId: { in: wordbookIds } } } }
        : {}),
    },
    include: {
      wordTags: { include: { tag: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });

  const relatedWordsDb = await prisma.relatedWord.findMany({
    where: { userId: user.userId },
  });

  return words.map((word: any) => {
    const wordRelated = buildRelatedForWord(relatedWordsDb, word.text);
    return buildWordResult(word, wordRelated);
  });
}

// POST /api/words -> saveWord
export async function saveWord(data: {
  text: string;
  tags?: string[];
  meanings?: Meaning[];
  relatedWords?: { text: string; type: string }[];
  wordbookId?: number;
  // 编辑已有单词时传 true，用所选释义覆盖；新增/加入其他单词本时默认并集合并
  replaceMeanings?: boolean;
}): Promise<Word> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const userId = user.userId;
  const { text, tags = [], meanings = [], relatedWords, wordbookId, replaceMeanings = false } = data;
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
    // 新增/加入其他单词本时，把所选释义与已有释义取并集，避免覆盖其他单词本已选的释义；
    // 显式编辑该单词时（replaceMeanings=true）则按所选覆盖。
    const previousMeanings = ((existing.meanings as unknown as Meaning[]) ?? []);
    let nextMeanings = meanings;
    if (!replaceMeanings) {
      const keyOf = (m: Meaning) => `${m?.type ?? ''}\u0000${m?.content ?? ''}`;
      const seen = new Set(previousMeanings.map(keyOf));
      nextMeanings = [...previousMeanings];
      for (const m of meanings) {
        const key = keyOf(m);
        if (!seen.has(key)) {
          seen.add(key);
          nextMeanings.push(m);
        }
      }
    }

    await prisma.word.update({
      where: { id: existing.id },
      data: {
        meanings: nextMeanings as any,
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

  // 将单词关联到指定单词本（单词可在多个单词本间共享）
  if (wordbookId) {
    const wordbook = await prisma.wordbook.findFirst({
      where: { id: wordbookId, userId },
    });
    if (wordbook) {
      await prisma.wordbookWord.upsert({
        where: { wordbookId_wordId: { wordbookId, wordId: resultWord.id } },
        create: { wordbookId, wordId: resultWord.id },
        update: {},
      });
      await prisma.wordbook.update({
        where: { id: wordbookId },
        data: { updatedAt: new Date() },
      });
    }
  }

  return buildWordResult(resultWord, rwData);
}

// 把练习中出现的关联词加入用户单词本（用户主动操作，不强制）
// 单词不存在时按传入释义创建，再关联到所选单词本。
export async function addWordToWordbooksByText(params: {
  text: string;
  meanings?: Meaning[];
  wordbookIds: number[];
}): Promise<{ wordId: number; added: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const textTrim = (params.text ?? '').trim();
  if (!textTrim) throw new Error('单词不能为空');

  const validBookIds = Array.from(
    new Set((params.wordbookIds ?? []).map(Number).filter((id) => Number.isInteger(id)))
  );
  if (validBookIds.length === 0) throw new Error('请至少选择一个单词本');

  const userId = user.userId;
  const meanings = params.meanings ?? [];

  const ownedBooks = await prisma.wordbook.findMany({
    where: { id: { in: validBookIds }, userId },
    select: { id: true },
  });
  if (ownedBooks.length === 0) throw new Error('单词本不存在');

  const existing = await prisma.word.findFirst({ where: { userId, text: textTrim } });

  let wordId: number;
  if (existing) {
    wordId = existing.id;
    if (meanings.length > 0) {
      const keyOf = (m: Meaning) => `${m?.type ?? ''}\u0000${m?.content ?? ''}`;
      const previousMeanings = ((existing.meanings as unknown as Meaning[]) ?? []);
      const seen = new Set(previousMeanings.map(keyOf));
      const merged = [...previousMeanings];
      for (const m of meanings) {
        const key = keyOf(m);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(m);
        }
      }
      await prisma.word.update({ where: { id: wordId }, data: { meanings: merged as any } });
    }
  } else {
    const created = await prisma.word.create({
      data: { userId, text: textTrim, meanings: meanings as any },
    });
    wordId = created.id;
  }

  let added = 0;
  for (const wordbookId of ownedBooks.map((b) => b.id)) {
    const res = await prisma.wordbookWord.upsert({
      where: { wordbookId_wordId: { wordbookId, wordId } },
      create: { wordbookId, wordId },
      update: {},
    });
    void res;
    added += 1;
  }

  await prisma.wordbook.updateMany({
    where: { id: { in: ownedBooks.map((b) => b.id) }, userId },
    data: { updatedAt: new Date() },
  });

  return { wordId, added };
}

// 仅更新单词释义（不影响标签、关联词等其他数据）
export async function updateWordMeanings(
  wordId: number,
  meanings: Meaning[]
): Promise<{ success: boolean }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId: user.userId },
    select: { id: true },
  });
  if (!word) throw new Error('单词不存在');

  await prisma.word.update({
    where: { id: wordId },
    data: { meanings: meanings as any },
  });

  return { success: true };
}

// 过滤出仍然存在的单词 ID（用于巩固练习等场景，避免使用已删除的单词）
export async function getExistingWordIds(wordIds: number[]): Promise<number[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const ids = (wordIds ?? []).map(Number).filter((id) => Number.isInteger(id));
  if (ids.length === 0) return [];

  const words = await prisma.word.findMany({
    where: { id: { in: ids }, userId: user.userId },
    select: { id: true },
  });

  const existing = new Set(words.map((w) => w.id));
  return ids.filter((id) => existing.has(id));
}

export type WordWordbook = {
  id: number;
  name: string;
};

// 列出某个单词所处的全部单词本
export async function getWordWordbooks(wordId: number): Promise<WordWordbook[]> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId: user.userId },
    select: { id: true },
  });
  if (!word) throw new Error('单词不存在');

  return prisma.wordbook.findMany({
    where: { userId: user.userId, words: { some: { wordId } } },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
}

// 将单词从指定的一些单词本中删除；
// 若删除后该单词不再属于任何单词本，则同时删除该单词本身。
export async function removeWordFromWordbooks(
  wordId: number,
  wordbookIds: number[]
): Promise<{ removed: number; wordDeleted: boolean }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId: user.userId },
    select: { id: true },
  });
  if (!word) throw new Error('单词不存在');

  const validIds = Array.from(
    new Set((wordbookIds ?? []).map(Number).filter((id) => Number.isInteger(id)))
  );
  if (validIds.length === 0) {
    return { removed: 0, wordDeleted: false };
  }

  const result = await prisma.wordbookWord.deleteMany({
    where: {
      wordId,
      wordbookId: { in: validIds },
      wordbook: { userId: user.userId },
    },
  });

  if (result.count > 0) {
    await prisma.wordbook.updateMany({
      where: { id: { in: validIds }, userId: user.userId },
      data: { updatedAt: new Date() },
    });
  }

  // 已不属于任何单词本时，删除该单词本身，避免留下孤立数据
  const remaining = await prisma.wordbookWord.count({ where: { wordId } });
  if (remaining === 0) {
    await deleteWords([wordId]);
    return { removed: result.count, wordDeleted: true };
  }

  return { removed: result.count, wordDeleted: false };
}

// ===== 单词卡片「太简单了，从单词本删去」+ 撤回 =====

/** 删除快照：客户端持有，撤回时传回以完整恢复（防止误触点错） */
export interface WordRemovalSnapshot {
  wordId: number;
  /** 被移除的单词本 id 列表 */
  wordbookIds: number[];
  /** 以下字段仅当单词本身被连带删除时存在，用于撤回时完整重建 */
  text?: string;
  meanings?: unknown[];
  relatedWords?: unknown;
  relatedWordRows?: { wordText: string; relatedText: string; type: string }[];
  tagIds?: number[];
  reviewState?: {
    repetitions: number;
    ef: number;
    interval: number;
    errorCount: number;
    totalReviews: number;
    correctReviews: number;
    lastReviewedAt: string | null;
  } | null;
}

/**
 * 从指定单词本移除单词（单词卡片「太简单了」按钮使用）。
 * wordbookIds 传 null 表示从所有单词本移除。
 * 若移除后单词不再属于任何单词本，会连带删除单词本身——
 * 删除前把完整数据（释义/关联词/标签/复习状态）打包进快照返回，
 * 供客户端一键撤回。
 */
export async function removeWordFromWordbookForCard(
  wordId: number,
  wordbookIds: number[] | null
): Promise<{ removed: number; wordDeleted: boolean; snapshot: WordRemovalSnapshot }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId: user.userId },
    include: { wordTags: { select: { tagId: true } } },
  });
  if (!word) throw new Error('单词不存在');

  // 目标单词本：null = 从所有单词本移除；否则取交集（仅限自己的单词本）
  let targetIds: number[];
  if (wordbookIds == null) {
    const all = await prisma.wordbookWord.findMany({
      where: { wordId },
      select: { wordbookId: true },
    });
    targetIds = all.map((r) => r.wordbookId);
  } else {
    const valid = Array.from(
      new Set((wordbookIds ?? []).map(Number).filter((id) => Number.isInteger(id)))
    );
    const owned = await prisma.wordbook.findMany({
      where: { id: { in: valid }, userId: user.userId },
      select: { id: true },
    });
    targetIds = owned.map((b) => b.id);
  }

  if (targetIds.length === 0) {
    return { removed: 0, wordDeleted: false, snapshot: { wordId, wordbookIds: [] } };
  }

  // 移除后是否不再属于任何单词本（需要连带删除单词本身）
  const remainingAfter = await prisma.wordbookWord.count({
    where: { wordId, wordbookId: { notIn: targetIds } },
  });

  let snapshot: WordRemovalSnapshot = { wordId, wordbookIds: targetIds };
  if (remainingAfter === 0) {
    const reviewState = await prisma.wordReviewState.findUnique({
      where: { userId_wordId: { userId: user.userId, wordId } },
    });
    // deleteWords 只会删除 wordText 方向的关联词行，快照也只记录这些
    const relatedRows = await prisma.relatedWord.findMany({
      where: { userId: user.userId, wordText: word.text },
      select: { wordText: true, relatedText: true, type: true },
    });
    snapshot = {
      wordId,
      wordbookIds: targetIds,
      text: word.text,
      meanings: word.meanings as unknown[],
      relatedWords: word.relatedWords ?? undefined,
      relatedWordRows: relatedRows,
      tagIds: word.wordTags.map((wt) => wt.tagId),
      reviewState: reviewState
        ? {
            repetitions: reviewState.repetitions,
            ef: reviewState.ef,
            interval: reviewState.interval,
            errorCount: reviewState.errorCount,
            totalReviews: reviewState.totalReviews,
            correctReviews: reviewState.correctReviews,
            lastReviewedAt: reviewState.lastReviewedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  const result = await prisma.wordbookWord.deleteMany({
    where: { wordId, wordbookId: { in: targetIds } },
  });
  await prisma.wordbook.updateMany({
    where: { id: { in: targetIds }, userId: user.userId },
    data: { updatedAt: new Date() },
  });

  if (remainingAfter === 0) {
    await deleteWords([wordId]);
    return { removed: result.count, wordDeleted: true, snapshot };
  }

  return { removed: result.count, wordDeleted: false, snapshot };
}

/**
 * 撤回「太简单了」的删除：恢复单词本关联；
 * 若单词本身被删除过，则连同释义、关联词、标签、复习状态一起重建。
 * 返回（可能新建的）wordId，供前端更新映射。
 */
export async function undoRemoveWordFromWordbook(
  snapshot: WordRemovalSnapshot
): Promise<{ wordId: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  if (!snapshot?.wordbookIds?.length) return { wordId: snapshot?.wordId ?? 0 };

  let wordId = snapshot.wordId;

  // 单词本身被删除的情况：优先复用已再次存在的同名单词，否则完整重建
  if (snapshot.text != null) {
    const existing = await prisma.word.findFirst({
      where: { userId: user.userId, text: snapshot.text },
    });
    if (existing) {
      wordId = existing.id;
    } else {
      const created = await prisma.word.create({
        data: {
          userId: user.userId,
          text: snapshot.text,
          meanings: (snapshot.meanings ?? []) as any,
          relatedWords: (snapshot.relatedWords ?? undefined) as any,
        },
      });
      wordId = created.id;

      if (snapshot.tagIds?.length) {
        const tags = await prisma.tag.findMany({
          where: { id: { in: snapshot.tagIds } },
          select: { id: true },
        });
        if (tags.length > 0) {
          await prisma.wordTag.createMany({
            data: tags.map((t) => ({ wordId, tagId: t.id })),
            skipDuplicates: true,
          });
        }
      }

      if (snapshot.reviewState) {
        try {
          await prisma.wordReviewState.create({
            data: {
              userId: user.userId,
              wordId,
              repetitions: snapshot.reviewState.repetitions,
              ef: snapshot.reviewState.ef,
              interval: snapshot.reviewState.interval,
              errorCount: snapshot.reviewState.errorCount,
              totalReviews: snapshot.reviewState.totalReviews,
              correctReviews: snapshot.reviewState.correctReviews,
              lastReviewedAt: snapshot.reviewState.lastReviewedAt
                ? new Date(snapshot.reviewState.lastReviewedAt)
                : null,
            },
          });
        } catch {
          // 已存在同一条复习状态时忽略
        }
      }

      if (snapshot.relatedWordRows?.length) {
        await prisma.relatedWord.createMany({
          data: snapshot.relatedWordRows.map((r) => ({
            userId: user.userId,
            wordText: r.wordText,
            relatedText: r.relatedText,
            type: r.type,
          })),
        });
      }
    }
  }

  // 恢复单词本关联（仅限自己的单词本）
  const owned = await prisma.wordbook.findMany({
    where: { id: { in: snapshot.wordbookIds }, userId: user.userId },
    select: { id: true },
  });
  if (owned.length > 0) {
    await prisma.wordbookWord.createMany({
      data: owned.map((b) => ({ wordbookId: b.id, wordId })),
      skipDuplicates: true,
    });
    await prisma.wordbook.updateMany({
      where: { id: { in: owned.map((b) => b.id) }, userId: user.userId },
      data: { updatedAt: new Date() },
    });
  }

  return { wordId };
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

export async function countTagUsage(tagName: string): Promise<{ wordCount: number }> {
  const user = await getAuthUser();
  if (!user) return { wordCount: 0 };

  const wordCount = await prisma.wordTag.count({
    where: {
      tag: { name: tagName },
      word: { userId: user.userId }
    }
  });

  return { wordCount };
}

export async function deleteTag(tagName: string): Promise<{ success: boolean }> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  await prisma.tag.deleteMany({
    where: { name: tagName }
  });

  await prisma.tagConfig.deleteMany({
    where: { userId: user.userId, name: tagName }
  });

  return { success: true };
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
    const wordRelated = buildRelatedForWord(relatedWordsDb, word.text);
    return buildWordResult(word, wordRelated);
  });
}
