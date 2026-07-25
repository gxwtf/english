'use server';

import { fetchEnrichedWords, updateQuestionWithContent, enqueuePendingQuestion, markQuestionAsFailed } from './utils';
import { extractJSONFromAIContent, embedGenerationOptions } from './shared-utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { FillBlankOptions } from '@/types/problem';
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

  // 将生成参数嵌入 relatedWordEntries 以便重试时恢复
  return await enqueuePendingQuestion('fill-blank', wordIds, embedGenerationOptions(relatedWordEntries, options));
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
      const runGeneration = async () => {
        const parsed = await doGenerateFillBlank(wordIds, options, customPrompt, deepThinking, relatedWordEntries, allowFormChange);
        const result = await updateQuestionWithContent(questionId, parsed, 'fill-blank', wordIds);
        resolve(result);
      };

      try {
        await withTimeout(
          runGeneration(),
          GENERATION_TIMEOUT_MS,
          new Error(`生成选词填空题目超时（${GENERATION_TIMEOUT_MS / 1000}s）`)
        );
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
  // 排除 _genOptions 标记条目后计算实际可用词数
  const actualRelatedEntries = (relatedWordEntries || []).filter((r: any) => !r._genOptions);
  const totalAvailable = wordIds.length + (actualRelatedEntries.length || 0);
  if (options.n + options.m > totalAvailable) {
    throw new Error(`需要 ${options.n + options.m} 个单词，但前端只传递了 ${wordIds.length} 个核心词和 ${actualRelatedEntries.length || 0} 个关联词`);
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) {
    throw new Error('所选单词不存在');
  }
  // 检查至少有一些单词含有释义，避免无意义消耗 AI 配额
  const wordsWithMeanings = wordData.filter((w: any) => w.meanings && Array.isArray(w.meanings) && w.meanings.length > 0);
  if (wordsWithMeanings.length === 0) {
    throw new Error('选中的单词均无释义数据，请先为单词添加释义后再出题');
  }

  // 代码随机分配答案词和干扰词，避免 AI 自行抽取
  const shuffledWords = shuffleArray([...wordData]);
  const answerTargets = shuffledWords.slice(0, options.n);
  const distractorWords = shuffledWords.slice(options.n, options.n + options.m);
  const answerTargetTexts = answerTargets.map((w: any) => w.text);
  const allWordTexts = [...answerTargets.map((w: any) => w.text), ...distractorWords.map((w: any) => w.text)];

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

  const allWordsForPrompt = [...allWordTexts];
  const shuffledAllWords = shuffleArray([...allWordsForPrompt]);

  const systemPrompt = `
总体要求：${SYSTEM_MESSAGE}

你是一位专业的英语考试题目生成专家。请根据提供的单词列表，生成一道"选词填空"练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "questions": [
    {
      "sentence": "包含 _ 的一个句子",
      "answer": "答案单词",
      "originalWord": "原始单词（仅当答案不是原文时填写）"
    },
    ...
  ]
}

## 关键规则（请严格遵循）：
1. questions 数组包含恰好 ${options.n} 道小题，每道题的 answer 必须对应一个**不同的**答案目标词
2. 每个 question 的 sentence 中必须包含一个 _ （下划线）表示填空位置
3. answer 必须是填空处实际需要的单词形式（如果需要变体形式，answer 就写变体形式）
4. 如果有多个答案，answer 字段用英文分号 ; 分隔
5. 句子要自然流畅，难度适合英语学习者
6. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题，帮助用户针对性地练习薄弱环节**
${allowFormChange ? `7. **重要：允许改变形式模式已开启** — 约 2/3 的题目中，你必须将单词变为不同形式出现在句子的填空处（例如：不同时态、动词/名词形式转换等）。此时 answer 字段应填写实际需要的变体形式（如 "tendency"），同时必须填写 originalWord 字段为原始单词（如 "tend"），以便前端识别这是形式变化。` : `7. 每个填空处的答案必须是 words 数组中某个单词的原文，originalWord 字段不需要填写`}
8. **重要：不要返回 words 字段**，words 字段将由系统自动填充
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来随机化题目排列（如果模型支持工具调用）`;

  let relatedWordsSection = '';
  if (actualRelatedEntries && actualRelatedEntries.length > 0) {
    const differentFormWords = actualRelatedEntries.filter((rw: any) => rw.types?.includes?.('different_form'));
    const easilyConfusedWords = actualRelatedEntries.filter((rw: any) => rw.types?.includes?.('easily_confused'));

    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，它们只能作为干扰词或上下文参考使用：
${JSON.stringify(actualRelatedEntries.map((rw: any) => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}

### 关联词使用指导：
- 关联词没有标注特定释义，你可以考察其任意释义
- 关联词不能作为答案目标词使用
${differentFormWords.length > 0 ? `- **不同形式（different_form）**：${differentFormWords.map((rw: any) => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词是同一词的不同形式（如名词/动词形式转换），你可以设计考察词形变化的题目` : ''}
${easilyConfusedWords.length > 0 ? `- **容易混淆（easily_confused）**：${easilyConfusedWords.map((rw: any) => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词容易混淆，你可以设计辨析类题目，让填空处需要仔细区分才能选对` : ''}`;
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
3. 每道题的 answer 必须是它对应的答案目标词（或 allowFormChange 模式下填变体形式+originalWord）

请生成符合上述要求的选词填空题目 JSON。`;

  const aiOptions: Record<string, unknown> = {
    prompt: userPrompt,
    tools: [randomTool],
    response_format: { type: 'json_object' }, // 强制返回合法JSON
  };
  if (deepThinking) {
    aiOptions.reasoning_effort = deepThinking;
  }

  const result = await callOpenAIWithTools(systemPrompt, aiOptions);

  let content = result.content.trim();

  // 始终解析 reason 标签（深度思考模式已强制开启）
  let thinkingContent: string | null = null;
  {
    const parsed = parseThinkingContent(content);
    thinkingContent = parsed.thinking;
    content = parsed.content.trim();
  }

  let parsed: any;
  try {
    console.log('AI response:', content);
    parsed = extractJSONFromAIContent(content, ['questions']);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  // Handle field aliases
  if (!parsed.questions && parsed.items) parsed.questions = parsed.items;
  if (!parsed.questions && parsed.sentences) parsed.questions = parsed.sentences;

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回的题目缺少必填字段：questions');
  }

  if (parsed.questions.length !== options.n) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${options.n} 道，实际 ${parsed.questions.length} 道`);
  }

  // 用代码预分配的单词列表接管 words 字段，确保抽取由代码完成
  parsed.words = [...shuffledAllWords];

  // Collect all unique answers from questions and verify each is in the answer targets
  const answerTargetSet = new Set(answerTargetTexts);
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
      // Form change mode: answer can be a variant form, but originalWord must be in answer targets
      if (!answerTargetSet.has(q.originalWord)) {
        missingWords.add(q.originalWord);
      }
    } else if (!answerTargetSet.has(q.answer)) {
      missingWords.add(q.answer);
    }
  }
  if (missingWords.size > 0) {
    throw new Error(`AI 返回的答案中包含不在答案目标词中的单词: ${Array.from(missingWords).join(', ')}`);
  }

  // 验证干扰词未被用作任何答案
  if (options.m > 0) {
    const answerWords = new Set(parsed.questions.map((q: any) => allowFormChange && q.originalWord ? q.originalWord : q.answer));
    const nonAnswerWords = parsed.words.filter((w: string) => !answerWords.has(w));
    if (nonAnswerWords.length < options.m) {
      throw new Error(`AI 返回的干扰词数量不正确，期望至少 ${options.m} 个单词未出现在答案中，实际 ${nonAnswerWords.length} 个`);
    }
  }

  // 打乱可选单词顺序和题目顺序，避免答案与原始单词表顺序一致
  parsed.words = shuffleArray([...parsed.words]);
  parsed.questions = shuffleArray([...parsed.questions]);

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) {
    resultContent.thinking = thinkingContent;
  }

  return resultContent;
}
