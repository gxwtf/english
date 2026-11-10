import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DictCsv } from '../src/lib/dict/ecdict.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 加载词典
const DICT_PATH = path.join(__dirname, '..', 'src', 'dict', 'ecdict.csv');
const dict = new DictCsv(DICT_PATH);

function getDictMeanings(word: string) {
  const result = dict.query(word);
  if (!result) return null;
  const meanings: { type: string; content: string }[] = [];
  for (const meaning of result.meaning) {
    const content = meaning.content.trim().replaceAll(';', ',').replaceAll('，', ',').replaceAll('；', '.').replaceAll(' ', '').replaceAll('.', ',').split(',');
    for (const c of content) {
      meanings.push({ type: meaning.type, content: c.trim() });
    }
  }
  return meanings;
}

function meaningsMatch(dbMeanings: any[], dictMeanings: { type: string; content: string }[]): boolean {
  // 比较 db 中的释义是否是 dict 释义的子集（用户可能只选了部分释义）
  const dictSet = new Set(dictMeanings.map(m => m.type + '|' + m.content));
  for (const m of dbMeanings) {
    const key = (m.type || '') + '|' + (m.content || '');
    if (!dictSet.has(key)) return false;
  }
  return true;
}

async function main() {
  const words = await prisma.word.findMany({
    where: { userId: 2443 },
    select: { id: true, text: true, meanings: true },
    orderBy: { text: 'asc' },
  });

  const mismatched: { id: number; text: string; dbMeanings: any[]; dictMeanings: any }[] = [];

  for (const w of words) {
    const dictMeanings = getDictMeanings(w.text);
    if (!dictMeanings) {
      console.log('⚠ 词典中未找到: ' + w.text + ' (id=' + w.id + ')');
      continue;
    }
    const dbMeanings = w.meanings as any[];
    if (!meaningsMatch(dbMeanings, dictMeanings)) {
      mismatched.push({ id: w.id, text: w.text, dbMeanings, dictMeanings });
      console.log('❌ 不匹配: ' + w.text + ' (id=' + w.id + ')');
      console.log('   DB释义: ' + JSON.stringify(dbMeanings.map(m => m.type + '.' + m.content)));
      console.log('   词典释义: ' + JSON.stringify(dictMeanings.map(m => m.type + '.' + m.content)));
    }
  }

  console.log('\n=== 统计 ===');
  console.log('总单词数:', words.length);
  console.log('释义不匹配:', mismatched.length);

  if (mismatched.length > 0) {
    console.log('\n不匹配的单词列表:');
    for (const m of mismatched) {
      console.log('  id=' + m.id + ' ' + m.text);
    }
  }

  await prisma.$disconnect();
}

main();
