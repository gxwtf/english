import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // 也尝试加载 .env

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { query as queryDict } from '@/lib/dict/query';
import { Meaning } from '@/types/dict';

const { Pool } = pg;

// 检查环境变量
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ 错误: DATABASE_URL 环境变量未设置');
  console.error('请在 .env.local 或 .env 文件中设置 DATABASE_URL');
  process.exit(1);
}

console.log('📊 数据库连接字符串:', connectionString.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function incrementalUpdate() {
  console.log('🔄 增量更新：只更新缺少词性的单词...\n');

  try {
    // 测试数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功\n');

    // 查找所有 meanings 中有 type 为空的单词
    const allWords = await prisma.word.findMany({
      select: { id: true, text: true, meanings: true },
      orderBy: { text: 'asc' }
    });

    const wordsToUpdate = allWords.filter(word => {
      const meanings = word.meanings as any[];
      return meanings.some(m => !m.type || m.type === '');
    });

    console.log(`📊 需要更新的单词: ${wordsToUpdate.length}/${allWords.length}\n`);

    if (wordsToUpdate.length === 0) {
      console.log('✅ 所有单词都已有词性信息');
      return;
    }

    let updated = 0;
    let failed = 0;

    for (const word of wordsToUpdate) {
      const oldMeanings = word.meanings as any[];

      console.log(`📖 查询: ${word.text}`);

      try {
        const dictEntry = await queryDict(word.text);

        if (!dictEntry) {
          console.log(`  ⚠️  字典中未找到\n`);
          failed++;
          continue;
        }

        // 尝试补充词性
        const updatedMeanings = oldMeanings.map(oldMeaning => {
          if (oldMeaning.type && oldMeaning.type !== '') {
            return oldMeaning; // 已有词性，保持不变
          }

          // 查找匹配的词性
          const cleanContent = cleanText(oldMeaning.content || oldMeaning);

          for (const dictMeaning of dictEntry.meaning) {
            const cleanDict = cleanText(dictMeaning.content);
            const score = calculateSimilarity(cleanContent, cleanDict);

            if (score > 0.7) {
              return {
                type: dictMeaning.type,
                content: oldMeaning.content || oldMeaning,
                sentence: dictMeaning.sentence || ''
              };
            }
          }

          return oldMeaning; // 未找到匹配，保持原样
        });

        await prisma.word.update({
          where: { id: word.id },
          data: { meanings: updatedMeanings as any }
        });

        updated++;
        console.log(`  ✅ 已更新\n`);

      } catch (error) {
        console.error(`  ❌ 更新失败:`, error);
        failed++;
      }

      await sleep(10);
    }

    console.log('\n📊 更新完成:');
    console.log(`  ✅ 成功: ${updated}`);
    console.log(`  ❌ 失败: ${failed}`);

  } catch (error) {
    console.error('❌ 增量更新失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[，。；：！？、\s]/g, '').trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;

  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

incrementalUpdate().catch(console.error);
