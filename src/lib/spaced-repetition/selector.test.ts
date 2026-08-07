/**
 * 加权抽样单元测试（Efraimidis-Spirakis）
 *
 * 运行：npx tsx --test src/lib/spaced-repetition/selector.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { weightedSample } from './selector';

describe('weightedSample - 基础功能', () => {
  it('空数组应返回空', () => {
    assert.deepEqual(weightedSample([], [], 5), []);
  });

  it('k=0 应返回空', () => {
    assert.deepEqual(weightedSample([1, 2, 3], [1, 1, 1], 0), []);
  });

  it('k > items.length 应返回全部 items（不重复）', () => {
    const result = weightedSample([1, 2, 3], [1, 1, 1], 10);
    assert.equal(result.length, 3);
    assert.deepEqual(result.sort(), [1, 2, 3]);
  });

  it('应返回 k 个不重复的 item', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const weights = items.map(() => 1);
    const result = weightedSample(items, weights, 5);
    assert.equal(result.length, 5);
    // 验证不重复
    const set = new Set(result);
    assert.equal(set.size, 5);
    // 验证都是 items 中的元素
    result.forEach((r) => assert.ok(items.includes(r)));
  });
});

describe('weightedSample - 权重效果', () => {
  it('蒙特卡洛验证：高权重 item 应更频繁被抽中', () => {
    // items: [A, B, C]，权重 [100, 1, 1]
    // 抽 1 个，重复 10000 次
    // A 应被抽中约 9800+ 次
    const items = ['A', 'B', 'C'];
    const weights = [100, 1, 1];
    const counts = { A: 0, B: 0, C: 0 };

    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      const result = weightedSample(items, weights, 1);
      counts[result[0] as 'A' | 'B' | 'C']++;
    }

    // A 应占 ~98%（100/102）
    const aRatio = counts.A / trials;
    assert.ok(
      aRatio > 0.95,
      `A 应被抽中 95%+，实际 ${(aRatio * 100).toFixed(1)}%`
    );
    // B 和 C 应各约 1%
    assert.ok(counts.B < 300, `B 应被抽中很少，实际 ${counts.B}`);
    assert.ok(counts.C < 300, `C 应被抽中很少，实际 ${counts.C}`);
  });

  it('等权时分布应均匀', () => {
    const items = ['A', 'B', 'C', 'D'];
    const weights = [1, 1, 1, 1];
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      const result = weightedSample(items, weights, 1);
      counts[result[0] as keyof typeof counts]++;
    }

    // 每个 item 应被抽中约 25%（±5%）
    for (const item of items) {
      const ratio = counts[item] / trials;
      assert.ok(
        Math.abs(ratio - 0.25) < 0.05,
        `${item} 应约 25%，实际 ${(ratio * 100).toFixed(1)}%`
      );
    }
  });
});

describe('weightedSample - Corner Cases', () => {
  it('全部 weight 为 0 应 fallback 等权抽样', () => {
    const items = [1, 2, 3, 4, 5];
    const weights = [0, 0, 0, 0, 0];
    const result = weightedSample(items, weights, 3);
    assert.equal(result.length, 3);
    // 验证返回的是 items 中的元素
    result.forEach((r) => assert.ok(items.includes(r)));
  });

  it('部分 weight 为 0 应被过滤', () => {
    // 蒙特卡洛：A 权重 0，B、C 权重 1
    // A 不应被抽中
    const items = ['A', 'B', 'C'];
    const weights = [0, 1, 1];
    const counts = { A: 0, B: 0, C: 0 };

    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const result = weightedSample(items, weights, 1);
      counts[result[0] as 'A' | 'B' | 'C']++;
    }

    assert.equal(counts.A, 0, '权重为 0 的 item 不应被抽中');
    assert.ok(counts.B > 0);
    assert.ok(counts.C > 0);
  });

  it('有效项少于 k 时应从无效项中补足', () => {
    // items: [A, B, C, D]，权重 [10, 0, 0, 0]，k=3
    // A 必出，B/C/D 等权补足 2 个
    const items = ['A', 'B', 'C', 'D'];
    const weights = [10, 0, 0, 0];
    const result = weightedSample(items, weights, 3);
    assert.equal(result.length, 3);
    assert.ok(result.includes('A'), 'A 必出');
    // 另外两个是 B/C/D 中的任意两个
    const others = result.filter((x) => x !== 'A');
    assert.equal(others.length, 2);
    others.forEach((o) => assert.ok(['B', 'C', 'D'].includes(o)));
  });

  it('权重极大不应崩溃', () => {
    // 数值溢出防护测试
    const items = [1, 2, 3];
    const weights = [1e10, 1, 1];
    const result = weightedSample(items, weights, 2);
    assert.equal(result.length, 2);
    assert.ok(result.includes(1), '极大权重项应被抽中');
  });

  it('items 与 weights 长度不匹配应抛错', () => {
    assert.throws(
      () => weightedSample([1, 2, 3], [1, 1], 2),
      /长度不匹配/
    );
  });

  it('单个 item + 单个权重应正常工作', () => {
    const result = weightedSample([42], [1], 1);
    assert.deepEqual(result, [42]);
  });
});
