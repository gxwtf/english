'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent, markQuestionAsFailed } from './utils';
import { embedGenerationOptions, extractJSONFromAIContent } from './shared-utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { DefinitionFillBlankOptions } from '@/types/problem';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { aiQueue, withTimeout } from '@/lib/ai-queue';

const GENERATION_TIMEOUT_MS = 600_000; // 10 分钟

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

interface DefinitionFillBlankQuestion {
  words: string[];
  questions: { definition: string; answer: string }[];
}

export async function enqueuePendingDefinitionFillBlank(
  wordIds: number[],
  options: DefinitionFillBlankOptions,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) throw new Error('缺少单词列表');
  if (options?.n == null || options?.m == null) throw new Error('缺少题目参数：n 和 m 为必填项');
  return await enqueuePendingQuestion('definition-fill-blank', wordIds, embedGenerationOptions(relatedWordEntries, options));
}

export async function generateAndEnqueueDefinitionFillBlank(
  wordIds: number[],
  options: DefinitionFillBlankOptions,
  customPrompt?: string,
  deepThinking?: boolean,
) {
  return await doGenerateDefinitionFillBlank(wordIds, options, customPrompt, deepThinking);
}

export async function generateDefinitionFillBlankWithQuestion(
  questionId: string,
  wordIds: number[],
  options: DefinitionFillBlankOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  return new Promise((resolve, reject) => {
    aiQueue.addTask(questionId, async () => {
      const runGeneration = async () => {
        const parsed = await doGenerateDefinitionFillBlank(wordIds, options, customPrompt, deepThinking, relatedWordEntries);
        const result = await updateQuestionWithContent(questionId, parsed, 'definition-fill-blank', wordIds);
        resolve(result);
      };

      try {
        await withTimeout(
          runGeneration(),
          GENERATION_TIMEOUT_MS,
          new Error(`生成词义填空题目超时（${GENERATION_TIMEOUT_MS / 1000}s）`)
        );
      } catch (error) {
        try { await markQuestionAsFailed(questionId); } catch (e) { console.error('标记题目失败状态时出错:', e); }
        reject(error);
      }
    });
  });
}

async function doGenerateDefinitionFillBlank(
  wordIds: number[],
  options: DefinitionFillBlankOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) throw new Error('缺少单词列表');
  if (options?.n == null || options?.m == null) throw new Error('缺少题目参数：n 和 m 为必填项');
  if (options.n < 1) throw new Error('题目数量 n 必须 >= 1');
  if (options.m < 0) throw new Error('多余单词数量 m 必须 >= 0');
  if (options.n + options.m > 11) throw new Error('n + m 不能超过 11');

  // 排除 _genOptions 标记条目后计算实际可用词数
  const actualRelatedEntries = (relatedWordEntries || []).filter((r: any) => !r._genOptions);
  const totalAvailable = wordIds.length + (actualRelatedEntries.length || 0);
  if (options.n + options.m > totalAvailable) {
    throw new Error(`需要 ${options.n + options.m} 个单词，但前端只传递了 ${wordIds.length} 个核心词和 ${actualRelatedEntries.length || 0} 个关联词`);
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) throw new Error('所选单词不存在');
  // 检查至少有一些单词含有释义，避免无意义消耗 AI 配额
  const wordsWithMeanings = wordData.filter((w: any) => w.meanings && Array.isArray(w.meanings) && w.meanings.length > 0);
  if (wordsWithMeanings.length === 0) throw new Error('选中的单词均无释义数据，请先为单词添加释义后再出题');

  const randomTool = {
    type: 'function' as const,
    function: {
      name: 'generateRandomNumber',
      description: 'Generate a random integer within a specified range. Use this to randomize word order and question numbering.',
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

你是一位专业的英语词汇测试专家。请根据提供的单词列表，生成一道"词义填空"练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "words": ["可用单词1","可用单词2",...],
  "questions": [
    {
      "definition": "___: 英文释义描述",
      "answer": "答案单词"
    },
    ...
  ]
}

## 关键规则：
1. words 数组包含 ${options.n + options.m} 个可供选择的单词（从提供的单词列表中选取）
2. questions 数组包含 ${options.n} 道小题
3. 每个 question 的 definition 是一个英文释义，格式为 "___: 释义内容"，其中 ___ 代表填空位置
4. answer 必须是 words 数组中的某个单词
5. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题**
6. 释义要准确、简洁，适合英语学习者理解
7. 释义不能过于明显以至于一看就知道答案，要有一定的考查性
8. **重要：words 数组中的 ${options.m} 个干扰词（即未被选为答案的单词）不应出现在任何题目的答案中，它们只是为了增加迷惑性。正确答案必须从 ${options.n} 个非干扰词中选取。**
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来打乱单词顺序和随机化题目排列（如果模型支持工具调用）`;

  let relatedWordsSection = '';
  if (actualRelatedEntries && actualRelatedEntries.length > 0) {
    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，请将它们纳入可选单词池：
${JSON.stringify(actualRelatedEntries.map((rw: any) => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}`;
  }

  const userPrompt = `提供的单词列表（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordsSection}
${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请生成符合上述要求的词义填空题目 JSON。`;

  const aiOptions: Record<string, unknown> = {
    prompt: userPrompt,
    tools: [randomTool],
    response_format: { type: 'json_object' },
  };
  if (deepThinking) {
    aiOptions.reasoning_effort = deepThinking;
  }

  const result = await callOpenAIWithTools(systemPrompt, aiOptions);

  let content = result.content.trim();
  let thinkingContent: string | null = null;
  {
    const parsed = parseThinkingContent(content);
    thinkingContent = parsed.thinking;
    content = parsed.content.trim();
  }

  let parsed: any;
  try {
    parsed = extractJSONFromAIContent(content, ['words', 'questions']);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  // Handle field aliases
  if (!parsed.words && parsed.word_list) parsed.words = parsed.word_list;
  if (!parsed.words && parsed.candidates) parsed.words = parsed.candidates;
  if (!parsed.questions && parsed.items) parsed.questions = parsed.items;

  const required = ['words', 'questions'];
  for (const key of required) {
    if (!parsed[key]) {
      throw new Error(`AI 返回的题目缺少必填字段：${key}`);
    }
  }

  if (!Array.isArray(parsed.words)) throw new Error('words 字段必须是一个数组');
  if (!Array.isArray(parsed.questions)) throw new Error('questions 字段必须是一个数组');

  const expectedWordCount = options.n + options.m;
  if (parsed.words.length !== expectedWordCount) {
    throw new Error(`AI 返回的单词数量不正确，期望 ${expectedWordCount} 个，实际 ${parsed.words.length} 个`);
  }
  const uniqueWords = new Set(parsed.words);
  if (uniqueWords.size < expectedWordCount) {
    throw new Error('AI 返回的单词列表包含重复项');
  }

  if (parsed.questions.length !== options.n) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${options.n} 道，实际 ${parsed.questions.length} 道`);
  }

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.definition || !q.answer) {
      throw new Error(`第 ${i + 1} 道小题缺少 definition 或 answer 字段`);
    }
    if (!uniqueWords.has(q.answer)) {
      throw new Error(`AI 返回的答案 "${q.answer}" 不在单词池中`);
    }
  }

  // 验证干扰词（m 个）未被用作任何答案
  if (options.m > 0) {
    const answerWords = new Set(parsed.questions.map((q: any) => q.answer));
    const nonAnswerWords = parsed.words.filter((w: string) => !answerWords.has(w));
    if (nonAnswerWords.length < options.m) {
      throw new Error(`AI 返回的干扰词数量不正确，期望至少 ${options.m} 个单词未出现在答案中，实际 ${nonAnswerWords.length} 个`);
    }
  }

  // 打乱可选单词顺序和题目顺序，避免答案与原始单词表顺序一致
  parsed.words = shuffleArray([...parsed.words]);
  parsed.questions = shuffleArray([...parsed.questions]);

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) resultContent.thinking = thinkingContent;
  return resultContent;
}
