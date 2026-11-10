'use server';

import { fetchEnrichedWords, enqueueQuestion } from './utils';
import { extractJSONFromAIContent } from './shared-utils';
import type { RelatedWordEntry } from '@/lib/word-selection';
import type { Meaning } from '@/types/dict';
import { prisma } from '@/lib/db';
import { query as queryDict } from '@/lib/dict/query';
import { getAuthUser } from '@/actions/auth';
import { callOpenAI, parseThinkingContent } from '@/lib/openai';
import { aiQueue } from '@/lib/ai-queue';
import { normalizeMeanings } from '@/lib/meanings';

export interface WordCardItem {
  id: number;
  /** 对应数据库中的 Word.id；关联词若不在用户词库中则为 null（无法标记复习） */
  wordId: number | null;
  word: string;
  meanings: Meaning[];
  /** 例句生成失败标记（重试后仍失败），避免前端一直显示"生成中" */
  sentenceFailed?: boolean;
}

/** AI 例句生成状态：generating=生成中 done=完成（可能部分失败） failed=触发失败 */
export type WordCardSentenceStatus = 'generating' | 'done' | 'failed';

export interface WordCardQuestion {
  title: string;
  cards: WordCardItem[];
  /** AI 例句功能的状态；旧题目没有该字段（未开启例句功能） */
  aiSentencesStatus?: WordCardSentenceStatus;
  /** 例句生成失败的单词数量（done 状态下可能有值） */
  aiSentencesFailedCount?: number;
  /** 点击查看例句：背面默认只显示释义，点「查看例句」才切换为例句视图（旧题目无此字段） */
  sentencesCollapsed?: boolean;
  /** 出题来源单词本；null 表示全部单词本（"所有单词"视图或全范围复习） */
  sourceWordbookIds?: number[] | null;
}

export interface CreateWordCardOptions {
  /** 开启 AI 例句：卡片立即生成，例句由后台逐词补全 */
  aiSentences?: boolean;
  /** 点击查看例句：释义与例句不在同一视图显示（仅在 aiSentences 为真时生效） */
  sentencesCollapsed?: boolean;
  /** 出题来源单词本；null 表示全部单词本 */
  sourceWordbookIds?: number[] | null;
}

/**
 * 直接生成单词卡片题目（不需要 AI）。
 * 单词卡片直接从单词数据生成，无需异步处理。
 * 若开启 aiSentences，卡片立即生成（可命中词库中缓存的例句），
 * 缺少例句的部分标记为 generating，由前端触发后台逐词补全。
 */
export async function createWordCardQuestion(
  wordIds: number[],
  relatedWordEntries?: RelatedWordEntry[],
  options?: CreateWordCardOptions,
) {
  if (!wordIds?.length) {
    throw new Error('缺少单词列表');
  }

  const wordData = await fetchEnrichedWords(wordIds);
  if (wordData.length === 0) throw new Error('所选单词不存在');

  // 合并关联词数据
  const allCards: WordCardItem[] = [];

  // 核心词卡片
  for (let i = 0; i < wordData.length; i++) {
    allCards.push({
      id: i + 1,
      wordId: wordData[i].id,
      word: wordData[i].text,
      meanings: wordData[i].meanings as unknown as Meaning[],
    });
  }

  // 关联词卡片（如果有）
  if (relatedWordEntries && relatedWordEntries.length > 0) {
    // 解析关联词在用户词库中的真实 wordId（用于标记复习状态）
    const owner = await prisma.word.findUnique({
      where: { id: wordIds[0] },
      select: { userId: true },
    });
    const relatedTextToId = new Map<string, number>();
    const relatedTextToMeanings = new Map<string, Meaning[]>();
    if (owner) {
      const relatedTexts = relatedWordEntries.map((rw) => rw.text);
      const relatedWords = await prisma.word.findMany({
        where: {
          userId: owner.userId,
          text: { in: relatedTexts, mode: 'insensitive' },
        },
        select: { id: true, text: true, meanings: true },
      });
      for (const rw of relatedWords) {
        relatedTextToId.set(rw.text.toLowerCase(), rw.id);
        relatedTextToMeanings.set(
          rw.text.toLowerCase(),
          (rw.meanings as unknown as Meaning[]) ?? [],
        );
      }
    }

    const startId = allCards.length + 1;
    for (let i = 0; i < relatedWordEntries.length; i++) {
      const rw = relatedWordEntries[i];
      // 关联词释义：优先使用词库中的释义，否则回退到词典释义。
      // 注意不能使用来源词的释义，否则会把来源词的释义错误地标注在关联词上。
      const key = rw.text.toLowerCase();
      const ownMeanings = relatedTextToMeanings.get(key);
      let meanings: Meaning[];
      if (ownMeanings && ownMeanings.length > 0) {
        meanings = ownMeanings;
      } else {
        const dictEntry = queryDict(rw.text);
        meanings = dictEntry
          ? dictEntry.meaning.map((m) => ({ type: m.type, content: m.content }))
          : [];
      }
      allCards.push({
        id: startId + i,
        wordId: relatedTextToId.get(key) ?? null,
        word: rw.text,
        meanings,
      });
    }
  }

  // 是否还需要后台生成例句
  const needsSentenceGeneration = (options?.aiSentences ?? false) && allCards.some(
    (c) => !c.sentenceFailed && c.meanings.length > 0 && c.meanings.some((m) => !m.sentence?.trim()),
  );

  const content: WordCardQuestion = {
    title: '单词卡片',
    cards: allCards,
    ...(options?.aiSentences
      ? { aiSentencesStatus: needsSentenceGeneration ? ('generating' as const) : ('done' as const) }
      : {}),
    // 「点击查看例句」只在有 AI 例句时才有意义
    ...(options?.aiSentences && options?.sentencesCollapsed ? { sentencesCollapsed: true } : {}),
    sourceWordbookIds: options?.sourceWordbookIds ?? null,
  };

  // 单词卡片通过逐张标记「会/不会」完成，创建时保持未作答状态
  const allWordIds = [...wordIds];
  const result = await enqueueQuestion(content, 'word-card', allWordIds, 'GENERATED');

  return result;
}

function buildSentencePrompts(word: string, meanings: Meaning[]) {
  const meaningLines = meanings.map((m, i) => `${i + 1}. (${m.type}) ${m.content}`).join('\n');
  const systemPrompt = `你是一位专业的英语老师。请为指定单词的每个释义各生成一个英文例句。

要求：
- 这些释义是用户不熟悉的"熟词生义"。每个例句必须体现对应释义的含义，严禁使用该单词更常见的其它含义
- 例句自然地道、语法正确，长度 8-20 个单词
- 目标单词必须出现在例句中（可以使用合适的屈折形式，如复数、时态变化等）
- 例句面向中国高中生水平，避免使用生僻词汇（目标单词本身除外）

先在 <reason> 和 </reason> 标签中写出你的思考，然后在 </reason> 之后输出 JSON：
{"sentences": ["例句1", "例句2", ...]}
sentences 数组长度必须等于释义数量，顺序与释义一一对应。只返回 JSON，不要其它文字。`;
  const userPrompt = `单词：${word}\n释义：\n${meaningLines}`;
  return { systemPrompt, userPrompt };
}

/** 把生成的例句写回词库（Word.meanings 内的 sentence 字段），下次出题直接复用 */
async function cacheWordSentences(wordId: number, meanings: Meaning[]) {
  const fresh = await prisma.word.findUnique({ where: { id: wordId }, select: { meanings: true } });
  if (!fresh) return;
  const freshMeanings = normalizeMeanings(fresh.meanings);
  let changed = false;
  for (const m of meanings) {
    if (!m.sentence?.trim()) continue;
    const target = freshMeanings.find(
      (f) => f.type === m.type && f.content === m.content && !f.sentence?.trim(),
    );
    if (target) {
      target.sentence = m.sentence;
      changed = true;
    }
  }
  if (changed) {
    await prisma.word.update({ where: { id: wordId }, data: { meanings: freshMeanings as any } });
  }
}

async function doGenerateWordCardSentences(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');

  const q0 = await prisma.questionQueue.findUnique({ where: { id: questionId } });
  if (!q0 || q0.userId !== user.userId) return;
  const content0 = q0.questionContent as WordCardQuestion | null;
  if (!content0?.cards?.length) return;
  if (content0.aiSentencesStatus === 'done') return;

  // 待生成例句的卡片（跳过已有例句与已失败的）
  const pendingCards = content0.cards.filter(
    (c) => !c.sentenceFailed && c.meanings.length > 0 && c.meanings.some((m) => !m.sentence?.trim()),
  );

  let failedCount = content0.aiSentencesFailedCount ?? 0;

  for (const card of pendingCards) {
    const needIndices = card.meanings
      .map((m, i) => (!m.sentence?.trim() ? i : -1))
      .filter((i) => i >= 0);
    if (needIndices.length === 0) continue;

    // 为该单词缺例句的释义各生成一句（只发送缺例句的释义，保持对齐）
    let sentences: string[] = [];
    try {
      const needMeanings = needIndices.map((i) => card.meanings[i]);
      const { systemPrompt, userPrompt } = buildSentencePrompts(card.word, needMeanings);
      const result = await callOpenAI(systemPrompt, {
        prompt: userPrompt,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        timeout: 120000,
      });
      let raw = result.content?.trim() ?? '';
      raw = parseThinkingContent(raw).content.trim();
      const data = extractJSONFromAIContent(raw, ['sentences']);
      const arr = Array.isArray(data.sentences) ? data.sentences : [];
      sentences = needIndices.map((_, k) => (typeof arr[k] === 'string' ? (arr[k] as string).trim() : ''));
    } catch (e) {
      console.error(`[word-card] 为 ${card.word} 生成例句失败:`, e);
    }

    // 每个单词完成后重新读取最新内容再合并写入，降低并发覆盖风险
    const q = await prisma.questionQueue.findUnique({ where: { id: questionId } });
    if (!q) return;
    const content = q.questionContent as WordCardQuestion | null;
    if (!content?.cards?.length) return;
    const target = content.cards.find((c) => c.id === card.id);
    if (!target) continue;

    let allOk = true;
    for (let k = 0; k < needIndices.length; k++) {
      const s = sentences[k];
      if (s && target.meanings[needIndices[k]]) {
        target.meanings[needIndices[k]].sentence = s;
      } else {
        allOk = false;
      }
    }
    if (!allOk) {
      target.sentenceFailed = true;
      failedCount += 1;
    }
    await prisma.questionQueue.update({
      where: { id: questionId },
      data: { questionContent: content as any },
    });

    // 写回词库缓存（仅词库中的词）
    if (allOk && card.wordId != null) {
      const updatedMeanings = card.meanings.map((m, i) => {
        const k = needIndices.indexOf(i);
        return k >= 0 && sentences[k] ? { ...m, sentence: sentences[k] } : m;
      });
      try {
        await cacheWordSentences(card.wordId, updatedMeanings);
      } catch (e) {
        console.error('[word-card] 例句写回词库失败:', e);
      }
    }
  }

  // 收尾：标记完成（重新读取，保留过程中已写入的例句）
  const qf = await prisma.questionQueue.findUnique({ where: { id: questionId } });
  if (!qf) return;
  const contentF = qf.questionContent as WordCardQuestion | null;
  if (!contentF?.cards?.length) return;
  contentF.aiSentencesStatus = 'done';
  contentF.aiSentencesFailedCount = failedCount;
  await prisma.questionQueue.update({
    where: { id: questionId },
    data: { questionContent: contentF as any },
  });
}

/**
 * 为单词卡片题目后台逐词生成 AI 例句。
 * 题目状态保持 GENERATED（卡片立即可用），例句通过 questionContent 增量更新，
 * 前端轮询题目内容即可渐进展示。幂等：已有例句的单词自动跳过。
 */
export async function generateWordCardSentencesWithQuestion(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  const q = await prisma.questionQueue.findUnique({ where: { id: questionId } });
  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  if (q.questionType !== 'word-card') throw new Error('题目类型不是单词卡片');

  const content = q.questionContent as WordCardQuestion | null;
  if (!content?.cards?.length) throw new Error('题目内容不完整');
  if (content.aiSentencesStatus === 'done') return;

  const taskKey = `word-card-sentences-${questionId}`;
  if (aiQueue.isTaskInQueue(taskKey)) return; // 已在生成中，直接返回

  await new Promise<void>((resolve, reject) => {
    aiQueue.addTask(taskKey, async () => {
      try {
        await doGenerateWordCardSentences(questionId);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/** 例句生成触发失败时，仅标记例句状态（不影响卡片本身的可用性） */
export async function markWordCardSentencesFailed(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  const q = await prisma.questionQueue.findUnique({ where: { id: questionId } });
  if (!q || q.userId !== user.userId) return;
  const content = q.questionContent as WordCardQuestion | null;
  if (!content?.cards?.length) return;
  if (content.aiSentencesStatus !== 'generating') return;
  content.aiSentencesStatus = 'failed';
  await prisma.questionQueue.update({
    where: { id: questionId },
    data: { questionContent: content as any },
  });
}

/** 重试例句生成：清除失败标记并回到 generating，由前端再次触发 */
export async function retryWordCardSentences(questionId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('未登录');
  const q = await prisma.questionQueue.findUnique({ where: { id: questionId } });
  if (!q) throw new Error('题目不存在');
  if (q.userId !== user.userId) throw new Error('无权访问此题目');
  const content = q.questionContent as WordCardQuestion | null;
  if (!content?.cards?.length) throw new Error('题目内容不完整');

  for (const card of content.cards) {
    card.sentenceFailed = false;
  }
  content.aiSentencesStatus = 'generating';
  await prisma.questionQueue.update({
    where: { id: questionId },
    data: { questionContent: content as any },
  });
}
