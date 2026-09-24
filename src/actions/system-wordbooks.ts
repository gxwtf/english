'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import { Meaning } from '@/types/dict';
import { SystemWordbook } from '@/types/word';
import { chineseToMeanings } from '@/lib/system-word-parse';

interface SystemWordInput {
  text: string;
  phonetic?: string;
  meanings?: Meaning[];
  chinese?: string;
}

function buildSummary(wordbook: {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  words: { text: string }[];
}): SystemWordbook {
  return {
    id: wordbook.id,
    name: wordbook.name,
    description: wordbook.description,
    wordCount: wordbook.words.length,
    previewWords: wordbook.words.slice(0, 6).map((w) => w.text),
    createdAt: wordbook.createdAt.toISOString(),
    updatedAt: wordbook.updatedAt.toISOString(),
  };
}

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  if (user.admin !== 1) throw new Error('无权访问：需要管理员权限');
  return user;
}

// 所有登录用户都可读取系统单词本列表（用于新建单词本时导入）
export async function loadSystemWordbooks(): Promise<SystemWordbook[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const wordbooks = await prisma.systemWordbook.findMany({
    include: {
      words: { select: { text: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return wordbooks.map(buildSummary);
}

// 管理员：读取系统单词本列表
export async function loadSystemWordbooksAdmin(): Promise<SystemWordbook[]> {
  await requireAdmin();

  const wordbooks = await prisma.systemWordbook.findMany({
    include: {
      words: { select: { text: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return wordbooks.map(buildSummary);
}

// 管理员：创建系统单词本（上传）
export async function createSystemWordbook(input: {
  name: string;
  description?: string;
  words: SystemWordInput[];
}): Promise<SystemWordbook> {
  await requireAdmin();

  const name = input.name?.trim();
  if (!name) throw new Error('系统单词本名称不能为空');

  const existing = await prisma.systemWordbook.findUnique({ where: { name } });
  if (existing) throw new Error('已存在同名系统单词本');

  // 归一化并按文本去重（不区分大小写）
  const seen = new Set<string>();
  const normalized: { text: string; phonetic: string | null; meanings: Meaning[] }[] = [];
  for (const w of input.words ?? []) {
    const text = (w.text ?? '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let meanings = Array.isArray(w.meanings) ? w.meanings.filter((m) => m && m.content) : [];
    if (meanings.length === 0 && w.chinese) {
      meanings = chineseToMeanings(w.chinese);
    }
    if (meanings.length === 0) continue;

    normalized.push({
      text,
      phonetic: w.phonetic?.trim() || null,
      meanings,
    });
  }

  if (normalized.length === 0) {
    throw new Error('未解析到任何有效单词，请检查文件格式');
  }

  const created = await prisma.$transaction(async (tx) => {
    const wordbook = await tx.systemWordbook.create({
      data: {
        name,
        description: input.description?.trim() || null,
      },
    });

    const chunkSize = 1000;
    for (let i = 0; i < normalized.length; i += chunkSize) {
      const chunk = normalized.slice(i, i + chunkSize);
      await tx.systemWord.createMany({
        data: chunk.map((w) => ({
          systemWordbookId: wordbook.id,
          text: w.text,
          phonetic: w.phonetic,
          meanings: w.meanings as any,
        })),
      });
    }

    return tx.systemWordbook.findUniqueOrThrow({
      where: { id: wordbook.id },
      include: { words: { select: { text: true }, orderBy: { createdAt: 'asc' } } },
    });
  });

  return buildSummary(created);
}

// 管理员：更新系统单词本信息
export async function updateSystemWordbook(
  id: number,
  data: { name?: string; description?: string },
): Promise<SystemWordbook> {
  await requireAdmin();

  const wordbook = await prisma.systemWordbook.findUnique({ where: { id } });
  if (!wordbook) throw new Error('系统单词本不存在');

  const name = data.name?.trim();
  if (name && name !== wordbook.name) {
    const duplicate = await prisma.systemWordbook.findUnique({ where: { name } });
    if (duplicate) throw new Error('已存在同名系统单词本');
  }

  const updated = await prisma.systemWordbook.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(data.description !== undefined
        ? { description: data.description.trim() || null }
        : {}),
    },
    include: { words: { select: { text: true }, orderBy: { createdAt: 'asc' } } },
  });

  return buildSummary(updated);
}

// 管理员：删除系统单词本（连同其单词一并删除）
export async function deleteSystemWordbook(id: number): Promise<{ success: boolean }> {
  await requireAdmin();

  const wordbook = await prisma.systemWordbook.findUnique({ where: { id } });
  if (!wordbook) throw new Error('系统单词本不存在');

  await prisma.systemWordbook.delete({ where: { id } });
  return { success: true };
}
