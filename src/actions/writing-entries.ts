'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from './auth';
import { callOpenAI } from '@/lib/openai';

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
  const contentTrimmed = content.replace(/\s+$/, '');

  if (!contentTrimmed.trim()) throw new Error('内容不能为空');

  if (id) {
    // 更新现有记录
    const existing = await prisma.writingEntry.findFirst({
      where: { id, userId }
    });

    if (!existing) throw new Error('记录不存在或无权限');

    await prisma.writingEntry.update({
      where: { id },
      data: {
        content: contentTrimmed,
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
        content: contentTrimmed,
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
    where: { userId, content: contentTrimmed },
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

export type WordDifficulty = 'replace' | 'gaokao' | 'writing' | 'extensive';

export interface AIExtractedWord {
  word: string;
  type: string;
  meaning: string;
  sentence?: string;
  replaceWord?: string;
  difficultyTag?: string;
  sourceDomain?: string;
}

const DIFFICULTY_PROMPTS: Record<WordDifficulty, string> = {
  replace: `你是一个英语学习助手。请从以下英文作文中提取8-12组"常用词替换"词汇对。

要求：
1. 每组包含：简单词（如good, think, happy）和对应的高级替换词
2. 提供替换词的词性和中文释义（1-2个核心义项）
3. 格式为JSON数组，只返回JSON，不要包含其他文字：
[
  {"word": "substitute", "type": "v.", "meaning": "代替，替换", "replaceWord": "replace", "sentence": "We can substitute oil with butter."}
]
4. 聚焦常见基础词汇的高级替换，帮助提升作文表达丰富度`,

  gaokao: `你是一个高中英语老师。请从以下英文作文中提取8-12个高考英语3500词范围内的重点词汇。

要求：
1. 优先提取在作文中用法典型、容易出错或一词多义的词汇
2. 提供词性、中文释义（1-2个核心义项）和例句
3. 格式为JSON数组，只返回JSON，不要包含其他文字：
[
  {"word": "accomplish", "type": "v.", "meaning": "完成，实现", "sentence": "We accomplished our goal ahead of schedule.", "difficultyTag": "高考高频"}
]
4. difficultyTag可选值：高考高频、易错、一词多义`,

  writing: `你是一个英语写作专家。请从以下英文作文中提取8-12个适合高中书面表达的高级词汇和短语。

要求：
1. 优先提取能提升作文档次的高级词汇、固定搭配和连接词
2. 提供词性、中文释义和例句（展示正确用法）
3. 格式为JSON数组，只返回JSON，不要包含其他文字：
[
  {"word": "nevertheless", "type": "adv.", "meaning": "然而，尽管如此", "sentence": "It was raining; nevertheless, we went out."}
]
4. 包含连接词、高级形容词、动词短语等，帮助提升作文表达水平`,

  extensive: `你是一个英语阅读导师。请从以下英文作文中提取8-12个课标外但值得积累的外刊词汇。

要求：
1. 优先提取在《经济学人》《纽约时报》等外刊中常见的词汇
2. 提供词性、中文释义和例句
3. 格式为JSON数组，只返回JSON，不要包含其他文字：
[
  {"word": "paradigm", "type": "n.", "meaning": "范式，典范", "sentence": "This represents a new paradigm in education.", "sourceDomain": "科技"}
]
4. sourceDomain可选值：经济、科技、文化、社会、环境等`
};

export async function extractWordsFromEntries(
  entryIds: number[],
  difficulty: WordDifficulty
): Promise<AIExtractedWord[]> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const userId = user.userId;

  const entries = await prisma.writingEntry.findMany({
    where: { id: { in: entryIds }, userId },
    select: { content: true }
  });

  if (entries.length === 0) {
    throw new Error('未找到选中的作文内容');
  }

  const combinedContent = entries.map(e => e.content).join('\n\n---\n\n');

  const systemPrompt = DIFFICULTY_PROMPTS[difficulty];
  const userPrompt = `作文内容：\n\n${combinedContent}`;

  try {
    const response = await callOpenAI(systemPrompt, {
      prompt: userPrompt,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    let jsonString = response.content.trim();
    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    const result = JSON.parse(jsonString);

    if (!Array.isArray(result)) {
      throw new Error('AI返回格式错误，期望数组');
    }

    return result.map((item: any) => ({
      word: item.word?.trim() || '',
      type: item.type?.trim() || '',
      meaning: item.meaning?.trim() || '',
      sentence: item.sentence?.trim(),
      replaceWord: item.replaceWord?.trim(),
      difficultyTag: item.difficultyTag?.trim(),
      sourceDomain: item.sourceDomain?.trim()
    })).filter((word: AIExtractedWord) => word.word && word.type && word.meaning);

  } catch (error) {
    console.error('AI提取单词失败:', error);
    throw new Error('AI提取单词失败，请重试');
  }
}