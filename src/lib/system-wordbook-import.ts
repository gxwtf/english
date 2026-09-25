import { prisma } from '@/lib/db';

// 将系统单词本的全部单词复制到用户指定的单词本。
// 已存在的同名用户单词只建立关联，不覆盖用户已有释义（保证用户可自由编辑副本）。
export async function importSystemWordsToWordbook(
  userId: number,
  wordbookId: number,
  systemWordbookId: number,
): Promise<{ imported: number; linked: number }> {
  const systemWords = await prisma.systemWord.findMany({
    where: { systemWordbookId },
    orderBy: { id: 'asc' },
  });
  if (systemWords.length === 0) return { imported: 0, linked: 0 };

  const texts = systemWords.map((w) => w.text);
  const existingWords = await prisma.word.findMany({
    where: { userId, text: { in: texts } },
    select: { id: true, text: true },
  });
  const existingByText = new Set(existingWords.map((w) => w.text.toLowerCase()));

  let imported = 0;
  let linked = 0;

  await prisma.$transaction(async (tx) => {
    const newWords = systemWords.filter((w) => !existingByText.has(w.text.toLowerCase()));

    const chunkSize = 1000;
    for (let i = 0; i < newWords.length; i += chunkSize) {
      const chunk = newWords.slice(i, i + chunkSize);
      await tx.word.createMany({
        data: chunk.map((w) => ({
          userId,
          text: w.text,
          meanings: w.meanings as any,
        })),
        skipDuplicates: true,
      });
    }
    imported = newWords.length;

    // 重新读取所有涉及的单词 id（包含刚创建的）
    const allWords = await tx.word.findMany({
      where: { userId, text: { in: texts } },
      select: { id: true },
    });

    const wordIds = allWords.map((w) => w.id);
    linked = wordIds.length;

    for (let i = 0; i < wordIds.length; i += chunkSize) {
      const chunk = wordIds.slice(i, i + chunkSize);
      await tx.wordbookWord.createMany({
        data: chunk.map((wordId) => ({ wordbookId, wordId })),
        skipDuplicates: true,
      });
    }
  });

  return { imported, linked };
}
