'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from '../auth';
import { QuestionType, QUESTION_TYPE_LABELS } from '@/types/word';
import { Meaning } from '@/types/dict';

export interface PdfQuestionData {
  id: string;
  questionType: QuestionType;
  questionTypeLabel: string;
  questionContent: Record<string, unknown>;
  wordMeanings: {
    text: string;
    meanings: Meaning[];
    isRelatedWord: boolean;
    sourceWords?: string[];
  }[];
}

export async function getQuestionsForPdf(questionIds: string[]): Promise<PdfQuestionData[]> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const questions = await prisma.questionQueue.findMany({
    where: {
      id: { in: questionIds },
      userId: user.userId,
      status: { in: ['GENERATED', 'ANSWERED', 'GRADING'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  const results: PdfQuestionData[] = [];

  for (const q of questions) {
    const content = (q.questionContent as Record<string, unknown>) ?? {};
    const wordIds = q.wordIds as number[];
    const relatedWordEntries = (q.relatedWordEntries as Array<{ text: string; types: string[]; sourceWords: string[] }> | null) ?? [];

    // Fetch word meanings
    const wordMeanings: PdfQuestionData['wordMeanings'] = [];

    const coreWords = await prisma.word.findMany({
      where: { id: { in: wordIds } },
    });

    const coreWordTexts = new Set(coreWords.map(w => w.text.toLowerCase()));

    for (const word of coreWords) {
      wordMeanings.push({
        text: word.text,
        meanings: word.meanings as unknown as Meaning[],
        isRelatedWord: false,
      });
    }

    for (const relatedEntry of relatedWordEntries) {
      const existingWord = await prisma.word.findFirst({
        where: { userId: user.userId, text: { equals: relatedEntry.text, mode: 'insensitive' } },
      });

      if (existingWord) {
        if (!coreWordTexts.has(existingWord.text.toLowerCase())) {
          wordMeanings.push({
            text: existingWord.text,
            meanings: existingWord.meanings as unknown as Meaning[],
            isRelatedWord: true,
            sourceWords: relatedEntry.sourceWords,
          });
        }
      } else {
        const sourceWordMeanings: Meaning[] = [];
        for (const sourceText of relatedEntry.sourceWords) {
          const sourceWord = await prisma.word.findFirst({
            where: { userId: user.userId, text: { equals: sourceText, mode: 'insensitive' } },
          });
          if (sourceWord && sourceWord.meanings.length > 0) {
            sourceWordMeanings.push(...(sourceWord.meanings as unknown as Meaning[]));
          }
        }
        wordMeanings.push({
          text: relatedEntry.text,
          meanings: sourceWordMeanings.length > 0 ? [...new Set(sourceWordMeanings)] : [],
          isRelatedWord: true,
          sourceWords: relatedEntry.sourceWords,
        });
      }
    }

    results.push({
      id: q.id,
      questionType: q.questionType as QuestionType,
      questionTypeLabel: QUESTION_TYPE_LABELS[q.questionType as QuestionType] || q.questionType,
      questionContent: content,
      wordMeanings,
    });
  }

  return results;
}
