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
  const dictSet = new Set(dictMeanings.map(m => m.type + '|' + m.content));
  for (const m of dbMeanings) {
    const key = (m.type || '') + '|' + (m.content || '');
    if (!dictSet.has(key)) return false;
  }
  return true;
}

async function main() {
  const userId = 2443;
  const words = await prisma.word.findMany({
    where: { userId },
    select: { id: true, text: true, meanings: true },
    orderBy: { text: 'asc' },
  });

  let fixed = 0;
  for (const w of words) {
    const dictMeanings = getDictMeanings(w.text);
    if (!dictMeanings) continue;

    const dbMeanings = w.meanings as any[];
    if (meaningsMatch(dbMeanings, dictMeanings)) continue;

    console.log('修复: ' + w.text + ' (id=' + w.id + ')');
    console.log('  旧释义: ' + JSON.stringify(dbMeanings.map(m => m.type + '.' + m.content)));
    console.log('  新释义: ' + JSON.stringify(dictMeanings.map(m => m.type + '.' + m.content)));

    await prisma.word.update({
      where: { id: w.id },
      data: { meanings: dictMeanings as any },
    });
    fixed++;
  }

  console.log('\n共修复 ' + fixed + ' 个单词');
  await prisma.$disconnect();
}

main();
