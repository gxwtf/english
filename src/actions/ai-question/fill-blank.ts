'use server';

import { fetchEnrichedWords, updateQuestionWithContent, enqueuePendingQuestion, markQuestionAsFailed } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { FillBlankOptions } from '@/types/problem';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { aiQueue } from '@/lib/ai-queue';

interface FillBlankQuestion {
  words: string[];
  questions: { sentence: string; answer: string; originalWord?: string }[];
}

/**
 * 创建占位题目（GENERATING 状态），用于在 AI 调用前就在队列中显示。
 */
export async function enqueuePendingFillBlank(
  wordIds: number[],
  options: FillBlankOptions,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }
  if (options?.n == null || options?.m == null) {
    throw new Error('缺少题目参数：n 和 m 为必填项');
  }

  return await enqueuePendingQuestion('fill-blank', wordIds, relatedWordEntries);
}

/**
 * 生成选词填空题目并入库。
 *
 * @param wordIds - 用户选择的单词 ID 列表
 * @param options - 选词填空参数：n（题目数量），m（多余单词数量）
 * @param customPrompt - 可选的自定义提示词
 * @param deepThinking - 是否开启深度思考模式
 * @returns 题目内容对象
 */
export async function generateAndEnqueueFillBlank(
  wordIds: number[],
  options: FillBlankOptions,
  customPrompt?: string,
  deepThinking?: boolean,
) {
  return await doGenerateFillBlank(wordIds, options, customPrompt, deepThinking);
}

/**
 * 生成选词填空题目，并更新一个已存在的 GENERATING 状态的占位题目。
 * @param questionId - 占位题目的 ID
 * @param wordIds - 用户选择的单词 ID 列表
 * @param options - 选词填空参数
 * @param customPrompt - 可选的自定义提示词
 * @param deepThinking - 是否开启深度思考模式
 * @param relatedWordEntries - 关联词信息列表（不在选中列表中的关联词）
 * @param allowFormChange - 是否允许改变单词形式
 */
export async function generateFillBlankWithQuestion(
  questionId: string,
  wordIds: number[],
  options: FillBlankOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
  allowFormChange?: boolean,
) {
  console.log('[generateFillBlankWithQuestion]', questionId);
  return new Promise((resolve, reject) => {
    aiQueue.addTask(questionId, async () => {
      try {
        const parsed = await doGenerateFillBlank(wordIds, options, customPrompt, deepThinking, relatedWordEntries, allowFormChange);
        const result = await updateQuestionWithContent(questionId, parsed, 'fill-blank', wordIds);
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

async function doGenerateFillBlank(
  wordIds: number[],
  options: FillBlankOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
  allowFormChange?: boolean,
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }
  if (options?.n == null || options?.m == null) {
    throw new Error('缺少题目参数：n 和 m 为必填项');
  }
  if (options.n < 1) {
    throw new Error('题目数量 n 必须 >= 1');
  }
  if (options.m < 0) {
    throw new Error('多余单词数量 m 必须 >= 0');
  }
  if (options.n + options.m > 11) {
    throw new Error('n + m 不能超过 11');
  }
  const totalAvailable = wordIds.length + (relatedWordEntries?.length || 0);
  if (options.n + options.m > totalAvailable) {
    throw new Error(`需要 ${options.n + options.m} 个单词，但前端只传递了 ${wordIds.length} 个核心词和 ${relatedWordEntries?.length || 0} 个关联词`);
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) {
    throw new Error('所选单词不存在');
  }

  const randomTool = {
    type: 'function' as const,
    function: {
      name: 'generateRandomNumber',
      description: 'Generate a random integer within a specified range. Use this to randomize word order, question numbering, and other random selections.',
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

  const systemPrompt = `
总体要求：${SYSTEM_MESSAGE}

你是一位专业的英语考试题目生成专家。请根据提供的单词列表，生成一道"选词填空"练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "words": ["可用单词1","可用单词2",...],
  "questions": [
    {
      "sentence": "包含 _ 的一个句子",
      "answer": "答案单词",
      "originalWord": "原始单词（仅当答案不是原文时填写）"
    },
    ...
  ]
}

## 关键规则：
1. words 数组包含 ${options.n + options.m} 个可供选择的单词（从提供的单词列表中选取）
2. questions 数组包含 ${options.n} 道小题
3. 每个 question 的 sentence 中必须包含一个 _ （下划线）表示填空位置
4. answer 必须是填空处实际需要的单词形式（如果需要变体形式，answer 就写变体形式）
5. 如果有多个答案，answer 字段用英文分号 ; 分隔
6. 句子要自然流畅，难度适合英语学习者
7. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题，帮助用户针对性地练习薄弱环节**
${allowFormChange ? `8. **重要：允许改变形式模式已开启** — 约 2/3 的题目中，你必须将单词变为不同形式出现在句子的填空处（例如：不同时态、动词/名词形式转换等）。此时 answer 字段应填写实际需要的变体形式（如 "tendency"），同时必须填写 originalWord 字段为原始单词（如 "tend"），以便前端识别这是形式变化。` : `8. 每个填空处的答案必须是 words 数组中某个单词的原文，originalWord 字段不需要填写`}
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来打乱单词顺序和随机化题目排列（如果模型支持工具调用）`;

  // Build the user prompt with optional related words section
  let relatedWordsSection = '';
  if (relatedWordEntries && relatedWordEntries.length > 0) {
    const differentFormWords = relatedWordEntries.filter(rw => rw.types.includes('different_form'));
    const easilyConfusedWords = relatedWordEntries.filter(rw => rw.types.includes('easily_confused'));

    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，请将它们纳入可选单词池：
${JSON.stringify(relatedWordEntries.map(rw => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}

### 关联词出题指导：
- 关联词没有标注特定释义，你可以考察其任意释义
${differentFormWords.length > 0 ? `- **不同形式（different_form）**：${differentFormWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词是同一词的不同形式（如名词/动词形式转换），你可以设计考察词形变化的题目` : ''}
${easilyConfusedWords.length > 0 ? `- **容易混淆（easily_confused）**：${easilyConfusedWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词容易混淆，你可以设计辨析类题目，让填空处需要仔细区分才能选对` : ''}`;
  }

  const userPrompt = `提供的单词列表（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordsSection}
${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请生成符合上述要求的选词填空题目 JSON。`;

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

  let parsed: FillBlankQuestion;
  try {
    console.log('AI response:', content);
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  const required = ['words', 'questions'];
  for (const key of required) {
    if (!(key in parsed) || !parsed[key as keyof FillBlankQuestion]) {
      throw new Error(`AI 返回的题目缺少必填字段：${key}`);
    }
  }

  if (!Array.isArray(parsed.words)) {
    throw new Error('words 字段必须是一个数组');
  }
  if (!Array.isArray(parsed.questions)) {
    throw new Error('questions 字段必须是一个数组');
  }

  const expectedWordCount = options.n + options.m;
  if (parsed.words.length !== expectedWordCount) {
    throw new Error(`AI 返回的单词数量不正确，期望 ${expectedWordCount} 个，实际 ${parsed.words.length} 个`);
  }
  const uniqueWords = new Set(parsed.words);
  if (uniqueWords.size < expectedWordCount) {
    throw new Error(`AI 返回的单词列表包含重复项，请使用不同的单词`);
  }

  if (parsed.questions.length !== options.n) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${options.n} 道，实际 ${parsed.questions.length} 道`);
  }

  // Collect all unique answers from questions and verify each is in the words array
  // When allowFormChange is true, answers may be variant forms not in words array,
  // but must have originalWord pointing to a word in the array
  const missingWords = new Set<string>();
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.sentence || !q.answer) {
      throw new Error(`第 ${i + 1} 道小题缺少 sentence 或 answer 字段`);
    }
    if (!q.sentence.includes('_')) {
      throw new Error(`第 ${i + 1} 道小题的句子中没有填空位置（缺少下划线 _），请重新生成包含填空的句子`);
    }
    if (allowFormChange && q.originalWord) {
      // Form change mode: answer can be a variant form, but originalWord must be in words array
      if (!uniqueWords.has(q.originalWord)) {
        missingWords.add(q.originalWord);
      }
    } else if (!uniqueWords.has(q.answer)) {
      missingWords.add(q.answer);
    }
  }
  if (missingWords.size > 0) {
    throw new Error(`AI 返回的答案中包含不在单词池中的单词: ${Array.from(missingWords).join(', ')}`);
  }

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) {
    resultContent.thinking = thinkingContent;
  }

  return resultContent;
}
