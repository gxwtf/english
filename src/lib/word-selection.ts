import type { Word } from '@/types/word';

/**
 * 从选中的单词中随机抽取指定数量的单词，并处理关联词依赖关系
 *
 * 关联词依赖规则：
 * - 如果 A 的关联词包含 B，且 A 和 B 都在选中列表中
 * - 当随机选中 A 时，必须同时选中 B（因为 B 是 A 的关联词，有助于学习 A）
 *
 * @param selectedWords - 用户选中的所有单词
 * @param neededCount - 需要抽取的单词数量
 * @returns 抽取后的单词 ID 列表
 */
export function selectWordsForQuestion(
  selectedWords: Word[],
  neededCount: number
): number[] {
  const selectedCount = selectedWords.length;

  // 如果不需要抽取（选中的单词数量 <= 需要的数量），直接返回所有选中单词的 ID
  if (selectedCount <= neededCount) {
    return selectedWords.map(w => w.id);
  }

  // 构建文本到 ID 的映射
  const wordTextToId = new Map<string, number>();
  for (const word of selectedWords) {
    wordTextToId.set(word.text.toLowerCase(), word.id);
  }

  // 构建关联依赖图：如果 A 的 relatedWords 包含 B，且 B 也在选中列表中
  // 则 A 依赖于 B（选中 A 时必须同时选中 B）
  // dependencyMap: wordId -> 该单词依赖的所有关联词 ID 集合
  const dependencyMap = new Map<number, Set<number>>();

  for (const word of selectedWords) {
    const wordId = word.id;
    const deps = new Set<number>();

    // 检查该单词的关联词是否也在选中列表中
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

  // Fisher-Yates 随机打乱
  const shuffled = [...selectedWords];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 贪心抽取 + 依赖闭包
  const result = new Set<number>();

  for (const word of shuffled) {
    if (result.size >= neededCount) break;

    const wordId = word.id;

    // 如果已经选中了该单词，跳过
    if (result.has(wordId)) continue;

    // 如果需要添加该单词，先添加它的所有依赖（关联词）
    const deps = dependencyMap.get(wordId);
    if (deps) {
      for (const depId of deps) {
        if (!result.has(depId)) {
          result.add(depId);
        }
      }
    }

    // 添加当前单词
    result.add(wordId);
  }

  return Array.from(result).slice(0, neededCount);
}
