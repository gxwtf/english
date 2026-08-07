/**
 * SM-2 算法单元测试
 * 使用 node:test 内置框架
 *
 * 运行：npx tsx --test src/lib/spaced-repetition/sm2.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sm2InitState, sm2Update } from './sm2';

describe('sm2InitState', () => {
  it('返回正确的初始状态', () => {
    const state = sm2InitState();
    assert.equal(state.repetitions, 0);
    assert.equal(state.ef, 2.5);
    assert.equal(state.interval, 1);
  });
});

describe('sm2Update - 成功回忆序列', () => {
  it('连续答对 5 次：interval 应单调递增，repetitions 累加', () => {
    // 注意：SM-2 经典序列 1→6→15→37→92 假定 EF 恒为 2.5
    // 实际每次答对都会调整 EF（quality=5 时 EF+0.1），所以 interval 会更大
    let state = sm2InitState();
    const intervals: number[] = [];

    // 第 1 次：repetitions 0→1, interval=1
    state = sm2Update(state, 5);
    assert.equal(state.repetitions, 1);
    assert.equal(state.interval, 1);
    intervals.push(state.interval);

    // 第 2 次：repetitions 1→2, interval=6
    state = sm2Update(state, 5);
    assert.equal(state.repetitions, 2);
    assert.equal(state.interval, 6);
    intervals.push(state.interval);

    // 第 3 次：interval = round(6 × 当前EF)
    // EF 此时 = 2.5 + 0.1 + 0.1 = 2.7，所以 interval = round(16.2) = 16
    state = sm2Update(state, 5);
    assert.equal(state.repetitions, 3);
    assert.equal(state.interval, 16);
    intervals.push(state.interval);

    // 第 4、5 次：interval 继续增长
    state = sm2Update(state, 5);
    assert.equal(state.repetitions, 4);
    intervals.push(state.interval);

    state = sm2Update(state, 5);
    assert.equal(state.repetitions, 5);
    intervals.push(state.interval);

    // 验证 interval 单调递增
    for (let i = 1; i < intervals.length; i++) {
      assert.ok(
        intervals[i] > intervals[i - 1],
        `interval 应单调递增：${intervals.join(' → ')}`
      );
    }
  });

  it('quality=3（答对但困难）也应推进序列', () => {
    let state = sm2InitState();
    state = sm2Update(state, 3);
    assert.equal(state.repetitions, 1);
    assert.equal(state.interval, 1);
  });
});

describe('sm2Update - 遗忘处理', () => {
  it('quality=2 应重置 repetitions 和 interval', () => {
    let state = sm2InitState();
    // 先答对 3 次（interval 增长到 16，因 EF 也会增长）
    state = sm2Update(state, 5);
    state = sm2Update(state, 5);
    state = sm2Update(state, 5);
    assert.equal(state.interval, 16);

    // 答错
    state = sm2Update(state, 2);
    assert.equal(state.repetitions, 0);
    assert.equal(state.interval, 1);
  });

  it('quality=0 完全遗忘也应重置', () => {
    let state = sm2InitState();
    state = sm2Update(state, 5);
    state = sm2Update(state, 0);
    assert.equal(state.repetitions, 0);
    assert.equal(state.interval, 1);
  });
});

describe('sm2Update - EF 调整', () => {
  it('quality=5 时 EF 应增加', () => {
    let state = sm2InitState();
    const initialEf = state.ef;
    state = sm2Update(state, 5);
    assert.ok(
      state.ef > initialEf,
      `EF 应增加，但 ${initialEf} → ${state.ef}`
    );
  });

  it('quality=2 时 EF 应减少', () => {
    let state = sm2InitState();
    const initialEf = state.ef;
    state = sm2Update(state, 2);
    assert.ok(
      state.ef < initialEf,
      `EF 应减少，但 ${initialEf} → ${state.ef}`
    );
  });

  it('EF 应有下限 1.3', () => {
    let state = sm2InitState();
    // 连续答错多次，EF 应被 clamp 在 1.3
    for (let i = 0; i < 20; i++) {
      state = sm2Update(state, 0);
    }
    assert.ok(state.ef >= 1.3, `EF 不应低于 1.3，实际 ${state.ef}`);
    assert.equal(state.ef, 1.3);
  });

  it('EF 应有上限 3.0', () => {
    let state = sm2InitState();
    // 连续答对多次，EF 应被 clamp 在 3.0
    for (let i = 0; i < 50; i++) {
      state = sm2Update(state, 5);
    }
    assert.ok(state.ef <= 3.0, `EF 不应高于 3.0，实际 ${state.ef}`);
  });
});

describe('sm2Update - interval clamp', () => {
  it('interval 应有上限 365 天', () => {
    let state = sm2InitState();
    // 连续答对很多次，interval 应被 clamp
    for (let i = 0; i < 30; i++) {
      state = sm2Update(state, 5);
    }
    assert.ok(state.interval <= 365, `interval 不应超过 365，实际 ${state.interval}`);
    assert.equal(state.interval, 365);
  });
});

describe('sm2Update - 参数校验', () => {
  it('quality < 0 应抛错', () => {
    assert.throws(
      () => sm2Update(sm2InitState(), -1),
      /quality 必须在 0-5 之间/
    );
  });

  it('quality > 5 应抛错', () => {
    assert.throws(
      () => sm2Update(sm2InitState(), 6),
      /quality 必须在 0-5 之间/
    );
  });
});
