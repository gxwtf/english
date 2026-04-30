'use server';

import { prisma } from '@/lib/db';
import { getAuthUser } from '../auth';
import { QuestionType } from '@/types/word';
import { callOpenAI, parseThinkingContent } from '@/lib/openai';

/**
 * Fetch words and enrich with all user-specific information.
 * Used by all question-type-specific Server Actions.
 *
 * Returns:
 * - id: 单词 ID
 * - text: 单词文本
 * - meanings: 用户不熟悉的释义列表
 * - tags: 用户添加的标签列表（包含标签 ID、名称、颜色）
 * - relatedWords: 关联词列表（包含关联词文本和关联类型：一词多义/不同形式）
 */
export async function fetchEnrichedWords(wordIds: number[]) {
  const words = await prisma.word.findMany({
    where: { id: { in: wordIds } },
    include: {
      wordTags: { include: { tag: true } },
    },
  });

  // 批量获取所有单词的关联词
  const relatedWordsMap = new Map<number, { relatedText: string; type: string }[]>();
  for (const word of words) {
    const relatedWords = await prisma.relatedWord.findMany({
      where: { wordText: word.text },
    });
    relatedWordsMap.set(word.id, relatedWords);
  }

  return words.map((w) => ({
    id: w.id,
    text: w.text,
    meanings: w.meanings, // 用户不熟悉的释义
    tags: w.wordTags.map((wt) => ({
      id: wt.tag.id,
      name: wt.tag.name,
      colorId: wt.tag.colorId,
    })),
    relatedWords: (relatedWordsMap.get(w.id) || []).map((rw) => ({
      text: rw.relatedText,
      type: rw.type, // 一词多义 / 不同形式
    })),
  }));
}

/**
 * Load all question questions for the current user.
 */
export async function loadQuestionQueue() {
  const user = await getAuthUser();
  if (!user) return [];

  const questions = await prisma.questionQueue.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
  });

  return questions.map((q) => ({
    id: q.id,
    questionType: q.questionType as QuestionType,
    status: q.status,
    questionContent: (q.questionContent as Record<string, unknown> | undefined) ?? undefined,
    lastAnswer: (q.lastAnswer as Record<string, unknown> | undefined) ?? undefined,
    wordIds: q.wordIds,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));
}

/**
 * Enqueue a new question into the database for the current user.
 */
export async function enqueueQuestion(
  questionContent: object,
  questionType: QuestionType,
  wordIds: number[]
) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!questionContent || !questionType || !wordIds?.length) {
    throw new Error('缺少题目内容、类型或单词列表');
  }

  const question = await prisma.questionQueue.create({
    data: {
      userId: user.userId,
      questionType: questionType as any,
      status: 'GENERATED',
      questionContent,
      wordIds,
    },
  });

  return {
    id: question.id,
    questionType: question.questionType as QuestionType,
    status: question.status,
    questionContent,
    wordIds,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

/**
 * Enqueue a pending question with GENERATING status.
 * This is used before the AI call to reserve the slot.
 */
export async function enqueuePendingQuestion(
  questionType: QuestionType,
  wordIds: number[]
) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!questionType || !wordIds?.length) {
    throw new Error('缺少题目类型或单词列表');
  }

  const question = await prisma.questionQueue.create({
    data: {
      userId: user.userId,
      questionType: questionType as any,
      status: 'GENERATING',
      wordIds,
    },
  });

  return {
    id: question.id,
    questionType: question.questionType as QuestionType,
    status: question.status,
    questionContent: null as null | undefined,
    wordIds,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

/**
 * Update a generating question with AI-generated content.
 */
export async function updateQuestionWithContent(
  questionId: string,
  questionContent: object,
  questionType: QuestionType,
  wordIds: number[]
) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'GENERATING') throw new Error('题目状态不允许更新');

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      questionType: questionType as any,
      status: 'GENERATED',
      questionContent,
      wordIds,
    },
  });

  return {
    id: updated.id,
    questionType: updated.questionType as QuestionType,
    status: updated.status,
    questionContent,
    wordIds,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Submit an answer for a question.
 */
export async function submitAnswer(questionId: string, answers: Record<string, unknown>) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  if (!answers) throw new Error('缺少作答内容');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'GENERATED' && q.status !== 'GRADING' && q.status !== 'ANSWERED' && q.status !== 'GRADING_FAILED') throw new Error('题目尚未生成完毕或已作答');

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      lastAnswer: answers as any,
      status: 'GRADING',
    },
  });

  return updated;
}

/**
 * Load a single question by ID.
 */
export async function loadQuestionById(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  return {
    id: q.id,
    questionType: q.questionType as QuestionType,
    status: q.status,
    questionContent: (q.questionContent as Record<string, unknown> | undefined) ?? undefined,
    gradingResult: (q.gradingResult as GradeResult[] | null) ?? null,
    lastAnswer: (q.lastAnswer as Record<string, unknown> | undefined) ?? undefined,
    wordIds: q.wordIds,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

/**
 * Mark a GENERATING question as FAILED.
 */
export async function markQuestionAsFailed(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  return prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'FAILED' as any,
      questionContent: null as any,
    },
  });
}

/**
 * 批改结果类型定义.
 */
export interface GradeResult {
  questionId: number;
  score?: number;
  maxScore?: number;
  feedback?: string;
  standardAnswer: string;
}

/**
 * Save grading results to DB so they can be loaded later without re-grading.
 */
export async function saveGradingResult(questionId: string, results: GradeResult[]) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  await prisma.questionQueue.update({
    where: { id: questionId },
    data: { gradingResult: results as any },
  });
}

/**
 * Load cached grading results from DB (for already-answered questions).
 * Returns null if no cached results exist.
 */
export async function loadGradingResult(questionId: string): Promise<GradeResult[] | null> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  const gradingResult = q.gradingResult as any;
  if (!gradingResult || !Array.isArray(gradingResult)) return null;

  return gradingResult as GradeResult[];
}

/**
 * Mark a GRADING question as ANSWERED after grading is complete.
 */
export async function markQuestionAsAnswered(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  return prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'ANSWERED',
    },
  });
}

/**
 * Mark a GRADING question as GRADING_FAILED when grading encounters an error.
 */
export async function markQuestionAsGradingFailed(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  return prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'GRADING_FAILED',
    },
  });
}

/**
 * AI 批量批改翻译句子答案（统一提交模式）.
 * 如果用户放弃了某道题（空答案），只返回标准答案不评分.
 */
export async function gradeTranslateAnswerBatch(
  questionId: string,
  answers: Record<number, string>
): Promise<GradeResult[]> {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'GRADING' && q.status !== 'ANSWERED' && q.status !== 'GRADING_FAILED') throw new Error('题目状态不允许批改');

  const questionContent = q.questionContent as any;
  if (!questionContent?.questions) {
    throw new Error('题目内容不完整');
  }

  const questions: Array<{
    id: number;
    chinese: string;
    referenceAnswers: string;
    keyWords: string[];
  }> = Array.isArray(questionContent.questions)
    ? questionContent.questions.map((item: any) => ({
        id: item.id,
        chinese: item.chinese,
        referenceAnswers: item.referenceAnswers,
        keyWords: item.keyWords || [],
      }))
    : [];

  const results: GradeResult[] = [];

  let gradingSuccess = true;

  for (const question of questions) {
    const userAnswer = answers[question.id]?.trim() || '';
    const isAbandoned = !userAnswer;

    if (isAbandoned) {
      // 放弃的题目，只返回标准答案
      results.push({
        questionId: question.id,
        standardAnswer: question.referenceAnswers,
      });
      continue;
    }

    // 正常作答，AI 评分
    const systemPrompt = `你是一位英语翻译批改老师。请根据中文原句、参考答案、必用关键词，对学生输入的英文翻译进行评分。

## 评分规则：
- 满分 10 分
- 评估翻译准确度（语义是否传达正确）、语法正确性、是否使用了必用单词
- 给出简短评语（中文，2-3 句话）

## 重要：
- 在生成批改之前，请先用 <reason> 和 </reason> 标签包裹你的思考过程
- 思考内容包括：学生答案分析、语法错误、词汇使用、评分理由
- 在 </reason> 之后再输出最终的 JSON 答案
- JSON 格式：{"score": 8, "maxScore": 10, "feedback": "简短评语", "standardAnswer": "参考答案"}
- 只返回 JSON，不要其他文字。确保 score 和 maxScore 是数字，不能是 "int" 或 "number" 等类型名。`;

    const userPrompt = `中文：${question.chinese}
参考：${question.referenceAnswers}
必用：${question.keyWords.length > 0 ? question.keyWords.join(', ') : '无'}
学生：${userAnswer}`;

    console.log(systemPrompt, userPrompt);

    let result: Awaited<ReturnType<typeof callOpenAI>>;
    try {
      result = await callOpenAI(systemPrompt, {
        prompt: userPrompt,
        timeout: 180000,
      });
    } catch (apiError) {
      console.error('AI 评分 API 调用失败:', apiError);
      gradingSuccess = false;
      // API 调用失败时，直接返回标准答案，不提供评分
      results.push({
        questionId: question.id,
        standardAnswer: question.referenceAnswers,
      });
      continue;
    }

    let content = result?.content?.trim();
    console.log(content);
    if (!content) {
      console.error('AI 返回内容为空');
      results.push({
        questionId: question.id,
        standardAnswer: question.referenceAnswers,
      });
      continue;
    }

    // 解析 <reason> 标签（深度思考模式）
    {
      const parsed = parseThinkingContent(content);
      content = parsed.content.trim();
    }

    // 尝试从内容中提取 JSON 对象
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      content = fenceMatch[1].trim();
    } else {
      // 查找最后一个 JSON 对象（包含 score、maxScore、feedback 字段）
      const jsonMatches = content.matchAll(/\{[\s\S]*"score"[\s\S]*"maxScore"[\s\S]*"feedback"[\s\S]*\}/g);
      const jsonMatchesArray = Array.from(jsonMatches);
      if (jsonMatchesArray.length > 0) {
        const lastMatch = jsonMatchesArray[jsonMatchesArray.length - 1];
        content = lastMatch[0];
      } else {
        // 更宽松的匹配：查找任何包含 score 字段的 JSON 结构
        const looseMatch = content.match(/\{[\s\S]*"score"[\s\S]*\}/);
        if (looseMatch) {
          content = looseMatch[0];
        }
      }
    }

    // 如果仍然没有提取到 JSON，尝试寻找任何看起来像 JSON 的内容
    if (!content.startsWith('{')) {
      const anyJsonMatch = content.match(/\{[\s\S]*"score".*?\}/);
      if (anyJsonMatch) {
        content = anyJsonMatch[0];
      }
    }

    // 修复常见的 JSON 格式问题：将 "score": int 替换为 "score": 0
    content = content.replace(/: *int([ ,}])/g, ': 0$1');
    content = content.replace(/: *number([ ,}])/g, ': 0$1');
    content = content.replace(/: *float([ ,}])/g, ': 0$1');
    // 修复 "..." 这种无效内容，替换为空字符串
    content = content.replace(/"[^"]*\.\.\.[^"]*"/g, '""');

    let parsed: { score: number; maxScore: number; feedback: string; standardAnswer?: string };
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('JSON 解析失败，原始内容:', result.content?.substring(0, 500));
      console.error('处理后的内容:', content);
      console.error('e:', e);

      // 尝试更激进的修复：提取所有数字和字段
      const scoreMatch = content.match(/"score" *: *(\d+|int|number|float)/);
      const maxScoreMatch = content.match(/"maxScore" *: *(\d+|int|number|float)/);
      const feedbackMatch = content.match(/"feedback" *: *"([^"]*)"/);

      if (scoreMatch && maxScoreMatch && feedbackMatch) {
        const score = parseInt(scoreMatch[1]) || 0;
        const maxScore = parseInt(maxScoreMatch[1]) || 10;
        const feedback = feedbackMatch[1] || '';
        const standardAnswer = content.match(/"standardAnswer" *: *"([^"]*)"/)?.[1] || question.referenceAnswers;

        parsed = { score, maxScore, feedback, standardAnswer };
      } else {
        const jsonLooseMatch = content.match(/\{[\s\S]*\}/);
        if (jsonLooseMatch) {
          try {
            parsed = JSON.parse(jsonLooseMatch[0]);
          } catch {
            // JSON 解析彻底失败，返回标准答案但不评分
            console.error('AI 返回的批改内容不是合法 JSON，返回标准答案');
            results.push({
              questionId: question.id,
              standardAnswer: question.referenceAnswers,
            });
            continue;
          }
        } else {
          // 没有找到任何 JSON 结构，返回标准答案但不评分
          console.error('AI 返回的批改内容不是合法 JSON，返回标准答案');
          results.push({
            questionId: question.id,
            standardAnswer: question.referenceAnswers,
          });
          continue;
        }
      }
    }

    // 注意：score 可以为 0，所以要显式检查 undefined/null
    if (parsed.score == null || parsed.maxScore == null || !parsed.feedback) {
      console.error('批改内容缺少必填字段:', parsed);
      console.error('原始响应:', result.content?.substring(0, 1000));
      // 字段缺失，返回标准答案但不评分
      results.push({
        questionId: question.id,
        standardAnswer: question.referenceAnswers,
      });
      continue;
    }

    results.push({
      questionId: question.id,
      score: parsed.score,
      maxScore: parsed.maxScore,
      feedback: parsed.feedback,
      standardAnswer: parsed.standardAnswer || question.referenceAnswers,
    });
  }

  // Save grading results to DB so they can be loaded later without re-grading
  try {
    await saveGradingResult(questionId, results);
  } catch (e) {
    console.error('保存批改结果失败:', e);
    gradingSuccess = false;
  }

  // Update status based on grading success
  if (gradingSuccess) {
    try {
      await markQuestionAsAnswered(questionId);
    } catch (e) {
      console.error('更新题目状态为已作答失败:', e);
    }
  } else {
    try {
      await markQuestionAsGradingFailed(questionId);
    } catch (e) {
      console.error('更新题目状态为批改失败失败:', e);
    }
  }

  return results;
}

/**
 * AI 单个批改翻译句子答案（即时反馈模式）- 旧版，逐步废弃中.
 */
export async function gradeTranslateAnswerSingle(questionId: string, questionItemId: number, userAnswer: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  const questionContent = q.questionContent as any;
  if (!questionContent?.questions) {
    throw new Error('题目内容不完整');
  }

  const questions: Array<{
    id: number;
    chinese: string;
    referenceAnswers: string;
    keyWords: string[];
  }> = Array.isArray(questionContent.questions)
    ? questionContent.questions.map((item: any) => ({
        id: item.id,
        chinese: item.chinese,
        referenceAnswers: item.referenceAnswers,
        keyWords: item.keyWords || [],
      }))
    : [];

  const targetQuestion = questions.find(q => q.id === questionItemId);
  if (!targetQuestion) {
    throw new Error('题目不存在');
  }

  const systemPrompt = `你是一位专业的英语翻译批改老师。请根据中文原句、参考答案、必用关键词，对学生输入的英文翻译进行评分。

## 评分规则：
- 满分 10 分
- 评估翻译准确度（语义是否传达正确）、语法正确性、是否使用了必用单词
- 给出简短评语（中文，2-3 句话）

## 重要：
- 在生成批改之前，请先用 <reason> 和 </reason> 标签包裹你的思考过程
- 思考内容包括：学生答案分析、语法错误、词汇使用、评分理由
- 在 </reason> 之后再输出最终的 JSON 答案
- 直接输出 JSON，不要有其他文字

## 输出格式（必须是合法 JSON）：
{"score": 8, "maxScore": 10, "feedback": "评语"}`;

  const userPrompt = `请批改以下翻译练习：
中文：${targetQuestion.chinese}
参考答案：${targetQuestion.referenceAnswers}
必用单词：${targetQuestion.keyWords.join(', ')}
学生答案：${userAnswer}`;

  const result = await callOpenAI(systemPrompt, {
    prompt: userPrompt,
  });

  let content = result.content.trim();

  // 解析 <reason> 标签（深度思考模式）
  {
    const parsed = parseThinkingContent(content);
    content = parsed.content.trim();
  }

  // 尝试从内容中提取 JSON 对象（最后面的 JSON 通常是最终答案）
  // 优先查找代码块中的 JSON
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  } else {
    // 查找所有可能的 JSON 对象，取最后一个（通常是最终答案）
    const jsonMatches = content.matchAll(/\{[^{}]*"score"[^{}]*\}/g);
    const jsonMatchesArray = Array.from(jsonMatches);
    if (jsonMatchesArray.length > 0) {
      // 取最后一个匹配
      const lastMatch = jsonMatchesArray[jsonMatchesArray.length - 1];
      content = lastMatch[0];
    } else {
      // 尝试更宽松的模式：查找任何包含 score, maxScore, feedback 的 JSON 结构
      const looseMatch = content.match(/\{[\s\S]*"score"[\s\S]*"maxScore"[\s\S]*"feedback"[\s\S]*\}/);
      if (looseMatch) {
        content = looseMatch[0];
      }
    }
  }

  // 修复常见的 JSON 格式问题：将 "score": int 替换为 "score": 0
  content = content.replace(/: *int([ ,}])/g, ': 0$1');
  content = content.replace(/: *number([ ,}])/g, ': 0$1');
  content = content.replace(/: *float([ ,}])/g, ': 0$1');
  // 修复 "..." 这种无效内容，替换为空字符串
  content = content.replace(/"[^"]*\.\.\.[^"]*"/g, '""');

  let parsed: { score: number; maxScore: number; feedback: string };
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('JSON 解析失败，原始内容:', result.content.substring(0, 500));
    console.error('处理后的内容:', content);
    console.error('e:', e);

    // 尝试更激进的修复：提取所有数字和字段
    const scoreMatch = content.match(/"score" *: *(\d+|int|number|float)/);
    const maxScoreMatch = content.match(/"maxScore" *: *(\d+|int|number|float)/);
    const feedbackMatch = content.match(/"feedback" *: *"([^"]*)"/);

    if (scoreMatch && maxScoreMatch && feedbackMatch) {
      parsed = {
        score: parseInt(scoreMatch[1]) || 0,
        maxScore: parseInt(maxScoreMatch[1]) || 10,
        feedback: feedbackMatch[1] || '',
      };
    } else {
      const jsonLooseMatch = content.match(/\{[\s\S]*\}/);
      if (jsonLooseMatch) {
        try {
          parsed = JSON.parse(jsonLooseMatch[0]);
        } catch {
          throw new Error(`AI 返回的批改内容不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        throw new Error(`AI 返回的批改内容不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (!parsed.score || !parsed.maxScore || !parsed.feedback) {
    console.error('批改内容缺少必填字段:', parsed);
    throw new Error('AI 返回的批改缺少必填字段');
  }

  return {
    questionId: questionItemId,
    score: parsed.score,
    maxScore: parsed.maxScore,
    feedback: parsed.feedback,
  };
}

/**
 * AI 批量批改翻译句子答案（传统模式）。
 */
export async function gradeTranslateAnswer(questionId: string, answers: Record<number, string>) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');

  const questionContent = q.questionContent as any;
  if (!questionContent?.questions) {
    throw new Error('题目内容不完整');
  }

  const questions: Array<{
    id: number;
    chinese: string;
    referenceAnswers: string;
    keyWords: string[];
  }> = Array.isArray(questionContent.questions)
    ? questionContent.questions.map((item: any) => ({
        id: item.id,
        chinese: item.chinese,
        referenceAnswers: item.referenceAnswers,
        keyWords: item.keyWords || [],
      }))
    : [];

  const answersList = questions.map(q => ({
    ...q,
    userAnswer: answers[q.id] ?? '',
  }));

  const systemPrompt = `你是一位专业的英语翻译批改老师。请根据中文原句、参考答案、必用关键词，对学生输入的英文翻译进行评分。

## 评分规则：
- 满分 10 分
- 评估翻译准确度（语义是否传达正确）、语法正确性、是否使用了必用单词
- 给出简短评语（中文，2-3 句话）

## 重要：
- 在生成批改之前，请先用 <reason> 和 </reason> 标签包裹你的思考过程
- 思考内容包括：学生答案分析、语法错误、词汇使用、评分理由
- 在 </reason> 之后再输出最终的 JSON 答案

## 输出格式（必须是合法 JSON）：
{
  "scores": [
    {
      "questionId": 1,
      "score": 8,
      "maxScore": 10,
      "feedback": "评语"
    }
  ]
}

只返回 JSON，不要返回其他文字。`;

  const userPrompt = `请批改以下翻译练习：

${answersList.map((item, i) => `第 ${i + 1} 题:
  中文: ${item.chinese}
  参考答案: ${item.referenceAnswers}
  必用单词: ${item.keyWords.join(', ')}
  学生答案: ${item.userAnswer}`).join('\n---\n')}`;

  const result = await callOpenAI(systemPrompt, {
    prompt: userPrompt,
  });

  let content = result.content.trim();

  // 解析 <reason> 标签（深度思考模式）
  {
    const parsed = parseThinkingContent(content);
    content = parsed.content.trim();
  }

  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  let parsed: { scores: Array<{ questionId: number; score: number; maxScore: number; feedback: string }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回的批改内容不是合法 JSON');
  }

  if (!parsed.scores || !Array.isArray(parsed.scores)) {
    throw new Error('AI 返回的批改缺少 scores 字段');
  }

  return parsed.scores;
}

/**
 * Reset a FAILED question back to GENERATING for retry.
 */
export async function retryQuestion(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'FAILED' as any) throw new Error('题目状态不允许重试');

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'GENERATING',
      questionContent: null as any,
    },
  });

  return {
    id: updated.id,
    questionType: updated.questionType as QuestionType,
    status: updated.status,
    wordIds: updated.wordIds,
  };
}

/**
 * Reset an ANSWERED or GENERATED question back to GENERATED state for retry.
 * This allows users to re-attempt a question they've already answered.
 */
export async function resetQuestion(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q = await prisma.questionQueue.findUnique({
    where: { id: questionId },
  });

  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.status !== 'ANSWERED' && q.status !== 'GRADING') {
    throw new Error('题目状态不允许重置');
  }

  const updated = await prisma.questionQueue.update({
    where: { id: questionId },
    data: {
      status: 'GENERATED',
      lastAnswer: null as any,
    },
  });

  return {
    id: updated.id,
    questionType: updated.questionType as QuestionType,
    status: updated.status,
    wordIds: updated.wordIds,
  };
}
