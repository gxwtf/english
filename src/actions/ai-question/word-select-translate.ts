'use server';

import { fetchEnrichedWords, enqueuePendingQuestion, updateQuestionWithContent, markQuestionAsFailed } from './utils';
import { callOpenAIWithTools, parseThinkingContent } from '@/lib/openai';
import type { WordSelectTranslateOptions } from '@/types/problem';
import type { RelatedWordEntry } from '@/lib/word-selection';
import { SYSTEM_MESSAGE } from '@/lib/prompts/system-prompt';
import { aiQueue, withTimeout } from '@/lib/ai-queue';

const GENERATION_TIMEOUT_MS = 600_000; // 10 分钟

function extractJSON(rawContent: string, requiredFields: string[] = []): any {
  let content = rawContent.trim();
  const parsed = parseThinkingContent(content);
  content = parsed.content.trim();

  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  } else if (requiredFields.length > 0) {
    const fieldPattern = requiredFields.map(f => `"${f}"`).join('[\\s\\S]*');
    const strictMatch = content.match(new RegExp(`\\{[\\s\\S]*${fieldPattern}[\\s\\S]*\\}`));
    if (strictMatch) {
      content = strictMatch[0];
    } else {
      const looseField = requiredFields[0];
      const looseMatch = content.match(new RegExp(`\\{[\\s\\S]*"${looseField}"[\\s\\S]*\\}`));
      if (looseMatch) content = looseMatch[0];
    }
  }

  content = content.replace(/: *int([ ,}])/g, ': 0$1');
  content = content.replace(/: *number([ ,}])/g, ': 0$1');
  content = content.replace(/: *float([ ,}])/g, ': 0$1');
  content = content.replace(/"[^"]*\.\.\.[^"]*"/g, '""');

  try {
    return JSON.parse(content);
  } catch (e) {
    if (requiredFields.length > 0) {
      const extracted: Record<string, unknown> = {};
      let allFound = true;
      for (const field of requiredFields) {
        const strMatch = content.match(new RegExp(`"${field}" *: *"([^"]*)"`));
        const numMatch = content.match(new RegExp(`"${field}" *: *(\\d+|int|number|float)`));
        if (strMatch) extracted[field] = strMatch[1];
        else if (numMatch) extracted[field] = parseInt(numMatch[1]) || 0;
        else { allFound = false; break; }
      }
      if (allFound) return extracted;
    }
    const anyJsonMatch = content.match(/\{[\s\S]*\}/);
    if (anyJsonMatch) {
      try { return JSON.parse(anyJsonMatch[0]); } catch {}
    }
    throw new Error(`AI 返回的内容不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

interface WordSelectTranslateQuestion {
  title: string;
  words: string[];
  questions: WordSelectTranslateQuestionItem[];
}

interface WordSelectTranslateQuestionItem {
  id: number;
  chinese: string;
  referenceAnswers: string;
}

export async function enqueuePendingWordSelectTranslate(
  wordIds: number[],
  options: WordSelectTranslateOptions,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) throw new Error('缺少单词列表');
  return await enqueuePendingQuestion('word-select-translate', wordIds, relatedWordEntries);
}

export async function generateAndEnqueueWordSelectTranslate(
  wordIds: number[],
  options: WordSelectTranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
) {
  return await doGenerateWordSelectTranslate(wordIds, options, customPrompt, deepThinking);
}

export async function generateWordSelectTranslateWithQuestion(
  questionId: string,
  wordIds: number[],
  options: WordSelectTranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  return new Promise((resolve, reject) => {
    aiQueue.addTask(questionId, async () => {
      const runGeneration = async () => {
        const parsed = await doGenerateWordSelectTranslate(wordIds, options, customPrompt, deepThinking, relatedWordEntries);
        const result = await updateQuestionWithContent(questionId, parsed, 'word-select-translate', wordIds);
        resolve(result);
      };

      try {
        await withTimeout(
          runGeneration(),
          GENERATION_TIMEOUT_MS,
          new Error(`生成选词翻译句子题目超时（${GENERATION_TIMEOUT_MS / 1000}s）`)
        );
      } catch (error) {
        try { await markQuestionAsFailed(questionId); } catch (e) { console.error('标记题目失败状态时出错:', e); }
        reject(error);
      }
    });
  });
}

async function doGenerateWordSelectTranslate(
  wordIds: number[],
  options: WordSelectTranslateOptions,
  customPrompt?: string,
  deepThinking?: boolean,
  relatedWordEntries?: RelatedWordEntry[],
) {
  if (!wordIds?.length) throw new Error('缺少单词列表');
  if (options?.n == null) throw new Error('缺少题目参数：n 为必填项');
  if (options.n < 1) throw new Error('题目数量 n 必须 >= 1');
  if (options.n > 5) throw new Error('题目数量不能超过 5');
  if (options.m == null) options.m = 0;
  if (options.m < 0) throw new Error('干扰词数量 m 必须 >= 0');

  const totalRequired = options.n + options.m;
  const totalAvailable = wordIds.length + (relatedWordEntries?.length || 0);
  if (totalRequired > totalAvailable) {
    throw new Error(`需要 ${totalRequired} 个单词（n=${options.n} 道题 + m=${options.m} 个干扰词），但只有 ${wordIds.length} 个核心词和 ${relatedWordEntries?.length || 0} 个关联词`);
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

你是一位专业的英语考试题目生成专家。请根据提供的单词列表，生成一道"选词翻译句子"练习题。

## 题目格式要求（必须返回合法的 JSON）：
{
  "title": "题目标题",
  "words": ["候选单词1","候选单词2",...],
  "questions": [
    {
      "id": 1,
      "chinese": "中文句子",
      "referenceAnswers": "标准英文翻译"
    }
  ]
}

## 关键规则：
1. words 数组包含所有候选单词（从提供的单词列表中选取），共需要 ${totalRequired} 个单词（${options.n} 道题的必用单词 + ${options.m} 个干扰词）
2. questions 数组包含 ${options.n} 道小题，每道题的标准答案必须使用 words 数组中的至少一个单词
3. chinese 是中文句子，学生需要翻译成英文
4. referenceAnswers 是标准的英文翻译，必须使用 words 数组中的至少一个单词
5. **重要：不要告诉学生每道题应该使用哪个单词，学生需要自己从候选单词中选择**
6. **重要：${options.m} 个干扰词不应出现在任何题目的标准答案中，仅作为候选词干扰选择**
7. **重要：每个单词的 meanings 字段包含了用户不熟悉、需要重点练习的释义，请优先围绕这些释义出题**
8. 题目难度要适合英语学习者，中文句子要自然流畅
9. 生成的英文翻译语法正确且自然
10. **重要：你可以任意改变这些单词的时态语态（例：run -> ran; run -> to run）**
11. 只返回 JSON，不要返回任何其他文字
12. 使用 generateRandomNumber 工具来随机化题目排列和单词选择（如果模型支持工具调用）`;

  let relatedWordsSection = '';
  if (relatedWordEntries && relatedWordEntries.length > 0) {
    const differentFormWords = relatedWordEntries.filter(rw => rw.types.includes('different_form'));
    const easilyConfusedWords = relatedWordEntries.filter(rw => rw.types.includes('easily_confused'));

    relatedWordsSection = `\n## 关联词（补充单词池）：
以下关联词来自选中单词的关联词列表，可以作为候选单词使用：
${JSON.stringify(relatedWordEntries.map(rw => ({ text: rw.text, types: rw.types, sourceWords: rw.sourceWords })), null, 2)}

### 关联词出题指导：
- 关联词没有标注特定释义，你可以考察其任意释义
${differentFormWords.length > 0 ? `- **不同形式（different_form）**：${differentFormWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词是同一词的不同形式，你可以设计考察词形变化的翻译题` : ''}
${easilyConfusedWords.length > 0 ? `- **容易混淆（easily_confused）**：${easilyConfusedWords.map(rw => `"${rw.text}"（来自 ${rw.sourceWords.join('、')}）`).join('、')}。这些词与源单词容易混淆，你可以设计辨析类翻译题` : ''}`;
  }

  const userPrompt = `提供的单词列表（注意：每个单词的 meanings 字段是用户不熟悉、需要重点练习的释义）：
${JSON.stringify(wordData, null, 2)}
${relatedWordsSection}
${customPrompt ? `\n自定义要求：${customPrompt}` : ''}

请生成符合上述要求的选词翻译句子题目 JSON。`;

  const result = await callOpenAIWithTools(systemPrompt, { prompt: userPrompt, tools: [randomTool], response_format: { type: 'json_object' } });

  let content = result.content.trim();
  let thinkingContent: string | null = null;
  {
    const parsed = parseThinkingContent(content);
    thinkingContent = parsed.thinking;
    content = parsed.content.trim();
  }

  let parsed: any;
  try {
    parsed = extractJSON(content, ['questions']);
  } catch (e) {
    throw new Error('AI 返回的内容不是合法的 JSON，无法解析题目');
  }

  // Handle field aliases
  if (!parsed.words && parsed.word_list) parsed.words = parsed.word_list;
  if (!parsed.words && parsed.candidates) parsed.words = parsed.candidates;
  if (!parsed.questions && parsed.items) parsed.questions = parsed.items;
  if (!parsed.questions && parsed.sentences) parsed.questions = parsed.sentences;
  if (!parsed.questions && parsed.translations) parsed.questions = parsed.translations;
  if (!parsed.title) parsed.title = parsed.heading || parsed.name || '选词翻译句子';

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回的题目缺少必填字段：questions');
  }

  if (parsed.questions.length < options.n) {
    console.warn(`[word-select-translate] AI 返回题目数量 ${parsed.questions.length} 少于期望 ${options.n}，使用实际数量`);
  }

  const wordSet = new Set(parsed.words || []);
  for (const q of parsed.questions) {
    // Handle field aliases within questions
    if (!q.chinese && q.chinese_sentence) q.chinese = q.chinese_sentence;
    if (!q.chinese && q.source) q.chinese = q.source;
    if (!q.referenceAnswers && q.reference_answer) q.referenceAnswers = q.reference_answer;
    if (!q.referenceAnswers && q.answer) q.referenceAnswers = q.answer;
    if (!q.referenceAnswers && q.translation) q.referenceAnswers = q.translation;
    if (!q.id) q.id = parsed.questions.indexOf(q) + 1;

    if (!q.chinese || !q.referenceAnswers) {
      throw new Error('翻译题目中某一题缺少必填字段');
    }
    // Remove keyWords if AI still returns them - students should choose words themselves
    delete q.keyWords;
    delete q.keywords;
    delete q.required_words;
    delete q.must_use;
  }

  // 打乱候选单词顺序（Fisher-Yates 算法）
  if (parsed.words && Array.isArray(parsed.words)) {
    for (let i = parsed.words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [parsed.words[i], parsed.words[j]] = [parsed.words[j], parsed.words[i]];
    }
  }

  const resultContent: Record<string, unknown> = { ...parsed };
  if (thinkingContent) resultContent.thinking = thinkingContent;
  return resultContent;
}
