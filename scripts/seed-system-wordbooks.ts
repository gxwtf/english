import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/db';
import { chineseToMeanings } from '../src/lib/system-word-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '../prisma/seed-data/gaokao3500.json');
const BOOK_NAME = '高考 3500 词';

interface RawWord {
  english: string;
  phoneticSymbol?: string;
  chinese?: string;
}

async function main() {
  const existing = await prisma.systemWordbook.findUnique({ where: { name: BOOK_NAME } });
  if (existing) {
    console.log(`系统单词本「${BOOK_NAME}」已存在（id=${existing.id}），跳过。`);
    return;
  }

  const raw: RawWord[] = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));

  const seen = new Set<string>();
  const words: { text: string; phonetic: string | null; meanings: ReturnType<typeof chineseToMeanings> }[] = [];
  for (const item of raw) {
    const text = (item.english ?? '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const meanings = chineseToMeanings(item.chinese ?? '');
    if (meanings.length === 0) continue;
    words.push({ text, phonetic: item.phoneticSymbol?.trim() || null, meanings });
  }

  if (words.length === 0) {
    console.error('未解析到任何单词，请检查 seed-data/gaokao3500.json');
    process.exit(1);
  }

  const created = await prisma.$transaction(async (tx) => {
    const wordbook = await tx.systemWordbook.create({
      data: { name: BOOK_NAME, description: '高考英语核心词汇（约 3500 词）' },
    });

    const chunkSize = 1000;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      await tx.systemWord.createMany({
        data: chunk.map((w) => ({
          systemWordbookId: wordbook.id,
          text: w.text,
          phonetic: w.phonetic,
          meanings: w.meanings as any,
        })),
      });
    }
    return wordbook;
  });

  console.log(`已创建系统单词本「${BOOK_NAME}」(id=${created.id})，共 ${words.length} 个单词。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
