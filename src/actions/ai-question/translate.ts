'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent, markQuestionAsFailed } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { TranslateOptions } from '@/types/problem';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { aiQueue } from '@/lib/ai-queue';

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
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  return await enqueuePendingQuestion('translate', wordIds, relatedWordEntries);
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
 * @param relatedWordEntries - 关联词信息列表（不在选中列表中的关联词）
 */
export async function generateTranslateWithQuestion(
  questionId: string,
  wordIds: number[],
  options: TranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  return new Promise((resolve, reject) => {
    aiQueue.addTask(questionId, async () => {
      try {
        const parsed = await doGenerateTranslate(wordIds, options, customPrompt, deepThinking, relatedWordEntries);
        const result = await updateQuestionWithContent(questionId, parsed, 'translate', wordIds);
        resolve(result);
      } catch (error) {
        try {
          await markQuestionAsFailed(questionId);
        } catch (e) {
          console.error('标记题目失败状态时出错:', e);
        }
        reject(error);
      }
    });
  });
}

async function doGenerateTranslate(
  wordIds: number[],
  options: TranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
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
  const totalAvailable = wordIds.length + (relatedWordEntries?.length || 0);
  if (options.n > totalAvailable) {
    throw new Error(`需要 ${options.n} 个单词，但前端只传递了 ${wordIds.length} 个核心词和 ${relatedWordEntries?.length || 0} 个关联词`);
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
6. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题，帮助用户针对性地练习薄弱环节**
7. 题目难度要适合英语学习者，中文句子要自然流畅
8. 生成的英文翻译语法正确且自然
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来随机化题目排列和关键词选择（如果模型支持工具调用）
11. **重要：你可以任意改变这些单词的时态语态（例：run -> ran; run -> to run）**`;

  const userPrompt = `提供的单词列表（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordEntries && relatedWordEntries.length > 0 ? (() => {
    const differentFormWords = relatedWordEntries.filter(rw => rw.types.includes('different_form'));
    const easilyConfusedWords = relatedWordEntries.filter(rw => rw.types.includes('easily_confused'));
    return `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，可以作为 keyWords 使用：
${JSON.stringify(relatedWordEntries.map(rw => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}

### 关联词出题指导：
- 关联词没有标注特定释义，你可以考察其任意释义
${differentFormWords.length > 0 ? `- **不同形式（different_form）**：${differentFormWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词是同一词的不同形式，你可以设计考察词形变化的翻译题` : ''}
${easilyConfusedWords.length > 0 ? `- **容易混淆（easily_confused）**：${easilyConfusedWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词容易混淆，你可以设计辨析类翻译题` : ''}`;
  })() : ''}
${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请生成符合上述要求的翻译题目 JSON。`;

  const result = await callOpenAIWithTools(systemPrompt, {
    prompt: userPrompt,
    tools: [randomTool],
    response_format: { type: 'json_object' }, // 强制返回合法JSON
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
