/**
 * 权重计算工具
 *
 * 二维混合权重：totalWeight = f(t) × g(e)
 *   - f(t) = 1 - e^(-elapsed/interval)  遗忘曲线权重
 *   - g(e) = e²                          错误权重（e 初值 1）
 *
 * 数值溢出防护：所有因子都有 clamp
 */

export const WeightsConfig = {
  MAX_ERROR_COUNT: 20,
  MIN_ERROR_COUNT: 1,
  MAX_INTERVAL_DAYS: 365,
  MIN_INTERVAL_DAYS: 1,
  MIN_EF: 1.3,
  MAX_EF: 3.0,
  // 防止 weightedSample 中除零
  WEIGHT_EPSILON: 1e-9,
} as const;

/**
 * clamp errorCount 在 [1, 20]，防止 g(e) = e² 爆炸
 */
export function clampErrorCount(e: number): number {
  return Math.max(
    WeightsConfig.MIN_ERROR_COUNT,
    Math.min(WeightsConfig.MAX_ERROR_COUNT, e)
  );
}

/**
 * clamp interval 在 [1, 365] 天，防止 SM-2 间隔指数增长失控
 */
export function clampInterval(i: number): number {
  return Math.max(
    WeightsConfig.MIN_INTERVAL_DAYS,
    Math.min(WeightsConfig.MAX_INTERVAL_DAYS, Math.round(i))
  );
}

/**
 * clamp ef 在 [1.3, 3.0]，符合 SM-2 下限规定 + 设上限
 */
export function clampEf(ef: number): number {
  return Math.max(WeightsConfig.MIN_EF, Math.min(WeightsConfig.MAX_EF, ef));
}

/**
 * 答对时的 errorCount 衰减：e ← max(1, ceil(e/2))
 *
 * 衰减序列（从 e=11 开始）：
 *   11 → 6 → 3 → 2 → 1   （4 步清零）
 *
 * 已 clamp，不会低于 1
 */
export function decayErrorCount(errorCount: number): number {
  const decayed = Math.max(1, Math.ceil(errorCount / 2));
  return clampErrorCount(decayed);
}

/**
 * f(t) 遗忘曲线权重
 *
 * 基于 SM-2 算出的 interval（即记忆稳定性 S）和 lastReviewedAt，
 * 计算当前回忆概率 R = e^(-elapsed/S)，权重 = 1 - R
 *
 * @returns 0~1，越接近 1 表示越该复习
 */
export function forgettingWeight(
  state: { lastReviewedAt: Date | null; interval: number },
  now: Date = new Date()
): number {
  // 从未复习：基础权重 1.0
  if (!state.lastReviewedAt) return 1.0;

  const elapsedMs = now.getTime() - state.lastReviewedAt.getTime();
  // 系统时钟回拨时 elapsed 可能为负，clamp 为 0
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  // stability 至少 1 天，防止除零和过大 elapsed
  const stability = Math.max(1, state.interval);

  const R = Math.exp(-elapsedDays / stability);
  return 1 - R;
}

/**
 * g(e) 错误权重
 *
 * e² 平方增长（e 初值 1，所以新词 g=1）
 * 已 clamp e 在 [1, 20]，g 上限 = 400
 */
export function errorWeight(errorCount: number): number {
  const e = clampErrorCount(errorCount);
  return e * e;
}

/**
 * 二维混合权重：f(t) × g(e)
 *
 * 用于加权抽样，决定哪些词优先被抽出
 *
 * 边界：
 *   - 新词（无 reviewState）：f=1, g=1, total=1
 *   - 刚批改完：f=0, total=0（不出，避免连刷）
 *   - 严重超期 + 多次错：f≈1, g 大, total 大（优先出）
 */
export function totalWeight(
  state: {
    lastReviewedAt: Date | null;
    interval: number;
    errorCount: number;
  } | null,
  now: Date = new Date()
): number {
  // 无状态：新词，返回基础权重 1.0
  if (!state) return 1.0;

  const f = forgettingWeight(state, now);
  const g = errorWeight(state.errorCount);
  return f * g;
}

/**
 * 计算多个 state 的权重总和
 * 用于判断是否需要 fallback 等权抽样
 */
export function sumWeights(
  states: Array<{ lastReviewedAt: Date | null; interval: number; errorCount: number } | null>,
  now: Date = new Date()
): number {
  return states.reduce((sum, s) => sum + totalWeight(s, now), 0);
}

/**
 * 判断某词是否到期（f(t) > 0.5）
 *
 * f(t) > 0.5 等价于 elapsed > -ln(0.5) × interval ≈ 0.693 × interval
 */
export function isDue(
  state: { lastReviewedAt: Date | null; interval: number } | null,
  now: Date = new Date()
): boolean {
  if (!state || !state.lastReviewedAt) return false;
  const elapsedDays = (now.getTime() - state.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24);
  const threshold = -Math.log(0.5) * state.interval;
  return elapsedDays > threshold;
}
