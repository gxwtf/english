'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent, markQuestionAsFailed } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { RelatedWordEntry } from '@/lib/word-selection';
import type { MeaningSelectOptions } from '@/types/problem';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { query as queryDict } from '@/lib/dict/query';
import { aiQueue } from '@/lib/ai-queue';
import { isOptionInMeanings } from '@/lib/utils';

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

interface MeaningSelectQuestionItem {
  id: number;
  type: string;
  word: string;
  chinese: string;
  options: string[];
  correctAnswer: string;
}

interface MeaningSelectQuestion {
  title: string;
  questions: MeaningSelectQuestionItem[];
}

const MAX_RETRIES = 3;

export async function enqueuePendingMeaningSelect(
  wordIds: number[],
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }
  return await enqueuePendingQuestion('meaning-select', wordIds, relatedWordEntries);
}

export async function generateAndEnqueueMeaningSelect(
  wordIds: number[],
  deepThinking?: boolean,
) {
  return await doGenerateMeaningSelect(wordIds, undefined, deepThinking);
}

export async function generateMeaningSelectWithQuestion(
  questionId: string,
  wordIds: number[],
  options?: MeaningSelectOptions,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  console.log('[generateMeaningSelectWithQuestion]', questionId);
  return new Promise((resolve, reject) => {
    aiQueue.addTask(questionId, async () => {
      try {
        const parsed = await doGenerateMeaningSelect(wordIds, options, deepThinking, relatedWordEntries);
        const result = await updateQuestionWithContent(questionId, parsed, 'meaning-select', wordIds);
        resolve(result);
      } catch (error) {
        try { await markQuestionAsFailed(questionId); } catch (e) { console.error('标记题目失败状态时出错:', e); }
        reject(error);
      }
    });
  });
}

async function getWordAllMeanings(word: string): Promise<string[]> {
  const dictEntry = await queryDict(word);
  if (!dictEntry || !dictEntry.meaning) return [];
  return dictEntry.meaning.map(m => m.content.toLowerCase().trim());
}

async function validateQuestion(q: MeaningSelectQuestionItem): Promise<{ valid: boolean; reason: string }> {
  const allMeanings = await getWordAllMeanings(q.word);
  if (allMeanings.length === 0) return { valid: true, reason: '词典中未找到该单词，跳过验证' };

  const distractors = q.options.filter(o => o !== q.correctAnswer);
  for (const distractor of distractors) {
    if (isOptionInMeanings(distractor, allMeanings)) {
      return { valid: false, reason: `干扰选项 "${distractor}" 是单词 "${q.word}" 的释义之一，需要重新生成` };
    }
  }
  return { valid: true, reason: '验证通过' };
}

async function doGenerateMeaningSelect(
  wordIds: number[],
  options?: MeaningSelectOptions,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
): Promise<Record<string, unknown>> {
  if (!wordIds?.length) throw new Error('缺少单词列表');

  const targetCount = options?.n ?? wordIds.length; // 用户指定的题目数量,默认为单词数量

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) throw new Error('所选单词不存在');

  // 如果用户指定的题目数量小于单词数量,随机选择部分单词
  let selectedWordData = wordData;
  if (targetCount < wordData.length) {
    const shuffled = shuffleArray([...wordData]);
    selectedWordData = shuffled.slice(0, targetCount);
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await generateQuestionsWithAI(selectedWordData, relatedWordEntries);
      const validationResults = await Promise.all(result.questions.map(q => validateQuestion(q)));
      const invalidResults = validationResults.filter(r => !r.valid);
      if (invalidResults.length === 0) return result as unknown as Record<string, unknown>;
      lastError = invalidResults.map(r => r.reason).join('; ');
      console.log(`[英译中] 第 ${attempt} 次生成验证失败: ${lastError}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`[英译中] 第 ${attempt} 次生成失败: ${lastError}`);
    }
  }
  throw new Error(`AI 生成英译中题目失败，已重试 ${MAX_RETRIES} 次。最后错误: ${lastError}`);
}

async function generateQuestionsWithAI(
  wordData: any[],
  relatedWordEntries?: RelatedWordEntry[],
): Promise<MeaningSelectQuestion> {
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
8. **极其重要：干扰选项（即除正确答案外的 3 个选项）设计策略**：
   - **优先级 1**：来自单词列表中**其他单词**的释义
   - **优先级 2**：**主动搜索目标单词的相似词**（不限于列表中的单词），使用其释义作为干扰选项。相似词包括：
     * 拼写相似的词（如 affect/effect, accept/except）
     * 词义相近但用法不同的词（如 look/see/watch）
     * 容易混淆的近义词（如 big/large/huge）
     * 形近词（如 quite/quiet, through/though）
     * 同义词或反义词的不同形式
   - **优先级 3**：与目标单词无关的常见中文释义
   - **干扰选项必须具有迷惑性**，让用户必须真正理解单词含义才能选出正确答案，而不是仅凭排除同义词就能猜对
   - **严禁模棱两可，必须要有明确的答案**
   
   **❗ 关键检查步骤（必须执行）**：
   - **步骤 1**：列出目标单词的所有释义（包括名词、动词、形容词等所有词性的释义）
   - **步骤 2**：对于每个干扰选项，检查它是否满足以下任一条件：
     * 是目标单词的直接释义
     * 是目标单词释义的近义词或同义词
     * 与目标单词释义在语义上高度重叠（如 "趋势" 与 "倾向"）
   - **步骤 3**：如果干扰选项满足上述任一条件，**立即舍弃**，重新选择其他干扰选项
   - **步骤 4**：使用相似词的释义时，必须确保该释义不与目标单词的释义重叠
   
   **反面案例示例（严禁模仿）**：
   * ❌ 错误：目标词 "tend"（释义：走向、倾向），干扰选项 "趋势"
     * 原因："趋势" 是 "tend" 释义"倾向"的近义词，也是相似词 "tendency" 的释义，语义重叠
   * ❌ 错误：目标词 "big"（释义：大的），干扰选项 "巨大"
     * 原因："巨大" 是 "big" 的近义词，语义高度重叠
   * ❌ 错误：目标词 "look"（释义：看），干扰选项 "观看"
     * 原因："观看" 是 "look" 的近义词，语义重叠
   
   **正面案例示例（推荐学习）**：
   * ✅ 正确：目标词 "tend"（释义：走向、倾向），干扰选项 "恶妇"（来自 cat）
     * 原因："恶妇" 与 "tend" 的释义完全无关
   * ✅ 正确：目标词 "cat"（释义：猫），干扰选项 "蝙蝠"（相似词 bat 的释义）
     * 原因："蝙蝠" 与 "猫" 的释义完全无关，只是拼写相似（cat/bat）
   * ✅ 正确：目标词 "accept"（释义：接受），干扰选项 "除外"（相似词 except 的释义）
     * 原因："除外" 与 "接受" 的释义完全无关，只是拼写相似（accept/except）
9. 只返回 JSON，不要返回任何其他文字
10. 使用 generateRandomNumber 工具来随机化选项顺序（如果模型支持工具调用）`;

  let relatedWordsSection = '';
  if (relatedWordEntries && relatedWordEntries.length > 0) {
    const differentFormWords = relatedWordEntries.filter(rw => rw.types.includes('different_form'));
    const easilyConfusedWords = relatedWordEntries.filter(rw => rw.types.includes('easily_confused'));

    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，请将它们纳入可选单词池：
${JSON.stringify(relatedWordEntries.map(rw => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}

### 关联词出题指导：
- 关联词没有标注特定释义，你可以考察其任意释义
- 关联词也可以作为干扰选项的来源（用其释义作为错误选项）
${differentFormWords.length > 0 ? `- **不同形式（different_form）**：${differentFormWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词是同一词的不同形式，你可以用其释义作为干扰选项` : ''}
${easilyConfusedWords.length > 0 ? `- **容易混淆（easily_confused）**：${easilyConfusedWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词容易混淆，你可以用其释义作为极具迷惑性的干扰选项` : ''}`;
  }

  const userPrompt = `提供的单词列表（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordsSection}

请生成符合上述要求的英译中选择题 JSON。`;

  const result = await callOpenAIWithTools(systemPrompt, {
    prompt: userPrompt,
    tools: [randomTool],
    response_format: { type: 'json_object' }, // 强制返回合法JSON
  });

  let content = result.content.trim();
  let thinkingContent: string | null = null;
  
  // 尝试解析原生深度思考内容（如果模型支持）
  if (result.reasoning_content) {
    thinkingContent = result.reasoning_content;
  } else {
    // 解析 <reason> 标签中的深度思考内容
    const parsed = parseThinkingContent(content);
    thinkingContent = parsed.thinking;
    content = parsed.content.trim();
  }

  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) content = fenceMatch[1].trim();

  let parsed: MeaningSelectQuestion;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回的题目缺少必填字段：title 或 questions');
  }

  const expectedQuestions = wordData.length;
  if (parsed.questions.length !== expectedQuestions) {
    throw new Error(`AI 返回的题目数量不正确，期望 ${expectedQuestions} 道，实际 ${parsed.questions.length} 道`);
  }

  // Shuffle options for each question to randomize correct answer position
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

    // Shuffle options array
    const shuffledOptions = shuffleArray([...q.options]);
    q.options = shuffledOptions;
  }

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) resultContent.thinking = thinkingContent;
  return resultContent as unknown as MeaningSelectQuestion;
}
