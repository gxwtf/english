import type { Word, RelatedWord } from '@/types/word';

/**
 * 从选中的单词中随机抽取指定数量的单词，并处理关联词依赖关系
 *
 * 关联词依赖规则：
 * - 如果 A 的关联词包含 B，且 A 和 B 都在选中列表中
 * - 当随机选中 A 时，必须同时选中 B（因为 B 是 A 的关联词，有助于学习 A）
 *
 * @param selectedWords - 用户选中的所有单词
 * @param neededCount - 需要抽取的单词数量
 * @param includeRelatedWords - 是否包含关联词（以较低概率抽取）
 * @returns 包含抽取的单词 ID 列表和关联词信息（文本+类型）
 */
export function selectWordsForQuestion(
  selectedWords: Word[],
  neededCount: number,
  includeRelatedWords?: boolean
): { wordIds: number[]; relatedWordEntries: RelatedWordEntry[] } {
  const selectedCount = selectedWords.length;

  // 构建文本到 ID 的映射（仅选中单词）
  const wordTextToId = new Map<string, number>();
  for (const word of selectedWords) {
    wordTextToId.set(word.text.toLowerCase(), word.id);
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
    const wordIds = selectCoreWords(selectedWords, neededCount, wordTextToId);
    return { wordIds, relatedWordEntries: [] };
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
  if (neededCount <= 1 || maxRelatedCount === 0) {
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

  // 核心词数量 = neededCount - 关联词数量
  const coreCountNeeded = neededCount - relatedCountNeeded;

  // 抽取核心词
  const coreWordIds = selectCoreWords(selectedWords, coreCountNeeded, wordTextToId);

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
 * 从选中的单词中抽取核心词（原有逻辑）
 *
 * 贪心抽取 + 依赖闭包，但会在加入前检查是否会超出 neededCount，
 * 如果超出则跳过该词（避免截断导致依赖关系被破坏）。
 */
function selectCoreWords(
  selectedWords: Word[],
  neededCount: number,
  wordTextToId: Map<string, number>
): number[] {
  const selectedCount = selectedWords.length;

  if (selectedCount <= neededCount) {
    return selectedWords.map(w => w.id);
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
    const newDeps = deps ? Array.from(deps).filter(d => !result.has(d)) : [];
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
