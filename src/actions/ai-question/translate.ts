'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent, markQuestionAsFailed } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { TranslateOptions } from '@/types/problem';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { aiQueue, withTimeout } from '@/lib/ai-queue';

const GENERATION_TIMEOUT_MS = 600_000; // 10 分钟

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
      const runGeneration = async () => {
        const parsed = await doGenerateTranslate(wordIds, options, customPrompt, deepThinking, relatedWordEntries);
        const result = await updateQuestionWithContent(questionId, parsed, 'translate', wordIds);
        resolve(result);
      };

      try {
        await withTimeout(
          runGeneration(),
          GENERATION_TIMEOUT_MS,
          new Error(`生成翻译句子题目超时（${GENERATION_TIMEOUT_MS / 1000}s）`)
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
  // 检查至少有一些单词含有释义，避免无意义消耗 AI 配额
  const wordsWithMeanings = wordData.filter((w: any) => w.meanings && Array.isArray(w.meanings) && w.meanings.length > 0);
  if (wordsWithMeanings.length === 0) {
    throw new Error('选中的单词均无释义数据，请先为单词添加释义后再出题');
  }

  // 代码预分配每个题目对应的关键词，避免 AI 自行抽取
  const shuffledWords = shuffleArray([...wordData]);
  const allocatedKeyWords = shuffledWords.slice(0, options.n).map((w: any) => w.text);

  const randomTool = {
    type: 'function' as const,
    function: {
      name: 'generateRandomNumber',
      description: 'Generate a random integer within a specified range. Use this to randomize question order.',
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
      "referenceAnswers": "标准英文翻译"
    }
  ]
}

## 关键规则（请严格遵循）：
1. questions 必须是恰好 ${options.n} 个元素的数组，每个元素代表一道翻译题
2. type 固定为 "cn_to_en"（中译英）
3. chinese 是中文句子，要翻译成英文
4. referenceAnswers 是标准的英文翻译，必须使用系统分配给这道题的关键词
5. **重要：不要返回 keyWords 字段** — 关键词将由系统自动分配给每道题
6. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题，帮助用户针对性地练习薄弱环节**
7. 题目难度要适合英语学习者，中文句子要自然流畅
8. 生成的英文翻译语法正确且自然
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来随机化题目排列（如果模型支持工具调用）
11. **重要：你可以任意改变这些单词的时态语态（例：run -> ran; run -> to run）**`;

  const userPrompt = `## 分配给每道题的关键词（共 ${options.n} 个，每道题使用一个不同的词，请按 id 顺序对应）：
${allocatedKeyWords.map((text: string, i: number) => `  第 ${i + 1} 题(keyWords): ["${text}"]`).join('\n')}

## 单词详细信息（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordEntries && relatedWordEntries.length > 0 ? (() => {
    const differentFormWords = relatedWordEntries.filter(rw => rw.types.includes('different_form'));
    const easilyConfusedWords = relatedWordEntries.filter(rw => rw.types.includes('easily_confused'));
    return `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，可以作为 context 使用但不作为关键词：
${JSON.stringify(relatedWordEntries.map(rw => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}

### 关联词出题指导：
- 关联词没有标注特定释义，你可以考察其任意释义
${differentFormWords.length > 0 ? `- **不同形式（different_form）**：${differentFormWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词是同一词的不同形式，你可以设计考察词形变化的翻译题` : ''}
${easilyConfusedWords.length > 0 ? `- **容易混淆（easily_confused）**：${easilyConfusedWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词容易混淆，你可以设计辨析类翻译题` : ''}`;
  })() : ''}
${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请严格按以下步骤出题：
1. 按 id 1 到 ${options.n} 的顺序，每道题使用系统分配给它的关键词
2. 第 1 题必须使用 "${allocatedKeyWords[0]}" 作为关键词（参考翻译中必须包含它）
3. **不要返回 keyWords 字段**

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
    q.hint = q.hint || '';
    // 由代码分配关键词，不依赖 AI 返回
    q.keyWords = [];
  }

  // 代码分配关键词给每道题，确保抽取由代码完成
  for (let i = 0; i < parsed.questions.length; i++) {
    parsed.questions[i].keyWords = [allocatedKeyWords[i % allocatedKeyWords.length]];
  }

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) {
    resultContent.thinking = thinkingContent;
  }

  return resultContent;
}
