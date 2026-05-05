import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { query as queryDict } from '@/lib/dict/query';
import { Meaning } from '@/types/dict';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface WordUpdateData {
  id: number;
  text: string;
  oldMeanings: any[];
  newMeanings: Meaning[];
  matched: boolean;
}

async function batchUpdateMeanings() {
  console.log('🚀 开始批量更新单词词性...\n');

  try {
    const words = await prisma.word.findMany({
      select: {
        id: true,
        text: true,
        meanings: true
      },
      orderBy: { text: 'asc' }
    });

    console.log(`📊 找到 ${words.length} 个单词需要处理\n`);

    if (words.length === 0) {
      console.log('✅ 没有需要处理的单词');
      return;
    }

    const updateData: WordUpdateData[] = [];
    let successCount = 0;
    let notFoundCount = 0;
    let noMatchCount = 0;

    console.log('📖 开始查字典...\n');

    for (const word of words) {
      const oldMeanings = word.meanings as any[];

      const dictEntry = await queryDict(word.text);

      if (!dictEntry) {
        console.log(`⚠️  字典中未找到: ${word.text}`);
        notFoundCount++;
        updateData.push({
          id: word.id,
          text: word.text,
          oldMeanings,
          newMeanings: oldMeanings.map((m: any) => ({
            type: m.type || '',
            content: m.content || m,
            sentence: m.sentence || ''
          })),
          matched: false
        });
        continue;
      }

      const matchedMeanings = matchMeanings(oldMeanings, dictEntry.meaning);

      if (matchedMeanings.length > 0) {
        successCount++;
        console.log(`✅ ${word.text}: 匹配到 ${matchedMeanings.length} 个释义`);
      } else {
        noMatchCount++;
        console.log(`⚠️  ${word.text}: 未匹配到释义，保留原数据`);
      }

      updateData.push({
        id: word.id,
        text: word.text,
        oldMeanings,
        newMeanings: matchedMeanings.length > 0 ? matchedMeanings : oldMeanings.map((m: any) => ({
          type: m.type || '',
          content: m.content || m,
          sentence: m.sentence || ''
        })),
        matched: matchedMeanings.length > 0
      });

      await sleep(10);
    }

    console.log('\n📝 统计信息:');
    console.log(`  ✅ 成功匹配: ${successCount}`);
    console.log(`  ⚠️  未找到单词: ${notFoundCount}`);
    console.log(`  ⚠️  未匹配释义: ${noMatchCount}`);

    console.log('\n💾 开始更新数据库...\n');

    const batchSize = 50;
    let updated = 0;

    for (let i = 0; i < updateData.length; i += batchSize) {
      const batch = updateData.slice(i, i + batchSize);

      await Promise.all(
        batch.map(data =>
          prisma.word.update({
            where: { id: data.id },
            data: { meanings: data.newMeanings as any }
          })
        )
      );

      updated += batch.length;
      console.log(`⏳ 进度: ${updated}/${updateData.length}`);
    }

    console.log('\n📚 更新后的示例数据:\n');
    const samples = updateData.slice(0, 5);
    for (const sample of samples) {
      console.log(`  ${sample.text}:`);
      sample.newMeanings.forEach(m => {
        const typeStr = m.type ? `[${m.type}] ` : '';
        console.log(`    ${typeStr}${m.content}`);
      });
      console.log();
    }

    console.log('🎉 批量更新完成！');

  } catch (error) {
    console.error('❌ 批量更新失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function matchMeanings(oldMeanings: any[], dictMeanings: Meaning[]): Meaning[] {
  const matched: Meaning[] = [];

  for (const oldMeaning of oldMeanings) {
    const cleanOld = cleanText(oldMeaning.content || oldMeaning);

    for (const dictMeaning of dictMeanings) {
      const cleanDict = cleanText(dictMeaning.content);

      if (
        cleanOld === cleanDict ||
        cleanOld.includes(cleanDict) ||
        cleanDict.includes(cleanOld) ||
        calculateSimilarity(cleanOld, cleanDict) > 0.8
      ) {
        matched.push({
          type: dictMeaning.type,
          content: oldMeaning.content || oldMeaning,
          sentence: dictMeaning.sentence
        });
        break;
      }
    }

    if (!matched.find(m => cleanText(m.content) === cleanOld)) {
      matched.push({
        type: oldMeaning.type || '',
        content: oldMeaning.content || oldMeaning,
        sentence: oldMeaning.sentence || ''
      });
    }
  }

  return matched;
}

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，。；：！？、\s]/g, '')
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

batchUpdateMeanings().catch(console.error);
