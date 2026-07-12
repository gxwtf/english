#!/usr/bin/env node
/**
 * 清理 Word 表中 content 为空的释义条目（支持任意数据库）
 *
 * 根因：ECDICT 词典数据中的省略号(...)被旧版分词逻辑的
 * replaceAll('.', ',') 错误拆分，产生空字符串条目，
 * 在 UI 中显示为 "; ; ;"
 *
 * 使用方法：
 *   # 清理本地
 *   # 清理本地（通过 .env 或环境变量）
 *   DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx tsx scripts/clean-empty-meanings.mts
 *
 *   # 清理远程
 *   DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/clean-empty-meanings.mts
 */
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || '';
if (!databaseUrl) {
  console.error('请设置 DATABASE_URL 环境变量');
  process.exit(1);
}

const hostname = new URL(databaseUrl).hostname;
const label = hostname === 'localhost' ? '本地数据库 (localhost)' : `远程数据库 (${hostname})`;

console.log(`\n${'='.repeat(50)}`);
console.log(`开始清理 ${label}`);
console.log(`${'='.repeat(50)}\n`);

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let totalRemoved = 0;
const dirtyWords: { id: number; text: string; removedCount: number }[] = [];

try {
  const words = await prisma.word.findMany({
    select: { id: true, text: true, meanings: true },
    orderBy: { text: 'asc' },
  });

  console.log(`共 ${words.length} 个单词\n`);

  for (const word of words) {
    const meanings = word.meanings as any[];
    const originalCount = meanings.length;
    const cleaned = meanings.filter(
      (m: any) => m && typeof m.content === 'string' && m.content.trim() !== ''
    );
    const removedCount = originalCount - cleaned.length;

    if (removedCount > 0 && cleaned.length > 0) {
      await prisma.word.update({
        where: { id: word.id },
        data: { meanings: cleaned as any },
      });
      dirtyWords.push({ id: word.id, text: word.text, removedCount });
      totalRemoved += removedCount;
    }
  }

  if (dirtyWords.length === 0) {
    console.log('✅ 没有需要清理的数据');
  } else {
    console.log(`--- 受影响的 ${dirtyWords.length} 个单词 ---\n`);
    for (const w of dirtyWords) {
      console.log(`  📝 ${w.text} (id=${w.id}): 移除 ${w.removedCount} 个空释义`);
    }
    console.log();
    console.log(`🎉 清理完成！`);
    console.log(`  共处理 ${dirtyWords.length} 个单词，移除 ${totalRemoved} 个空释义条目`);
  }
} catch (error) {
  console.error('❌ 清理失败:', error);
  throw error;
} finally {
  await prisma.$disconnect();
  await pool.end();
}