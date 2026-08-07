'use server';

import type { Word, RelatedWord } from '@/types/word';
import { prisma } from '@/lib/db';
import { totalWeight } from '@/lib/spaced-repetition/weights';
import { weightedSample } from '@/lib/spaced-repetition/selector';

/**
 * 从选中的单词中抽取指定数量的单词，并处理关联词依赖关系
 *
 * 改造点：核心词抽样使用加权无重复抽样（Efraimidis-Spirakis），
 * 权重 = f(t) × g(e)（遗忘曲线 × 错误次数平方）
 *
 * 关联词依赖规则：
 * - 如果 A 的关联词包含 B，且 A 和 B 都在选中列表中
 * - 当选中 A 时，必须同时选中 B（仅在候选池 ≤ neededCount 时生效，保留原依赖闭包逻辑）
 * - 候选池 > neededCount 时走加权抽样，依赖闭包失效（概率低）
 *
 * @param selectedWords 用户选中的所有单词
 * @param neededCount 需要抽取的单词数量
 * @param includeRelatedWords 是否包含关联词（以较低概率抽取）
 * @returns 包含抽取的单词 ID 列表和关联词信息（文本+类型）
 */
export async function selectWordsForQuestion(
  selectedWords: Word[],
  neededCount: number,
  includeRelatedWords?: boolean,
  useWeightedSampling: boolean = true
): Promise<{ wordIds: number[]; relatedWordEntries: RelatedWordEntry[] }> {
  const selectedCount = selectedWords.length;

  // 构建文本到 ID 的映射（仅选中单词）
  const wordTextToId = new Map<string, number>();
  for (const word of selectedWords) {
    wordTextToId.set(word.text.toLowerCase(), word.id);
  }

  // 反查 userId（从第一个词的 owner 推断，所有词属于同一用户）
  let userId: number | null = null;
  if (selectedWords.length > 0) {
    const firstWord = await prisma.word.findUnique({
      where: { id: selectedWords[0].id },
      select: { userId: true },
    });
    if (firstWord) userId = firstWord.userId;
  }

  // 收集所有关联词（不在选中列表中的）及其来源
  // relatedWordEntries: 关联词文本 -> { types: Set<关联类型>, sourceWords: Set<来源单词文本> }
  const relatedWordMap = new Map<string, { types: Set<string>; sourceWords: Set<string> }>();

  for (const word of selectedWords) {
    for (const related of word.relatedWords || []) {
      // 排除已在选中列表中的关联词（它们已有 ID，会正常抽取）
      if (wordTextToId.has(related.text.toLowerCase())) continue;
      if (!relatedWordMap.has(related.text)) {
        relatedWordMap.set(related.text, { types: new Set(), sourceWords: new Set() });
      }
      const entry = relatedWordMap.get(related.text)!;
      entry.types.add(related.type);
      entry.sourceWords.add(word.text);
    }
  }

  // 计算关联词池
  const relatedWordEntries: RelatedWordEntry[] = [];
  for (const [text, info] of relatedWordMap) {
    relatedWordEntries.push({
      text,
      types: Array.from(info.types),
      sourceWords: Array.from(info.sourceWords),
    });
  }

  if (!includeRelatedWords || relatedWordEntries.length === 0) {
    const wordIds = await selectCoreWords(userId, selectedWords, neededCount, wordTextToId, useWeightedSampling);
    return { wordIds: wordIds ?? [], relatedWordEntries: [] };
  }

  const softMaxRelated = Math.floor(neededCount * 0.3);
  const mustIncludeRelated = selectedWords.length < neededCount;
  const minRelatedNeeded = mustIncludeRelated
    ? Math.min(neededCount - selectedWords.length, relatedWordEntries.length)
    : 0;
  const maxRelatedCount = Math.min(
    relatedWordEntries.length,
    mustIncludeRelated ? neededCount - 1 : softMaxRelated
  );

  let relatedCountNeeded: number;
  if (neededCount <= 1) {
    // 单单词场景：仍然抽取关联词作为干扰选项来源（不占用核心词名额）
    relatedCountNeeded = Math.min(2, relatedWordEntries.length);
  } else if (maxRelatedCount === 0) {
    relatedCountNeeded = 0;
  } else if (mustIncludeRelated) {
    relatedCountNeeded = Math.max(minRelatedNeeded, Math.min(maxRelatedCount, Math.random() < 0.4 ? 1 : Math.min(2, maxRelatedCount)));
  } else {
    const roll = Math.random();
    if (roll < 0.6) {
      relatedCountNeeded = 0;
    } else if (roll < 0.9) {
      relatedCountNeeded = Math.min(1, maxRelatedCount);
    } else {
      relatedCountNeeded = Math.min(2, maxRelatedCount);
    }
  }

  // 核心词数量：单单词场景下关联词不占用名额，多单词场景下从 neededCount 中扣除
  const coreCountNeeded = neededCount <= 1 ? neededCount : neededCount - relatedCountNeeded;

  // 抽取核心词（加权抽样）
  const coreWordIds = (await selectCoreWords(userId, selectedWords, coreCountNeeded, wordTextToId, useWeightedSampling)) ?? [];

  // 随机抽取关联词
  const shuffledRelated = [...relatedWordEntries];
  for (let i = shuffledRelated.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledRelated[i], shuffledRelated[j]] = [shuffledRelated[j], shuffledRelated[i]];
  }
  const selectedRelatedWords = shuffledRelated.slice(0, relatedCountNeeded);

  return { wordIds: coreWordIds, relatedWordEntries: selectedRelatedWords };
}

export type RelatedWordEntry = {
  text: string;
  types: string[];
  sourceWords: string[];
};

/**
 * 从选中的单词中抽取核心词
 *
 * 策略：
 *   - 候选池 ≤ neededCount：保留原依赖闭包逻辑（贪心抽取，全返回）
 *   - 候选池 > neededCount 且 useWeightedSampling=true：加权抽样（遗忘曲线 × 错误权重）
 *   - 候选池 > neededCount 且 useWeightedSampling=false：等概率抽样（Fisher-Yates 洗牌）
 *
 * 依赖闭包在加权抽样场景失效，因为加权抽样不支持"选 A 必选 B"约束。
 * 但在候选池大的场景，依赖闭包触发概率低（仅当 A、B 都在 selectedWords 且都被抽中时）。
 */
async function selectCoreWords(
  userId: number | null,
  selectedWords: Word[],
  neededCount: number,
  wordTextToId: Map<string, number>,
  useWeightedSampling: boolean = true
): Promise<number[] | null> {
  const selectedCount = selectedWords.length;

  if (selectedCount <= neededCount) {
    // 即使全部返回，也要随机打乱顺序，避免总是按 createdAt 顺序取词
    // 同时保留依赖闭包逻辑
    return selectCoreWordsWithDependency(selectedWords, neededCount, wordTextToId);
  }

  // 候选池 > neededCount 且关闭遗忘曲线：等概率抽样
  if (!useWeightedSampling) {
    const shuffled = [...selectedWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, neededCount).map((w) => w.id);
  }

  // 候选池 > neededCount：加权抽样
  if (userId == null) {
    // 无法反查 userId（不应发生），fallback 等权抽样
    return selectCoreWordsWithDependency(selectedWords, neededCount, wordTextToId);
  }

  const wordIds = selectedWords.map((w) => w.id);

  // 查 reviewStates
  const states = await prisma.wordReviewState.findMany({
    where: { userId, wordId: { in: wordIds } },
  });
  const stateMap = new Map(states.map((s) => [s.wordId, s]));

  // 算权重
  const now = new Date();
  const items = selectedWords.map((w) => {
    const state = stateMap.get(w.id);
    return {
      word: w,
      weight: totalWeight(
        state
          ? {
              lastReviewedAt: state.lastReviewedAt,
              interval: state.interval,
              errorCount: state.errorCount,
            }
          : null,
        now
      ),
    };
  });

  // 加权抽样
  const sampled = weightedSample(
    items.map((i) => i.word),
    items.map((i) => i.weight),
    neededCount
  );

  return sampled.map((w) => w.id);
}

/**
 * 原依赖闭包贪心抽取（候选池 ≤ neededCount 时使用）
 * 保留原逻辑，仅做最小改动
 */
function selectCoreWordsWithDependency(
  selectedWords: Word[],
  neededCount: number,
  wordTextToId: Map<string, number>
): number[] {
  const selectedCount = selectedWords.length;

  if (selectedCount <= neededCount) {
    // 即使全部返回，也要随机打乱顺序，避免总是按 createdAt 顺序取词
    const shuffled = [...selectedWords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.map((w) => w.id);
  }

  const dependencyMap = new Map<number, Set<number>>();

  for (const word of selectedWords) {
    const wordId = word.id;
    const deps = new Set<number>();

    for (const related of word.relatedWords || []) {
      const relatedId = wordTextToId.get(related.text.toLowerCase());
      if (relatedId !== undefined && relatedId !== wordId) {
        deps.add(relatedId);
      }
    }

    if (deps.size > 0) {
      dependencyMap.set(wordId, deps);
    }
  }

  const shuffled = [...selectedWords];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const result = new Set<number>();

  for (const word of shuffled) {
    if (result.size >= neededCount) break;

    const wordId = word.id;

    if (result.has(wordId)) continue;

    const deps = dependencyMap.get(wordId);
    const newDeps = deps ? Array.from(deps).filter((d) => !result.has(d)) : [];
    const totalAfterAdd = result.size + 1 + newDeps.length;

    if (totalAfterAdd > neededCount) {
      continue;
    }

    for (const depId of newDeps) {
      result.add(depId);
    }

    result.add(wordId);
  }

  return Array.from(result);
}
