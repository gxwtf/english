'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from '../auth';
import { QuestionType } from '@/types/word';
import { callOpenAI, parseThinkingContent } from '@/lib/openai';

/**
 * Fetch words and enrich with meanings.
 * Used by all question-type-specific Server Actions.
 */
export async function fetchEnrichedWords(wordIds: number[]) {
  const words = await prisma.word.findMany({
    where: { id: { in: wordIds } },
    include: { meanings: true },
  });

  return words.map((w) => ({
    id: w.id,
    text: w.text,
    meanings: w.meanings.map((m) => ({
      content: m.content,
      type: m.type,
      sentence: m.sentence ?? undefined,
    })),
  }));
}

/**
 * Load all question questions for the current user.
 */
export async function loadQuestionQueue() {
  const user = await getAuthUser();
  if (!user) return [];

  const questions = await prisma.questionQueue.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
  });

  return questions.map((q) => ({
    id: q.id,
    questionType: q.questionType as QuestionType,
    status: q.status,
    questionContent: (q.questionContent as Record<string, unknown> | undefined) ?? undefined,
    lastAnswer: (q.lastAnswer as Record<string, unknown> | undefined) ?? undefined,
    wordIds: q.wordIds,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));
}

/**
 * Enqueue a new question into the database for the current user.
 */
export async function enqueueQuestion(
  questionContent: object,
  questionType: QuestionType,
  wordIds: number[]
) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!questionContent || !questionType || !wordIds?.length) {
    throw new Error('缺少题目内容、类型或单词列表');
  }

  const question = await prisma.questionQueue.create({
    data: {
      userId: user.userId,
      questionType: questionType as any,
      status: 'GENERATED',
      questionContent,
      wordIds,
    },
  });

  return {
    id: question.id,
    questionType: question.questionType as QuestionType,
    status: question.status,
    questionContent,
    wordIds,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

/**
 * Enqueue a pending question with GENERATING status.
 * This is used before the AI call to reserve the slot.
 */
export async function enqueuePendingQuestion(
  questionType: QuestionType,
  wordIds: number[]
) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!questionType || !wordIds?.length) {
    throw new Error('缺少题目类型或单词列表');
  }

  const question = await prisma.questionQueue.create({
    data: {
      userId: user.userId,
      questionType: questionType as any,
      status: 'GENERATING',
      wordIds,
    },
  });

  return {
    id: question.id,
    questionType: question.questionType as QuestionType,
    status: question.status,
    questionContent: null as null | undefined,
    wordIds,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

/**
 * Update a generating question with AI-generated content.
 */
export async function updateQuestionWithContent(
  questionId: string,
  questionContent: object,
  questionType: QuestionType,
  wordIds: number[]
) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'GENERATING') throw new Error('题目状态不允许更新');

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      questionType: questionType as any,
      status: 'GENERATED',
      questionContent,
      wordIds,
    },
  });

  return {
    id: updated.id,
    questionType: updated.questionType as QuestionType,
    status: updated.status,
    questionContent,
    wordIds,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Submit an answer for a question.
 */
export async function submitAnswer(questionId: string, answers: Record<string, unknown>) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!answers) throw new Error('缺少作答内容');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'GENERATED') throw new Error('题目尚未生成完毕或已作答');

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      lastAnswer: answers as any,
      status: 'ANSWERED',
    },
  });

  return updated;
}

/**
 * Load a single question by ID.
 */
export async function loadQuestionById(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  return {
    id: q.id,
    questionType: q.questionType as QuestionType,
    status: q.status,
    questionContent: (q.questionContent as Record<string, unknown> | undefined) ?? undefined,
    lastAnswer: (q.lastAnswer as Record<string, unknown> | undefined) ?? undefined,
    wordIds: q.wordIds,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

/**
 * Mark a GENERATING question as FAILED.
 */
export async function markQuestionAsFailed(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  return prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'FAILED' as any,
      questionContent: null as any,
    },
  });
}

/**
 * AI 单个批改翻译句子答案（即时反馈模式）。
 */
export async function gradeTranslateAnswerSingle(questionId: string, questionItemId: number, userAnswer: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  const questionContent = q.questionContent as any;
  if (!questionContent?.questions) {
    throw new Error('题目内容不完整');
  }

  const questions: Array<{
    id: number;
    chinese: string;
    referenceAnswers: string;
    keyWords: string[];
  }> = Array.isArray(questionContent.questions)
    ? questionContent.questions.map((item: any) => ({
        id: item.id,
        chinese: item.chinese,
        referenceAnswers: item.referenceAnswers,
        keyWords: item.keyWords || [],
      }))
    : [];

  const targetQuestion = questions.find(q => q.id === questionItemId);
  if (!targetQuestion) {
    throw new Error('题目不存在');
  }

  const systemPrompt = `你是一位专业的英语翻译批改老师。请根据中文原句、参考答案、必用关键词，对学生输入的英文翻译进行评分。

## 评分规则：
- 满分 10 分
- 评估翻译准确度（语义是否传达正确）、语法正确性、是否使用了必用单词
- 给出简短评语（中文，2-3 句话）

## 输出格式（必须是合法 JSON，不能有任何多余文字）：
{"score": 8, "maxScore": 10, "feedback": "评语"}

只返回 JSON，不要有任何其他文字，不要用代码块包裹。`;

  const userPrompt = `请批改以下翻译练习：
中文：${targetQuestion.chinese}
参考答案：${targetQuestion.referenceAnswers}
必用单词：${targetQuestion.keyWords.join(', ')}
学生答案：${userAnswer}`;

  const result = await callOpenAI(systemPrompt, {
    prompt: userPrompt,
    maxTokens: 300,
  });

  let content = result.content.trim();

  // 尝试提取 JSON 对象
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    content = jsonMatch[0];
  }

  // 尝试移除代码块标记
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  let parsed: { score: number; maxScore: number; feedback: string };
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('JSON 解析失败，原始内容:', content);
    throw new Error(`AI 返回的批改内容不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed.score || !parsed.maxScore || !parsed.feedback) {
    console.error('批改内容缺少必填字段:', parsed);
    throw new Error('AI 返回的批改缺少必填字段');
  }

  return {
    questionId: questionItemId,
    score: parsed.score,
    maxScore: parsed.maxScore,
    feedback: parsed.feedback,
  };
}

/**
 * AI 批量批改翻译句子答案（传统模式）。
 */
export async function gradeTranslateAnswer(questionId: string, answers: Record<number, string>) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  const questionContent = q.questionContent as any;
  if (!questionContent?.questions) {
    throw new Error('题目内容不完整');
  }

  const questions: Array<{
    id: number;
    chinese: string;
    referenceAnswers: string;
    keyWords: string[];
  }> = Array.isArray(questionContent.questions)
    ? questionContent.questions.map((item: any) => ({
        id: item.id,
        chinese: item.chinese,
        referenceAnswers: item.referenceAnswers,
        keyWords: item.keyWords || [],
      }))
    : [];

  const answersList = questions.map(q => ({
    ...q,
    userAnswer: answers[q.id] ?? '',
  }));

  const systemPrompt = `你是一位专业的英语翻译批改老师。请根据中文原句、参考答案、必用关键词，对学生输入的英文翻译进行评分。

## 评分规则：
- 满分 10 分
- 评估翻译准确度（语义是否传达正确）、语法正确性、是否使用了必用单词
- 给出简短评语（中文，2-3 句话）

## 输出格式（必须是合法 JSON）：
{
  "scores": [
    {
      "questionId": 1,
      "score": 8,
      "maxScore": 10,
      "feedback": "评语"
    }
  ]
}

只返回 JSON，不要返回其他文字。`;

  const userPrompt = `请批改以下翻译练习：

${answersList.map((item, i) => `第 ${i + 1} 题:
  中文: ${item.chinese}
  参考答案: ${item.referenceAnswers}
  必用单词: ${item.keyWords.join(', ')}
  学生答案: ${item.userAnswer}`).join('\n---\n')}`;

  const result = await callOpenAI(systemPrompt, {
    prompt: userPrompt,
    maxTokens: 2000,
  });

  let content = result.content.trim();
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  let parsed: { scores: Array<{ questionId: number; score: number; maxScore: number; feedback: string }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回的批改内容不是合法 JSON');
  }

  if (!parsed.scores || !Array.isArray(parsed.scores)) {
    throw new Error('AI 返回的批改缺少 scores 字段');
  }

  return parsed.scores;
}

/**
 * Reset a FAILED question back to GENERATING for retry.
 */
export async function retryQuestion(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'FAILED' as any) throw new Error('题目状态不允许重试');

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'GENERATING',
      questionContent: null as any,
    },
  });

  return {
    id: updated.id,
    questionType: updated.questionType as QuestionType,
    status: updated.status,
    wordIds: updated.wordIds,
  };
}
