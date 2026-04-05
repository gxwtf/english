'use server';

import { prisma } from '@/lib/db';
import { callOpenAI } from '@/lib/openai';
import { getAuthUser } from './auth';
import { QuestionType } from '@/types/word';

// GET /api/ai-question -> loadQuestionQueue
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

// POST /api/ai-question -> createQuestion
export async function createQuestion(questionType: string, wordIds: number[]) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!questionType || !wordIds?.length) {
    throw new Error('缺少题目类型或单词列表');
  }

  if (!['fill-blank', 'translate'].includes(questionType)) {
    throw new Error('无效的题目类型');
  }

  const question = await prisma.questionQueue.create({
    data: {
      userId: user.userId,
      questionType: questionType as any,
      status: 'GENERATING',
      wordIds,
    },
  });

  return question;
}

// GET /api/ai-question/process -> processQuestionQueue
export async function processQuestionQueue(prompt?: string) {
  try {
    const question = await prisma.questionQueue.findFirst({
      where: { status: 'GENERATING' },
      orderBy: { createdAt: 'asc' },
    });

    if (!question) {
      return { success: false, message: '队列为空，没有待处理的题目' };
    }

    const wordIds = question.wordIds as number[];

    const words = await prisma.word.findMany({
      where: { id: { in: wordIds } },
      include: { meanings: true },
    });

    if (words.length === 0) {
      await prisma.questionQueue.update({
        where: { id: question.id },
        data: {
          questionContent: { error: '所选单词不存在' } as unknown as object,
        },
      });
      return { success: false, message: '所选单词不存在', questionId: question.id };
    }

    const wordData = words.map((w) => ({
      id: w.id,
      text: w.text,
      meanings: w.meanings.map((m) => ({
        content: m.content,
        type: m.type,
        sentence: m.sentence ?? undefined,
      })),
    }));

    const customPrompt = prompt || '';
    const systemPrompt = buildSystemPrompt(question.questionType as string);
    const userPrompt = buildUserPrompt(wordData, question.questionType as string, customPrompt);

    const aiResult = await callOpenAI(systemPrompt, { prompt: userPrompt });

    let questionContent: object;
    try {
      questionContent = JSON.parse(aiResult.content);
    } catch {
      questionContent = { raw: aiResult.content };
    }

    await prisma.questionQueue.update({
      where: { id: question.id },
      data: {
        status: 'GENERATED',
        questionContent,
      },
    });

    return {
      success: true,
      questionId: question.id,
      questionContent,
    };
  } catch (error) {
    console.error('处理题目生成失败:', error);

    const currentQuestion = await prisma.questionQueue.findFirst({
      where: { status: 'GENERATING' },
      orderBy: { createdAt: 'asc' },
    });

    if (currentQuestion) {
      await prisma.questionQueue.update({
        where: { id: currentQuestion.id },
        data: {
          questionContent: { error: '生成失败，请重试' } as unknown as object,
          status: 'GENERATED',
        },
      });
    }

    return { success: false, error: '生成失败' };
  }
}

// POST /api/ai-question/[id]/answer -> submitAnswer
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

function buildSystemPrompt(questionType: string): string {
  if (questionType === 'fill-blank') {
    return `你是一个英语题目生成器。你的任务是根据提供的英语单词和释义，生成选词填空题。

规则：
1. 生成一个英文段落，其中挖掉若干个空（使用提供的单词作为答案）
2. 每个空对应一个编号，提供选项列表
3. 提供正确答案
4. 难度适中，语境自然
5. 必须以 JSON 格式返回，不要任何额外的解释文字

JSON 格式要求：
{
  "title": "题目标题",
  "instructions": "作答说明",
  "passage": "包含 [1], [2], [3]... 标记挖空位置的段落",
  "options": {
    "1": ["选项A", "选项B", "选项C", "选项D"],
    "2": ["选项A", "选项B", "选项C", "选项D"]
  },
  "answers": {
    "1": "正确答案",
    "2": "正确答案"
  }
}`;
  }

  if (questionType === 'translate') {
    return `你是一个英语题目生成器。你的任务是根据提供的英语单词和释义，生成翻译题。

规则：
1. 提供中文句子，要求翻译成英文并使用提供的单词
2. 或者提供英文句子，要求翻译成中文
3. 提供参考答案
4. 必须以 JSON 格式返回，不要任何额外的解释文字

JSON 格式要求：
{
  "title": "题目标题",
  "questions": [
    {
      "id": 1,
      "type": "cn_to_en",
      "chinese": "中文句子",
      "hint": "提示：使用的关键词",
      "referenceAnswers": "参考英文翻译",
      "keyWords": ["必须使用的单词"]
    }
  ]
}`;
  }

  return `你是一个英语题目生成器。请根据提供的单词生成练习题。必须以 JSON 格式返回。`;
}

function buildUserPrompt(
  wordData: { id: number; text: string; meanings: { content: string; type: string; sentence?: string }[] }[],
  questionType: string,
  customPrompt: string
): string {
  let prompt = `请根据以下单词生成${questionType === 'fill-blank' ? '选词填空' : '翻译'}题目：\n\n`;

  for (const word of wordData) {
    prompt += `### 单词: ${word.text}\n`;
    if (word.meanings.length > 0) {
      for (const meaning of word.meanings) {
        prompt += `  - [${meaning.type}] ${meaning.content}`;
        if (meaning.sentence) {
          prompt += `\n    例句: ${meaning.sentence}`;
        }
        prompt += '\n';
      }
    }
    prompt += '\n';
  }

  if (customPrompt) {
    prompt += `\n额外要求：${customPrompt}`;
  }

  return prompt;
}
