/**
 * 加权无重复抽样：Efraimidis-Spirakis 算法
 *
 * 参考：https://en.wikipedia.org/wiki/Reservoir_sampling#Algorithm_A-Res
 *
 * 核心思想：给每个 item 生成 key = u^(1/w)，u 是 [0,1] 均匀随机数
 * 取 key 最大的 k 个 item
 *
 * 时间复杂度 O(n log k)，n=候选数，k=抽样数
 *
 * Corner Cases：
 *   - weight 为 0 的 item 不参与抽样（被过滤）
 *   - 全部 weight 为 0 时，fallback 等权抽样
 *   - k > items.length 时返回全部
 *   - 数值稳定：weight 下限 1e-9 防止除零
 */

import { WeightsConfig } from './weights';

export function weightedSample<T>(
  items: T[],
  weights: number[],
  k: number
): T[] {
  if (items.length === 0 || k <= 0) return [];

  if (items.length !== weights.length) {
    throw new Error(
      `items 和 weights 长度不匹配：${items.length} vs ${weights.length}`
    );
  }

  // k 不能超过 items 数量
  const actualK = Math.min(k, items.length);

  // 1. 过滤 weight > 0 的项
  const valid = items
    .map((item, i) => ({ item, weight: weights[i] }))
    .filter((x) => x.weight > 0);

  // 2. 全部 weight 为 0：fallback 等权抽样（Corner Case）
  if (valid.length === 0) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, actualK);
  }

  // 3. 若有效项少于 k，从无效项中随机补足
  let pool = valid;
  if (valid.length < actualK) {
    const invalid = items
      .map((item, i) => ({ item, weight: weights[i] }))
      .filter((x) => x.weight <= 0);
    const shuffledInvalid = [...invalid];
    for (let i = shuffledInvalid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledInvalid[i], shuffledInvalid[j]] = [shuffledInvalid[j], shuffledInvalid[i]];
    }
    pool = [...valid, ...shuffledInvalid];
  }

  // 4. 给每个 item 生成 key = u^(1/w)，u ∈ [0, 1]
  //    weight 越大，1/w 越小，u^(1/w) 越接近 1，越可能排在前面
  const keyed = pool.map(({ item, weight }) => {
    const u = Math.random();
    // 防止 u=0 时 u^(1/w) = 0；weight=0 已经被过滤
    const safeWeight = Math.max(weight, WeightsConfig.WEIGHT_EPSILON);
    const key = Math.pow(Math.max(u, WeightsConfig.WEIGHT_EPSILON), 1 / safeWeight);
    return { item, key };
  });

  // 5. 取 key 最大的 k 个
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, actualK).map((x) => x.item);
}
