'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { TranslateOptions } from '@/types/problem';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';

interface TranslateQuestion {
  title: string;
  questions: TranslateQuestionItem[];
}

interface TranslateQuestionItem {
  id: number;
  type: string;
  chinese: string;
  hint: string;
  referenceAnswers: string;
  keyWords: string[];
}

/**
 * 创建占位题目（GENERATING 状态），用于在 AI 调用前就在队列中显示。
 */
export async function enqueuePendingTranslate(
  wordIds: number[],
  options: TranslateOptions,
  deepThinking?: boolean,
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  return await enqueuePendingQuestion('translate', wordIds);
}

/**
 * 生成翻译句子题目并入库。
 *
 * @param wordIds - 用户选择的单词 ID 列表
 * @param options - 翻译题目参数
 * @param customPrompt - 可选的自定义提示词
 * @param deepThinking - 是否开启深度思考模式
 * @returns 题目内容对象
 */
export async function generateAndEnqueueTranslate(
  wordIds: number[],
  options: TranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
) {
  return await doGenerateTranslate(wordIds, options, customPrompt, deepThinking);
}

/**
 * 生成翻译句子题目，并更新一个已存在的 GENERATING 状态的占位题目。
 * @param questionId - 占位题目的 ID
 * @param wordIds - 用户选择的单词 ID 列表
 * @param options - 翻译题目参数
 * @param customPrompt - 可选的自定义提示词
 * @param deepThinking - 是否开启深度思考模式
 */
export async function generateTranslateWithQuestion(
  questionId: string,
  wordIds: number[],
  options: TranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
) {
  const parsed = await doGenerateTranslate(wordIds, options, customPrompt, deepThinking);
  return await updateQuestionWithContent(questionId, parsed, 'translate', wordIds);
}

async function doGenerateTranslate(
  wordIds: number[],
  options: TranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }
  if (options?.n == null) {
    throw new Error('缺少题目参数：n 为必填项');
  }
  if (options.n < 1) {
    throw new Error('题目数量 n 必须 >= 1');
  }
  // 前端已完成抽词，后端信任前端传递的单词数量
  // 如果前端传递的单词数量不足，可能是前端抽词逻辑有误
  if (options.n > wordIds.length) {
    throw new Error(`需要 ${options.n} 个单词，但前端只传递了 ${wordIds.length} 个`);
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) {
    throw new Error('所选单词不存在');
  }

  const randomTool = {
    type: 'function' as const,
    function: {
      name: 'generateRandomNumber',
      description: 'Generate a random integer within a specified range. Use this to randomize question order and word selection.',
      parameters: {
        type: 'object',
        properties: {
          min: { type: 'number', description: 'Minimum value (inclusive)' },
          max: { type: 'number', description: 'Maximum value (inclusive)' },
        },
        required: ['min', 'max'],
      },
    },
  };

  const systemPrompt = `${SYSTEM_MESSAGE}

你是一位专业的英语考试题目生成专家。请根据提供的单词列表，生成 ${options.n} 道"中译英"翻译练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "title": "题目标题",
  "questions": [
    {
      "id": 1,
      "type": "cn_to_en",
      "chinese": "中文句子",
      "hint": "提示信息（可以是语法提示或场景描述）",
      "referenceAnswers": "标准英文翻译",
      "keyWords": ["必须使用的单词"]
    }
  ]
}

## 关键规则：
1. questions 必须是恰好 ${options.n} 个元素的数组，每个元素代表一道翻译题
2. type 固定为 "cn_to_en"（中译英）
3. chinese 是中文句子，要翻译成英文
4. referenceAnswers 是标准的英文翻译，必须包含 keyWords 中的单词
5. keyWords 是从提供的单词表中挑选的关键词，学生翻译时必须用到，**每道题必须恰好一个单词**
6. **重要：如果单词释义后面标注了【用户不熟悉，需重点练习】，请优先围绕这些不熟悉的含义出题，帮助用户针对性地练习薄弱环节**
7. 题目难度要适合英语学习者，中文句子要自然流畅
8. 生成的英文翻译语法正确且自然
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来随机化题目排列和关键词选择（如果模型支持工具调用）`;

  const userPrompt = `提供的单词列表（注意：【用户不熟悉，需重点练习】标注的是用户需要加强的含义）：
${JSON.stringify(wordData, null, 2)}

${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请生成符合上述要求的翻译题目 JSON。`;

  const result = await callOpenAIWithTools(systemPrompt, {
    prompt: userPrompt,
    maxTokens: 6000,
    tools: [randomTool],
  });

  let content = result.content.trim();

  // 始终解析 reason 标签（深度思考模式已强制开启）
  let thinkingContent: string | null = null;
  {
    const parsed = parseThinkingContent(content);
    thinkingContent = parsed.thinking;
    content = parsed.content.trim();
  }

  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  let parsed: TranslateQuestion;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回的题目缺少必填字段：title 或 questions');
  }

  if (parsed.questions.length !== options.n) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${options.n} 道，实际 ${parsed.questions.length} 道`);
  }

  for (const q of parsed.questions) {
    if (!q.id || !q.chinese || !q.referenceAnswers) {
      throw new Error('翻译题目中某一题缺少必填字段');
    }
    q.type = q.type || 'cn_to_en';
    q.keyWords = q.keyWords || [];
    q.hint = q.hint || '';
    if (q.keyWords.length !== 1) {
      throw new Error(`翻译题目中每一题的 keyWords 必须恰好一个，实际 ${q.keyWords.length} 个`);
    }
  }

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) {
    resultContent.thinking = thinkingContent;
  }

  return resultContent;
}
