'use server';

/**
 * 复习状态相关的 Server Actions
 *
 * 主要职责：
 *   - recordReviewFromQuestion: 题目批改完成后，反推每道小题对应的 wordId 和 quality，
 *     批量更新 WordReviewState（SM-2 状态 + errorCount）
 *   - getReviewStats / getWordReviewState / getBatchReviewStates: UI 展示用
 */

import { prisma } from '@/lib/db';
import { getAuthUser } from '@/actions/auth';
import { sm2InitState, sm2Update } from '@/lib/spaced-repetition/sm2';
import {
  clampErrorCount,
  decayErrorCount,
} from '@/lib/spaced-repetition/weights';
import { gradeResultToQuality, type SubQuestionGrade } from '@/lib/spaced-repetition/quality';
import type { QuestionType } from '@/types/word';

/**
 * 题目批改完成后调用：从 questionContent + lastAnswer + gradingResult 反推
 * 每道小题对应的 wordId 和 quality，批量更新 WordReviewState
 *
 * 调用点：在 markQuestionAsAnswered 之后
 */
export async function recordReviewFromQuestion(questionId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  // 仅 ANSWERED 状态才记录复习
  if (q.status !== 'ANSWERED') return;

  const questionType = q.questionType as QuestionType;
  const wordIds = q.wordIds as number[];
  if (!wordIds || wordIds.length === 0) return;

  const questionContent = q.questionContent as any;
  if (!questionContent?.questions || !Array.isArray(questionContent.questions)) return;

  const lastAnswer = (q.lastAnswer as Record<string, unknown>) ?? {};
  const gradingResult = (q.gradingResult as any[]) ?? [];

  // 加载所有 wordIds 对应的 Word，建立 text.toLowerCase() → wordId 映射
  const words = await prisma.word.findMany({
    where: { id: { in: wordIds } },
    select: { id: true, text: true },
  });
  const textToWordId = new Map<string, number>();
  for (const w of words) {
    textToWordId.set(w.text.toLowerCase(), w.id);
  }

  // 已知 wordIds 集合（用于校验反推的 wordId 是否在题目词池内）
  const wordIdSet = new Set(wordIds);

  // 对每道小题，反推 wordId 和 quality
  const updates: Array<{ wordId: number; quality: number }> = [];

  for (let i = 0; i < questionContent.questions.length; i++) {
    const subQuestion = questionContent.questions[i];
    if (!subQuestion) continue;

    // 1. 反推 wordId
    const wordId = inferWordId(questionType, subQuestion, textToWordId, wordIdSet);
    if (wordId == null) continue;  // 无法反推，跳过

    // 2. 反推 quality
    const grade = inferSubGrade(questionType, i, subQuestion, lastAnswer, gradingResult);
    const quality = gradeResultToQuality(questionType, grade);
    if (quality == null) continue;  // 放弃或无法判分，跳过

    updates.push({ wordId, quality });
  }

  if (updates.length === 0) return;

  // 批量更新 WordReviewState（事务）
  await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 一次查所有需要更新的 state
    const existingStates = await tx.wordReviewState.findMany({
      where: {
        userId: user.userId,
        wordId: { in: updates.map((u) => u.wordId) },
      },
    });
    const stateMap = new Map(existingStates.map((s) => [s.wordId, s]));

    // 收集需要 upsert 的数据
    const upserts = updates.map(({ wordId, quality }) => {
      const existing = stateMap.get(wordId);
      const prevState = existing
        ? {
            repetitions: existing.repetitions,
            ef: existing.ef,
            interval: existing.interval,
          }
        : sm2InitState();

      const newState = sm2Update(prevState, quality);

      const newErrorCount =
        quality >= 3
          ? decayErrorCount(existing?.errorCount ?? 1)
          : clampErrorCount((existing?.errorCount ?? 1) + 1);

      return {
        userId: user.userId,
        wordId,
        repetitions: newState.repetitions,
        ef: newState.ef,
        interval: newState.interval,
        errorCount: newErrorCount,
        totalReviews: (existing?.totalReviews ?? 0) + 1,
        correctReviews: (existing?.correctReviews ?? 0) + (quality >= 3 ? 1 : 0),
        lastReviewedAt: now,
      };
    });

    // 批量 upsert
    for (const data of upserts) {
      await tx.wordReviewState.upsert({
        where: {
          userId_wordId: { userId: data.userId, wordId: data.wordId },
        },
        update: {
          repetitions: data.repetitions,
          ef: data.ef,
          interval: data.interval,
          errorCount: data.errorCount,
          totalReviews: data.totalReviews,
          correctReviews: data.correctReviews,
          lastReviewedAt: data.lastReviewedAt,
        },
        create: data,
      });
    }
  });
}

/**
 * 从小题内容反推对应的 wordId
 */
function inferWordId(
  questionType: QuestionType,
  subQuestion: any,
  textToWordId: Map<string, number>,
  wordIdSet: Set<number>
): number | null {
  let text: string | undefined;

  switch (questionType) {
    case 'fill-blank':
      // questionContent.questions[i] = { sentence, answer, originalWord? }
      // 优先用 originalWord（form-change 模式下 answer 是变形）
      text = subQuestion.originalWord || subQuestion.answer;
      break;

    case 'definition-fill-blank':
      // questionContent.questions[i] = { definition, answer }
      text = subQuestion.answer;
      break;

    case 'translate':
      // questionContent.questions[i] = { id, chinese, referenceAnswers, keyWords }
      text = (subQuestion.keyWords && subQuestion.keyWords[0]) || undefined;
      break;

    case 'meaning-select':
    case 'meaning-select-en':
      // questionContent.questions[i] = { id, word, options, correctAnswer }
      text = subQuestion.word;
      break;

    case 'word-select-translate':
    case 'word-card':
    default:
      // 无法精确反推 wordId
      return null;
  }

  if (!text || typeof text !== 'string') return null;

  const wordId = textToWordId.get(text.toLowerCase());
  if (wordId == null || !wordIdSet.has(wordId)) return null;

  return wordId;
}

/**
 * 从小题内容 + lastAnswer + gradingResult 反推 SubQuestionGrade
 */
function inferSubGrade(
  questionType: QuestionType,
  index: number,
  subQuestion: any,
  lastAnswer: Record<string, unknown>,
  gradingResult: any[]
): SubQuestionGrade {
  // 用户答案：lastAnswer 可能用数字 key 或 index 序号
  const userAnswer = (lastAnswer[index] as string) ?? (lastAnswer[subQuestion.id] as string) ?? '';

  switch (questionType) {
    case 'fill-blank':
    case 'definition-fill-blank': {
      const abandoned = !userAnswer.trim();
      if (abandoned) return { abandoned: true };
      const standard = subQuestion.answer as string;
      const isCorrect =
        questionType === 'definition-fill-blank'
          ? userAnswer.trim().toLowerCase() === standard.toLowerCase()
          : userAnswer.trim() === standard;
      return { isCorrect };
    }

    case 'meaning-select':
    case 'meaning-select-en': {
      const abandoned = !userAnswer.trim();
      if (abandoned) return { abandoned: true };
      const isCorrect = userAnswer === subQuestion.correctAnswer;
      return { isCorrect };
    }

    case 'translate':
    case 'word-select-translate': {
      // 用 gradingResult 里的 score（来自 AI 批改）
      // gradingResult[i] 的 questionId 通常是 subQuestion.id（translate）或 index
      const grade = gradingResult.find(
        (g) => g.questionId === subQuestion.id || g.questionId === index
      );
      if (!grade) return { abandoned: !userAnswer.trim() };
      return {
        score: grade.score,
        maxScore: grade.maxScore,
        abandoned: !userAnswer.trim() && grade.score == null,
      };
    }

    case 'word-card':
    default:
      return { abandoned: true };
  }
}

/**
 * 获取用户的复习统计（用于 UI 展示）
 * 内部从 getAuthUser 拿 userId，无需调用方传
 */
export async function getReviewStats(): Promise<{
  due: number;
  newWords: number;
  total: number;
  errorTotal: number;
}> {
  const user = await getAuthUser();
  if (!user) return { due: 0, newWords: 0, total: 0, errorTotal: 0 };
  const userId = user.userId;

  // 总词数
  const total = await prisma.word.count({ where: { userId } });

  // 有复习状态的词数
  const reviewedCount = await prisma.wordReviewState.count({
    where: { userId },
  });

  // 新词数 = 总词数 - 已复习词数
  const newWords = Math.max(0, total - reviewedCount);

  // 到期词数：f(t) > 0.5 的词
  // f(t) > 0.5 等价于 1 - e^(-elapsed/interval) > 0.5
  // 等价于 e^(-elapsed/interval) < 0.5
  // 等价于 -elapsed/interval < ln(0.5)
  // 等价于 elapsed/interval > -ln(0.5) ≈ 0.693
  // 等价于 elapsed > 0.693 × interval
  const now = new Date();
  const allStates = await prisma.wordReviewState.findMany({
    where: { userId },
    select: { lastReviewedAt: true, interval: true, errorCount: true },
  });

  let due = 0;
  let errorTotal = 0;
  const THRESHOLD = -Math.log(0.5);  // ≈ 0.693

  for (const s of allStates) {
    if (!s.lastReviewedAt) continue;
    const elapsedDays = (now.getTime() - s.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (elapsedDays > THRESHOLD * s.interval) {
      due++;
    }
    errorTotal += s.errorCount;
  }

  return { due, newWords, total, errorTotal };
}

/**
 * 获取单个词的复习状态
 */
export async function getWordReviewState(
  wordId: number
): Promise<{
  repetitions: number;
  ef: number;
  interval: number;
  errorCount: number;
  totalReviews: number;
  correctReviews: number;
  lastReviewedAt: Date | null;
} | null> {
  const user = await getAuthUser();
  if (!user) return null;

  return prisma.wordReviewState.findUnique({
    where: {
      userId_wordId: { userId: user.userId, wordId },
    },
    select: {
      repetitions: true,
      ef: true,
      interval: true,
      errorCount: true,
      totalReviews: true,
      correctReviews: true,
      lastReviewedAt: true,
    },
  });
}

/**
 * 批量获取多个词的复习状态（用于单词列表展示到期徽章）
 */
export async function getBatchReviewStates(
  wordIds: number[]
): Promise<Array<{ wordId: number; lastReviewedAt: Date | null; interval: number; errorCount: number; ef: number; repetitions: number }>> {
  const user = await getAuthUser();
  if (!user) return [];

  const states = await prisma.wordReviewState.findMany({
    where: {
      userId: user.userId,
      wordId: { in: wordIds },
    },
    select: {
      wordId: true,
      lastReviewedAt: true,
      interval: true,
      errorCount: true,
      ef: true,
      repetitions: true,
    },
  });

  return states;
}
