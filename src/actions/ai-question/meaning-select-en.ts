'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { query as queryDict } from '@/lib/dict/query';

interface MeaningSelectEnQuestion {
  title: string;
  questions: MeaningSelectEnQuestionItem[];
}

interface MeaningSelectEnQuestionItem {
  id: number;
  type: string;
  word: string;
  english: string;
  options: string[];
  correctAnswer: string;
}

const MAX_RETRIES = 3;

export async function enqueuePendingMeaningSelectEn(
  wordIds: number[],
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  return await enqueuePendingQuestion('meaning-select-en', wordIds, relatedWordEntries);
}

export async function generateAndEnqueueMeaningSelectEn(
  wordIds: number[],
  deepThinking?: boolean,
) {
  return await doGenerateMeaningSelectEn(wordIds, deepThinking);
}

export async function generateMeaningSelectEnWithQuestion(
  questionId: string,
  wordIds: number[],
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  const parsed = await doGenerateMeaningSelectEn(wordIds, deepThinking, relatedWordEntries);
  return await updateQuestionWithContent(questionId, parsed, 'meaning-select-en', wordIds);
}

async function getWordAllEnglishMeanings(word: string): Promise<string[]> {
  const dictEntry = await queryDict(word);
  if (!dictEntry || !dictEntry.meaning) {
    return [];
  }
  return dictEntry.meaning.map(m => m.content.toLowerCase().trim());
}

function isOptionInMeanings(option: string, meanings: string[]): boolean {
  const normalizedOption = option.toLowerCase().trim();
  return meanings.some(m => {
    const normalizedMeaning = m.toLowerCase().trim();
    return normalizedOption === normalizedMeaning ||
           normalizedOption.includes(normalizedMeaning) ||
           normalizedMeaning.includes(normalizedOption);
  });
}

async function validateQuestion(
  q: MeaningSelectEnQuestionItem,
): Promise<{ valid: boolean; reason: string }> {
  const allMeanings = await getWordAllEnglishMeanings(q.word);
  if (allMeanings.length === 0) {
    return { valid: true, reason: '词典中未找到该单词，跳过验证' };
  }

  const distractors = q.options.filter(o => o !== q.correctAnswer);

  for (const distractor of distractors) {
    if (isOptionInMeanings(distractor, allMeanings)) {
      return {
        valid: false,
        reason: `干扰选项 "${distractor}" 是单词 "${q.word}" 的释义之一，需要重新生成`,
      };
    }
  }

  return { valid: true, reason: '验证通过' };
}

async function doGenerateMeaningSelectEn(
  wordIds: number[],
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
): Promise<Record<string, unknown>> {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) {
    throw new Error('所选单词不存在');
  }

  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await generateQuestionsWithAI(wordData, relatedWordEntries);

      const validationResults = await Promise.all(
        result.questions.map(q => validateQuestion(q))
      );

      const invalidResults = validationResults.filter(r => !r.valid);

      if (invalidResults.length === 0) {
        return result as unknown as Record<string, unknown>;
      }

      lastError = invalidResults.map(r => r.reason).join('; ');
      console.log(`[英英释义] 第 ${attempt} 次生成验证失败: ${lastError}`);

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`[英英释义] 第 ${attempt} 次生成失败: ${lastError}`);
    }
  }

  throw new Error(`AI 生成英英释义题目失败，已重试 ${MAX_RETRIES} 次。最后错误: ${lastError}`);
}

async function generateQuestionsWithAI(
  wordData: any[],
  relatedWordEntries?: RelatedWordEntry[],
): Promise<MeaningSelectEnQuestion> {
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

你是一位专业的英语词汇测试专家。请根据提供的单词列表，生成一道"英英释义"选择题练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "title": "题目标题",
  "questions": [
    {
      "id": 1,
      "type": "en_to_en",
      "word": "英文单词",
      "english": "英文释义",
      "options": ["选项 A 的英文释义", "选项 B 的英文释义", "选项 C 的英文释义", "选项 D 的英文释义"],
      "correctAnswer": "正确选项的英文释义"
    }
  ]
}

## 关键规则：
1. questions 数组必须为每个提供的单词生成 1 道小题
2. type 固定为 "en_to_en"（英英释义选择题）
3. word 是要考察的英文单词
4. english 是该单词的正确英文释义（从用户不熟悉的释义中选择，翻译成英文）
5. options 必须包含恰好 4 个选项，其中只有 1 个是正确的
6. correctAnswer 必须与 options 中的某个选项完全一致
7. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先考察这些释义**
8. **极其重要：干扰选项（即除正确答案外的 3 个选项）设计策略**：
   - **优先级 1**：来自单词列表中**其他单词**的释义，或者与目标单词无关的常见英文释义
   - **优先级 2**：针对目标单词的**常见易混易错词**的释义。这些词可能是：
     * 拼写相似的词（如 affect/effect, accept/except）
     * 词义相近但用法不同的词（如 look/see/watch）
     * 容易混淆的近义词（如 big/large/huge）
     * 形近词（如 quite/quiet, through/though）
   - **干扰选项必须具有迷惑性**，让用户必须真正理解单词含义才能选出正确答案，而不是仅凭排除同义词就能猜对
   - **严禁模棱两可，必须要有明确的答案**
   - **干扰选项绝对不能是目标单词的任何释义（或者某个释义的近义词）**
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

请生成符合上述要求的英英释义选择题 JSON。`;

  const result = await callOpenAIWithTools(systemPrompt, {
    prompt: userPrompt,
    tools: [randomTool],
  });

  let content = result.content.trim();

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

  let parsed: MeaningSelectEnQuestion;
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

  for (const q of parsed.questions) {
    if (!q.id || !q.word || !q.english || !q.options || !q.correctAnswer) {
      throw new Error('英英释义题目中某一题缺少必填字段');
    }
    q.type = q.type || 'en_to_en';
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

  return resultContent as unknown as MeaningSelectEnQuestion;
}
