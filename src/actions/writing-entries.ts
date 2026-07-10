'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';

export interface WritingEntry {
  id: number;
  content: string;
  note?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 加载所有作文积累
export async function loadWritingEntries(): Promise<WritingEntry[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const entries = await prisma.writingEntry.findMany({
    where: { userId: user.userId },
    include: {
      tags: {
        include: { tag: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return entries.map(entry => ({
    id: entry.id,
    content: entry.content,
    note: entry.note,
    tags: entry.tags.map(t => t.tag.name),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }));
}

// 保存/更新作文积累
export async function saveWritingEntry(data: {
  id?: number;
  content: string;
  note?: string;
  tags?: string[];
}): Promise<WritingEntry> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const userId = user.userId;
  const { id, content, note, tags = [] } = data;
  const contentTrim = content.trim();

  if (!contentTrim) throw new Error('内容不能为空');

  if (id) {
    // 更新现有记录
    const existing = await prisma.writingEntry.findFirst({
      where: { id, userId }
    });

    if (!existing) throw new Error('记录不存在或无权限');

    await prisma.writingEntry.update({
      where: { id },
      data: {
        content: contentTrim,
        note: note?.trim() || null,
        tags: {
          deleteMany: {},
          create: tags.map(tag => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag, colorId: 'blue' }
              }
            }
          }))
        }
      }
    });
  } else {
    // 创建新记录
    await prisma.writingEntry.create({
      data: {
        userId,
        content: contentTrim,
        note: note?.trim() || null,
        tags: {
          create: tags.map(tag => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag, colorId: 'blue' }
              }
            }
          }))
        }
      }
    });
  }

  // 重新查询返回结果
  const result = await prisma.writingEntry.findFirstOrThrow({
    where: { userId, content: contentTrim },
    include: {
      tags: {
        include: { tag: true }
      }
    }
  });

  return {
    id: result.id,
    content: result.content,
    note: result.note,
    tags: result.tags.map(t => t.tag.name),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt
  };
}

// 删除作文积累
export async function deleteWritingEntries(ids: number[]) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  await prisma.writingEntry.deleteMany({
    where: { id: { in: ids }, userId: user.userId }
  });

  return { success: true };
}

// 批量更新标签
export async function updateWritingEntryTags(entryIds: number[], tags: string[]): Promise<WritingEntry[]> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const userId = user.userId;

  // 更新每个记录的标签
  for (const entryId of entryIds) {
    const entry = await prisma.writingEntry.findFirst({
      where: { id: entryId, userId }
    });

    if (!entry) continue;

    await prisma.writingEntry.update({
      where: { id: entryId },
      data: {
        tags: {
          deleteMany: {},
          create: tags.map(tag => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag, colorId: 'blue' }
              }
            }
          }))
        }
      }
    });
  }

  // 返回更新后的记录列表
  const updatedEntries = await prisma.writingEntry.findMany({
    where: { id: { in: entryIds }, userId },
    include: {
      tags: {
        include: { tag: true }
      }
    }
  });

  return updatedEntries.map(entry => ({
    id: entry.id,
    content: entry.content,
    note: entry.note,
    tags: entry.tags.map(t => t.tag.name),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }));
}