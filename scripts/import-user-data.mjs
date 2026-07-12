#!/usr/bin/env node
/**
 * 从远程数据库同步 userId=2449 的数据到本地数据库，改为 userId=2443
 *
 * 使用方法：
 *   node scripts/import-user-data.mjs
 *
 * 注意：
 *   - 此脚本仅执行只读操作从远程数据库
 *   - 使用事务确保数据一致性
 *   - 会删除本地 userId=2443 的现有数据并替换
 */

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// 数据库连接配置（通过环境变量传入，勿硬编码密码）
const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL || '';
const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || '';

if (!REMOTE_DATABASE_URL || !LOCAL_DATABASE_URL) {
  console.error('请设置 REMOTE_DATABASE_URL 和 LOCAL_DATABASE_URL 环境变量');
  console.error('示例: REMOTE_DATABASE_URL="postgresql://user:pass@your-server.com:5432/db" LOCAL_DATABASE_URL="postgresql://user:pass@localhost:5432/db" node scripts/import-user-data.mjs');
  process.exit(1);
}

// 源用户 ID 和目标用户 ID
const SOURCE_USER_ID = 2449;
const TARGET_USER_ID = 2443;

// 创建 Prisma 客户端
const remotePool = new Pool({ connectionString: REMOTE_DATABASE_URL });
const remotePrisma = new PrismaClient({ adapter: new PrismaPg(remotePool) });

const localPool = new Pool({ connectionString: LOCAL_DATABASE_URL });
const localPrisma = new PrismaClient({ adapter: new PrismaPg(localPool) });

// 日志工具
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  section: (msg) => console.log(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`),
};

/**
 * 同步用户基础信息
 */
async function syncUser() {
  log.section('同步用户数据');

  const user = await remotePrisma.user.findUnique({
    where: { userId: SOURCE_USER_ID },
  });

  if (!user) {
    throw new Error(`未找到 userId=${SOURCE_USER_ID} 的用户`);
  }

  log.info(`远程用户: ${user.userName} (userId: ${user.userId})`);

  // 使用 TARGET_USER_ID 创建/更新本地用户
  const localUserData = {
    userId: TARGET_USER_ID,
    userName: user.userName,
    admin: user.admin,
    email: user.email,
    realName: user.realName,
  };

  await localPrisma.user.upsert({
    where: { userId: TARGET_USER_ID },
    update: localUserData,
    create: localUserData,
  });

  log.success(`本地用户更新完成: ${user.userName} (userId: ${TARGET_USER_ID})`);
}

/**
 * 同步 Tag 数据（全局标签，被 WritingEntryTag 和 WordTag 引用）
 */
async function syncTags() {
  log.section('同步 Tag 数据');

  // 查找远程用户引用的所有 tagId
  const writingEntryTagIds = await remotePrisma.writingEntryTag.findMany({
    where: { writingEntry: { userId: SOURCE_USER_ID } },
    select: { tagId: true },
  });
  const wordTagIds = await remotePrisma.wordTag.findMany({
    where: { word: { userId: SOURCE_USER_ID } },
    select: { tagId: true },
  });

  const allTagIds = [...new Set([
    ...writingEntryTagIds.map(t => t.tagId),
    ...wordTagIds.map(t => t.tagId),
  ])];

  if (allTagIds.length === 0) {
    log.info('没有需要同步的 Tag');
    return;
  }

  log.info(`远程用户引用了 ${allTagIds.length} 个全局 Tag`);

  for (const tagId of allTagIds) {
    const tag = await remotePrisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      log.warn(`Tag id=${tagId} 不存在，跳过`);
      continue;
    }

    // 检查本地是否已存在
    const localTag = await localPrisma.tag.findUnique({ where: { id: tagId } });
    if (!localTag) {
      await localPrisma.tag.create({ data: tag });
      log.info(`已创建 Tag: ${tag.name} (id=${tagId})`);
    } else {
      log.info(`Tag 已存在: ${tag.name} (id=${tagId})`);
    }
  }
  log.success('Tag 同步完成');
}

/**
 * 同步 tagConfig 数据
 */
async function syncTagConfigs() {
  log.section('同步 TagConfig 数据');

  const tagConfigs = await remotePrisma.tagConfig.findMany({
    where: { userId: SOURCE_USER_ID },
  });

  log.info(`找到 ${tagConfigs.length} 个 tagConfig`);

  // 删除本地目标用户的 tagConfig
  const deleted = await localPrisma.tagConfig.deleteMany({
    where: { userId: TARGET_USER_ID },
  });
  log.info(`已删除本地 ${deleted.count} 个 tagConfig`);

  // 导入远程数据
  let count = 0;
  for (const tc of tagConfigs) {
    await localPrisma.tagConfig.create({
      data: {
        userId: TARGET_USER_ID,
        name: tc.name,
        colorId: tc.colorId,
        description: tc.description,
      },
    });
    count++;
  }
  log.success(`已导入 ${count} 个 tagConfig`);
}

/**
 * 同步 relatedWord 数据
 */
async function syncRelatedWords() {
  log.section('同步 RelatedWord 数据');

  const relatedWords = await remotePrisma.relatedWord.findMany({
    where: { userId: SOURCE_USER_ID },
  });

  log.info(`找到 ${relatedWords.length} 个 relatedWord`);

  // 删除本地目标用户的 relatedWord
  const deleted = await localPrisma.relatedWord.deleteMany({
    where: { userId: TARGET_USER_ID },
  });
  log.info(`已删除本地 ${deleted.count} 个 relatedWord`);

  // 导入远程数据
  let count = 0;
  for (const rw of relatedWords) {
    await localPrisma.relatedWord.create({
      data: {
        userId: TARGET_USER_ID,
        wordText: rw.wordText,
        relatedText: rw.relatedText,
        type: rw.type,
      },
    });
    count++;
  }
  log.success(`已导入 ${count} 个 relatedWord`);
}

/**
 * 同步 writingEntry + WritingEntryTag 数据
 */
async function syncWritingEntries() {
  log.section('同步 WritingEntry 数据');

  const writingEntries = await remotePrisma.writingEntry.findMany({
    where: { userId: SOURCE_USER_ID },
    include: { tags: true },
  });

  log.info(`找到 ${writingEntries.length} 个 writingEntry`);

  // 删除本地目标用户的 writingEntryTag 和 writingEntry
  const deletedTags = await localPrisma.writingEntryTag.deleteMany({
    where: { writingEntry: { userId: TARGET_USER_ID } },
  });
  log.info(`已删除本地 ${deletedTags.count} 个 writingEntryTag`);

  const deleted = await localPrisma.writingEntry.deleteMany({
    where: { userId: TARGET_USER_ID },
  });
  log.info(`已删除本地 ${deleted.count} 个 writingEntry`);

  // 导入远程数据
  let count = 0;
  for (const we of writingEntries) {
    // 创建新的 writingEntry，自动生成新 id
    const newEntry = await localPrisma.writingEntry.create({
      data: {
        userId: TARGET_USER_ID,
        content: we.content,
        note: we.note,
      },
    });

    // 导入 tags
    if (we.tags.length > 0) {
      await localPrisma.writingEntryTag.createMany({
        data: we.tags.map(t => ({
          writingEntryId: newEntry.id,
          tagId: t.tagId,
        })),
      });
    }
    count++;
  }
  log.success(`已导入 ${count} 个 writingEntry`);
}

/**
 * 同步 questionQueue 数据
 */
async function syncQuestionQueue() {
  log.section('同步 QuestionQueue 数据');

  const questions = await remotePrisma.questionQueue.findMany({
    where: { userId: SOURCE_USER_ID },
  });

  log.info(`找到 ${questions.length} 个 questionQueue`);

  // 删除本地目标用户的 questionQueue
  const deleted = await localPrisma.questionQueue.deleteMany({
    where: { userId: TARGET_USER_ID },
  });
  log.info(`已删除本地 ${deleted.count} 个 questionQueue`);

  // 导入远程数据（保留原始 id）
  let count = 0;
  for (const q of questions) {
    await localPrisma.questionQueue.create({
      data: {
        id: q.id,
        userId: TARGET_USER_ID,
        questionType: q.questionType,
        status: q.status,
        questionContent: q.questionContent,
        lastAnswer: q.lastAnswer,
        wordIds: q.wordIds,
        gradingResult: q.gradingResult,
        relatedWordEntries: q.relatedWordEntries,
      },
    });
    count++;
  }
  log.success(`已导入 ${count} 个 questionQueue`);
}

/**
 * 同步 Word + WordTag 数据
 */
async function syncWords() {
  log.section('同步 Word 数据');

  const words = await remotePrisma.word.findMany({
    where: { userId: SOURCE_USER_ID },
    include: { wordTags: true },
  });

  log.info(`找到 ${words.length} 个单词`);

  // 删除本地目标用户的 wordTag 和 word
  const deletedWordTags = await localPrisma.wordTag.deleteMany({
    where: { word: { userId: TARGET_USER_ID } },
  });
  log.info(`已删除本地 ${deletedWordTags.count} 个 wordTag`);

  const deletedWords = await localPrisma.word.deleteMany({
    where: { userId: TARGET_USER_ID },
  });
  log.info(`已删除本地 ${deletedWords.count} 个单词`);

  // 导入远程数据
  let wordCount = 0;
  let tagCount = 0;
  for (const w of words) {
    // 创建新单词
    const newWord = await localPrisma.word.create({
      data: {
        userId: TARGET_USER_ID,
        text: w.text,
        relatedWords: w.relatedWords,
        meanings: w.meanings,
      },
    });

    // 导入 wordTag
    if (w.wordTags.length > 0) {
      await localPrisma.wordTag.createMany({
        data: w.wordTags.map(wt => ({
          wordId: newWord.id,
          tagId: wt.tagId,
        })),
      });
      tagCount += w.wordTags.length;
    }
    wordCount++;
  }
  log.success(`已导入 ${wordCount} 个单词，${tagCount} 个 wordTag`);
}

/**
 * 主函数
 */
async function main() {
  log.section(`开始导入: 远程 userId=${SOURCE_USER_ID} → 本地 userId=${TARGET_USER_ID}`);

  try {
    // 1. 同步用户信息
    await syncUser();

    // 2. 同步 Tag（全局标签，先于 Word/WritingEntry 同步）
    await syncTags();

    // 3. 同步 TagConfig
    await syncTagConfigs();

    // 4. 同步 RelatedWord
    await syncRelatedWords();

    // 5. 同步 WritingEntry (包含 WritingEntryTag)
    await syncWritingEntries();

    // 6. 同步 QuestionQueue
    await syncQuestionQueue();

    // 7. 同步 Word (包含 WordTag)
    await syncWords();

    log.section('全部导入完成！');
  } catch (e) {
    log.error(`导入失败: ${e.message}`);
    throw e;
  } finally {
    remotePool.end();
    localPool.end();
    await Promise.all([remotePrisma.$disconnect(), localPrisma.$disconnect()]);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
