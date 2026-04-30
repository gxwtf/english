'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';

interface MeaningSelectQuestion {
  title: string;
  questions: MeaningSelectQuestionItem[];
}

interface MeaningSelectQuestionItem {
  id: number;
  type: string;
  word: string;
  chinese: string;
  options: string[];
  correctAnswer: string;
}

/**
 * 创建占位题目（GENERATING 状态），用于在 AI 调用前就在队列中显示。
 */
export async function enqueuePendingMeaningSelect(
  wordIds: number[],
  deepThinking?: boolean,
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  return await enqueuePendingQuestion('meaning-select', wordIds);
}

/**
 * 生成英译中（选词义）题目并入库。
 *
 * @param wordIds - 用户选择的单词 ID 列表
 * @param deepThinking - 是否开启深度思考模式
 * @returns 题目内容对象
 */
export async function generateAndEnqueueMeaningSelect(
  wordIds: number[],
  deepThinking?: boolean,
) {
  return await doGenerateMeaningSelect(wordIds, deepThinking);
}

/**
 * 生成英译中（选词义）题目，并更新一个已存在的 GENERATING 状态的占位题目。
 * @param questionId - 占位题目的 ID
 * @param wordIds - 用户选择的单词 ID 列表
 * @param deepThinking - 是否开启深度思考模式
 * @param relatedWordEntries - 关联词信息列表（不在选中列表中的关联词）
 */
export async function generateMeaningSelectWithQuestion(
  questionId: string,
  wordIds: number[],
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  const parsed = await doGenerateMeaningSelect(wordIds, deepThinking, relatedWordEntries);
  return await updateQuestionWithContent(questionId, parsed, 'meaning-select', wordIds);
}

async function doGenerateMeaningSelect(
  wordIds: number[],
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) {
    throw new Error('所选单词不存在');
  }

  const randomTool = {
    type: 'function' as const,
    function: {
      name: 'generateRandomNumber',
      description: 'Generate a random integer within a specified range. Use this to randomize question order and option positions.',
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

你是一位专业的英语词汇测试专家。请根据提供的单词列表，生成一道"英译中"选择题练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "title": "题目标题",
  "questions": [
    {
      "id": 1,
      "type": "en_to_zh",
      "word": "英文单词",
      "chinese": "中文释义",
      "options": ["选项 A 的中文释义", "选项 B 的中文释义", "选项 C 的中文释义", "选项 D 的中文释义"],
      "correctAnswer": "正确选项的中文释义"
    }
  ]
}

## 关键规则：
1. questions 数组必须为每个提供的单词生成 1 道小题
2. type 固定为 "en_to_zh"（英译中选择题）
3. word 是要考察的英文单词
4. chinese 是该单词的正确中文释义（从用户不熟悉的释义中选择）
5. options 必须包含恰好 4 个选项，其中只有 1 个是正确的
6. correctAnswer 必须与 options 中的某个选项完全一致
7. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先考察这些释义**
8. 干扰选项应该是其他单词的释义，或者是容易混淆的释义
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来随机化选项顺序（如果模型支持工具调用）`;

  // Build the user prompt with optional related words section
  let relatedWordsSection = '';
  if (relatedWordEntries && relatedWordEntries.length > 0) {
    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，它们没有标注特定释义，AI 可以考察其任意释义。请将这些关联词也纳入可选单词池：
${JSON.stringify(relatedWordEntries.map(rw => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}`;
  }

  const userPrompt = `提供的单词列表（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordsSection}

请生成符合上述要求的英译中选择题 JSON。`;

  const result = await callOpenAIWithTools(systemPrompt, {
    prompt: userPrompt,
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

  let parsed: MeaningSelectQuestion;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回的题目缺少必填字段：title 或 questions');
  }

  // Generate questions for each word if not already done
  const expectedQuestions = wordData.length;
  if (parsed.questions.length !== expectedQuestions) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${expectedQuestions} 道，实际 ${parsed.questions.length} 道`);
  }

  // Validate each question
  for (const q of parsed.questions) {
    if (!q.id || !q.word || !q.chinese || !q.options || !q.correctAnswer) {
      throw new Error('翻译题目中某一题缺少必填字段');
    }
    q.type = q.type || 'en_to_zh';
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`题目的 options 字段必须是包含恰好 4 个选项的数组`);
    }
    if (!q.options.includes(q.correctAnswer)) {
      throw new Error(`correctAnswer 必须是 options 中的一个选项`);
    }
  }

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) {
    resultContent.thinking = thinkingContent;
  }

  return resultContent;
}
