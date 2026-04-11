import { prisma } from './db';

export type WordInfo = {
  wordId: number;
  text: string;
  userId: number;
  meanings: { id: number; content: string; type: string; sentence: string }[];
  tags: { id: number; name: string; colorId: string; description: string | null }[];
  relatedWords: { id: number; text: string; type: string }[];
};

export async function getWordInfo(userId: number, wordId: number): Promise<WordInfo | null> {
  const word = await prisma.word.findFirst({
    where: { id: wordId, userId },
    include: {
      meanings: true,
      wordTags: { include: { tag: true } },
    },
  });

  if (!word) return null;

  const relatedWordsDb = await prisma.relatedWord.findMany({
    where: { userId, wordText: word.text },
  });

  return {
    wordId: word.id,
    text: word.text,
    userId: word.userId,
    meanings: word.meanings.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      sentence: m.sentence || '',
    })),
    tags: word.wordTags.map((wt) => ({
      id: wt.tag.id,
      name: wt.tag.name,
      colorId: wt.tag.colorId,
      description: wt.tag.description,
    })),
    relatedWords: relatedWordsDb.map((rw) => ({
      id: rw.id,
      text: rw.relatedText,
      type: rw.type,
    })),
  };
}
