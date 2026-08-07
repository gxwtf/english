/**
 * SM-2 间隔重复算法（SuperMemo 2）
 *
 * 参考：https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html
 *
 * 核心思想：每张卡片维护三个状态
 *   - repetitions: 连续正确回忆的次数
 *   - ef (Ease Factor): 这张卡对用户来说"多容易"，初值 2.5
 *   - interval: 下次复习要等多少天
 *
 * 用户每次复习打分（quality 0-5）：
 *   - 5: 完美回忆
 *   - 4: 正确但犹豫
 *   - 3: 正确但困难
 *   - <3: 遗忘
 */

import { clampEf, clampInterval, type WeightsConfig } from './weights';

export interface SchedState {
  repetitions: number;
  ef: number;
  interval: number;
}

/**
 * SM-2 初始状态
 */
export function sm2InitState(): SchedState {
  return {
    repetitions: 0,
    ef: 2.5,
    interval: 1,
  };
}

/**
 * SM-2 状态更新
 *
 * @param state 当前状态
 * @param quality 0-5，<3 视为遗忘
 * @returns 新状态
 */
export function sm2Update(state: SchedState, quality: number): SchedState {
  if (quality < 0 || quality > 5) {
    throw new Error(`quality 必须在 0-5 之间，收到 ${quality}`);
  }

  let { repetitions, ef, interval } = state;

  if (quality >= 3) {
    // 成功回忆
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    repetitions += 1;
  } else {
    // 遗忘：重置进度
    repetitions = 0;
    interval = 1;
  }

  // 调整 EF：EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  ef = ef + delta;

  // 应用 clamp 防止数值溢出
  ef = clampEf(ef);
  interval = clampInterval(interval);

  return { repetitions, ef, interval };
}
