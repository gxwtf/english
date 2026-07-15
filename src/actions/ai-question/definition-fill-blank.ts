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

  // 代码随机分配答案词和干扰词，避免 AI 自行抽取
  const shuffledWords = shuffleArray([...wordData]);
  const answerTargets = shuffledWords.slice(0, options.n);
  const distractorWords = shuffledWords.slice(options.n, options.n + options.m);
  const answerTargetTexts = answerTargets.map((w: any) => w.text);
  const allWordTexts = [...answerTargets.map((w: any) => w.text), ...distractorWords.map((w: any) => w.text)];
  const shuffledAllWords = shuffleArray([...allWordTexts]);

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
  "questions": [
    {
      "definition": "___: 英文释义描述",
      "answer": "答案单词"
    },
    ...
  ]
}

## 关键规则（请严格遵循）：
1. questions 数组包含 ${options.n} 道小题，每道题的 answer 必须对应一个**不同的**答案目标词
2. 每个 question 的 definition 是一个英文释义，格式为 "___: 释义内容"，其中 ___ 代表填空位置
3. answer 必须是该题目对应的答案目标词
4. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题**
5. 释义要准确、简洁，适合英语学习者理解
6. 释义不能过于明显以至于一看就知道答案，要有一定的考查性
7. **重要：不要返回 words 字段**，words 字段将由系统自动填充
8. 只返回 JSON，不要返回任何其他文字
9. 使用 generateRandomNumber 工具来随机化题目排列（如果模型支持工具调用）`;

  let relatedWordsSection = '';
  if (actualRelatedEntries && actualRelatedEntries.length > 0) {
    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，它们只能作为干扰词或上下文参考使用：
${JSON.stringify(actualRelatedEntries.map((rw: any) => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}`;
  }

  const userPrompt = `## 答案目标词（共 ${options.n} 个，每道题对应一个，不可遗漏或跳过）：
${JSON.stringify(answerTargets.map((w: any) => ({ text: w.text, meanings: w.meanings })), null, 2)}

## 干扰词（共 ${options.m} 个，仅用于增加选项迷惑性，不出现在答案中）：
${JSON.stringify(distractorWords.map((w: any) => w.text), null, 2)}
${relatedWordsSection}
${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请严格按以下步骤出题：
1. 每个答案目标词生成一道小题，共 ${options.n} 道
2. **不要返回 words 字段**
3. 每道题的 answer 必须是它对应的答案目标词

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
    parsed = extractJSONFromAIContent(content, ['questions']);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  // Handle field aliases
  if (!parsed.questions && parsed.items) parsed.questions = parsed.items;

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回的题目缺少必填字段：questions');
  }

  if (parsed.questions.length !== options.n) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${options.n} 道，实际 ${parsed.questions.length} 道`);
  }

  // 用代码预分配的单词列表接管，确保抽取由代码完成
  parsed.words = [...shuffledAllWords];

  // 验证每个答案都在答案目标词中
  const answerTargetSet = new Set(answerTargetTexts);
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.definition || !q.answer) {
      throw new Error(`第 ${i + 1} 道小题缺少 definition 或 answer 字段`);
    }
    if (!answerTargetSet.has(q.answer)) {
      throw new Error(`AI 返回的答案 "${q.answer}" 不在答案目标词中`);
    }
  }

  // 验证干扰词未被用作任何答案
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
