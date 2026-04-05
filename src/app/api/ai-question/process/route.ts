// API 路由：处理队列头部的 GENERATING 题目
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { callOpenAI } from '@/lib/openai';

/**
 * GET - 处理队头第一个 GENERATING 状态的题目
 *
 * 流程:
 * 1. 查找第一个 GENERATING 状态的题目
 * 2. 根据 wordIds 获取对应的单词文本和释义
 * 3. 调用 AI 接口生成题目
 * 4. 将生成的题目写入 questionContent，状态更新为 GENERATED
 */
export async function GET(request: NextRequest) {
  try {
    // 查找队头第一个待处理的题目
    const question = await prisma.questionQueue.findFirst({
      where: { status: 'GENERATING' },
      orderBy: { createdAt: 'asc' },
    });

    if (!question) {
      return NextResponse.json({ success: false, message: '队列为空，没有待处理的题目' });
    }

    const wordIds = question.wordIds as number[];

    // 获取对应的单词信息（包含释义）
    const words = await prisma.word.findMany({
      where: { id: { in: wordIds } },
      include: { meanings: true },
    });

    if (words.length === 0) {
      // 单词不存在了，标记为失败（用 GENERATING 状态兜底，实际不会被前端展示）
      await prisma.questionQueue.update({
        where: { id: question.id },
        data: {
          questionContent: { error: '所选单词不存在' } as unknown as object,
        },
      });
      return NextResponse.json(
        { success: false, message: '所选单词不存在', questionId: question.id },
        { status: 400 }
      );
    }

    // 构建单词数据列表，用于传入 prompt
    const wordData = words.map(w => ({
      id: w.id,
      text: w.text,
      meanings: w.meanings.map(m => ({ content: m.content, type: m.type, sentence: m.sentence ?? undefined })),
    }));

    // 获取用户的自定义 prompt（从请求 URL 的 searchParams 读取，或传 body）
    // 由于是 GET 请求，这里先使用默认 prompt 模板
    // 后续用户可以扩展此路由传入自定义 prompt
    const { searchParams } = new URL(request.url);
    const customPrompt = searchParams.get('prompt') || '';

    // 构建生成题目的 Prompt
    const systemPrompt = buildSystemPrompt(question.questionType as string);
    const userPrompt = buildUserPrompt(wordData, question.questionType as string, customPrompt);

    // 调用 AI 接口生成题目
    const aiResult = await callOpenAI(systemPrompt, { prompt: userPrompt });

    // 解析 AI 返回的题目内容（期望返回 JSON）
    let questionContent: object;
    try {
      questionContent = JSON.parse(aiResult.content);
    } catch {
      // 如果返回的不是 JSON，就原样存储为字符串
      questionContent = { raw: aiResult.content };
    }

    // 更新题目状态为 GENERATED
    await prisma.questionQueue.update({
      where: { id: question.id },
      data: {
        status: 'GENERATED',
        questionContent,
      },
    });

    return NextResponse.json({
      success: true,
      questionId: question.id,
      questionContent,
    });
  } catch (error) {
    console.error('处理题目生成失败:', error);

    // 标记当前处理中的题目（如果有）
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

    return NextResponse.json({ error: '生成失败' }, { status: 500 });
  }
}

/**
 * 构建系统提示词
 */
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
      "referenceAnswer": "参考英文翻译",
      "keyWords": ["必须使用的单词"]
    }
  ]
}`;
  }

  return `你是一个英语题目生成器。请根据提供的单词生成练习题。必须以 JSON 格式返回。`;
}

/**
 * 构建用户提示词
 */
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
