/**
 * 权重计算单元测试
 *
 * 运行：npx tsx --test src/lib/spaced-repetition/weights.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WeightsConfig,
  clampErrorCount,
  clampInterval,
  clampEf,
  decayErrorCount,
  forgettingWeight,
  errorWeight,
  totalWeight,
  sumWeights,
} from './weights';

describe('clampErrorCount', () => {
  it('应 clamp 在 [1, 20]', () => {
    assert.equal(clampErrorCount(0), 1);
    assert.equal(clampErrorCount(1), 1);
    assert.equal(clampErrorCount(20), 20);
    assert.equal(clampErrorCount(100), 20);
    assert.equal(clampErrorCount(1000), 20);
    assert.equal(clampErrorCount(-5), 1);
  });
});

describe('clampInterval', () => {
  it('应 clamp 在 [1, 365]', () => {
    assert.equal(clampInterval(0), 1);
    assert.equal(clampInterval(1), 1);
    assert.equal(clampInterval(100), 100);
    assert.equal(clampInterval(365), 365);
    assert.equal(clampInterval(1000), 365);
  });

  it('应四舍五入', () => {
    assert.equal(clampInterval(1.4), 1);
    assert.equal(clampInterval(1.6), 2);
  });
});

describe('clampEf', () => {
  it('应 clamp 在 [1.3, 3.0]', () => {
    assert.equal(clampEf(0), 1.3);
    assert.equal(clampEf(1.3), 1.3);
    assert.equal(clampEf(2.5), 2.5);
    assert.equal(clampEf(3.0), 3.0);
    assert.equal(clampEf(5.0), 3.0);
  });
});

describe('decayErrorCount', () => {
  it('应快速衰减（4 步清零）', () => {
    // 11 → 6 → 3 → 2 → 1
    let e = 11;
    e = decayErrorCount(e);
    assert.equal(e, 6);
    e = decayErrorCount(e);
    assert.equal(e, 3);
    e = decayErrorCount(e);
    assert.equal(e, 2);
    e = decayErrorCount(e);
    assert.equal(e, 1);
  });

  it('最小值为 1，不会降到 0', () => {
    assert.equal(decayErrorCount(1), 1);
    assert.equal(decayErrorCount(2), 1);
    assert.equal(decayErrorCount(3), 2);
  });

  it('应 clamp 在 [1, 20]', () => {
    // 即使原值超大，衰减后也不会超过 20
    assert.equal(decayErrorCount(1000), 20);
  });
});

describe('forgettingWeight f(t)', () => {
  const now = new Date('2026-08-06T00:00:00Z');

  it('从未复习应返回 1.0（基础权重）', () => {
    assert.equal(
      forgettingWeight({ lastReviewedAt: null, interval: 1 }, now),
      1.0
    );
  });

  it('刚复习完（elapsed=0）应返回 0（避免连刷）', () => {
    const state = {
      lastReviewedAt: now,
      interval: 6,
    };
    assert.equal(forgettingWeight(state, now), 0);
  });

  it('到期日当天（elapsed=interval）应返回约 0.63', () => {
    const lastReviewedAt = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const state = { lastReviewedAt, interval: 6 };
    const f = forgettingWeight(state, now);
    // R = e^(-1) ≈ 0.368，f = 1 - R ≈ 0.632
    assert.ok(
      Math.abs(f - 0.632) < 0.01,
      `期望约 0.632，实际 ${f}`
    );
  });

  it('严重超期（elapsed=2×interval）应返回约 0.86', () => {
    const lastReviewedAt = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);
    const state = { lastReviewedAt, interval: 6 };
    const f = forgettingWeight(state, now);
    // R = e^(-2) ≈ 0.135，f ≈ 0.865
    assert.ok(
      Math.abs(f - 0.865) < 0.01,
      `期望约 0.865，实际 ${f}`
    );
  });

  it('超长超期应趋近于 1', () => {
    const lastReviewedAt = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const state = { lastReviewedAt, interval: 6 };
    const f = forgettingWeight(state, now);
    assert.ok(f > 0.99, `期望接近 1，实际 ${f}`);
  });

  it('系统时钟回拨时应返回 0', () => {
    // lastReviewedAt 在未来，elapsed 应 clamp 为 0
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const state = { lastReviewedAt: future, interval: 6 };
    const f = forgettingWeight(state, now);
    assert.equal(f, 0);
  });
});

describe('errorWeight g(e)', () => {
  it('e=1 (新词) → g=1', () => {
    assert.equal(errorWeight(1), 1);
  });

  it('e=2 → g=4', () => {
    assert.equal(errorWeight(2), 4);
  });

  it('e=6 → g=36', () => {
    assert.equal(errorWeight(6), 36);
  });

  it('e=11 → g=121', () => {
    assert.equal(errorWeight(11), 121);
  });

  it('应 clamp 输入，e=1000 → g=400', () => {
    assert.equal(errorWeight(1000), 400); // clamp 到 20，g=400
  });

  it('e=0 应被 clamp 到 1，g=1', () => {
    assert.equal(errorWeight(0), 1);
  });
});

describe('totalWeight', () => {
  const now = new Date('2026-08-06T00:00:00Z');

  it('新词（无 state）应返回 1.0', () => {
    assert.equal(totalWeight(null, now), 1.0);
  });

  it('刚批改完应返回 0（不出）', () => {
    const state = {
      lastReviewedAt: now,
      interval: 6,
      errorCount: 1,
    };
    assert.equal(totalWeight(state, now), 0);
  });

  it('严重超期+多次错应返回大权重', () => {
    const lastReviewedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const state = {
      lastReviewedAt,
      interval: 6,
      errorCount: 6,
    };
    const w = totalWeight(state, now);
    // f ≈ 0.99, g = 36, total ≈ 35.7
    assert.ok(w > 35, `期望 >35，实际 ${w}`);
  });

  it('到期日当天+不错应返回约 0.63', () => {
    const lastReviewedAt = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const state = {
      lastReviewedAt,
      interval: 6,
      errorCount: 1,
    };
    const w = totalWeight(state, now);
    assert.ok(
      Math.abs(w - 0.632) < 0.01,
      `期望约 0.632，实际 ${w}`
    );
  });
});

describe('sumWeights', () => {
  const now = new Date('2026-08-06T00:00:00Z');

  it('应正确求和', () => {
    const states = [
      null, // 新词，w=1
      { lastReviewedAt: now, interval: 6, errorCount: 1 }, // 刚复习，w=0
      { lastReviewedAt: null, interval: 1, errorCount: 1 }, // 新词，w=1
    ];
    const sum = sumWeights(states, now);
    assert.equal(sum, 2.0);
  });

  it('空数组应返回 0', () => {
    assert.equal(sumWeights([], now), 0);
  });
});
