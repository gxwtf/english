'use client';

import { useEffect, useRef, useState } from 'react';

export interface AIProgressView {
  /** 用于展示的平滑进度（0-100） */
  percent: number;
  /** 当前阶段描述 */
  stage: string;
  /** 当前项（批改逐题） */
  current?: number;
  /** 总项数 */
  total?: number;
  /** 已等待时长（毫秒） */
  elapsedMs: number;
  /** 是否已完成 */
  done: boolean;
}

const INITIAL: AIProgressView = {
  percent: 2,
  stage: '正在准备...',
  elapsedMs: 0,
  done: false,
};

/**
 * 轮询服务端 AI 进度，并在服务端阶段之间做平滑插值。
 *
 * Server Action 中的 AI 调用是原子的（无法在中途上报），因此这里
 * 采用「服务端检查点 + 客户端平滑爬升」的策略：服务端上报的百分比
 * 会立即被采纳，两次上报之间进度条缓慢向 96% 逼近，避免长时间卡住不动。
 *
 * @param key    进度键（出题用 questionId，批改用 `grade-${questionId}`）
 * @param active 是否处于等待状态，为 false 时停止轮询
 */
export function useAIProgress(key: string | null, active: boolean): AIProgressView {
  const [view, setView] = useState<AIProgressView>(INITIAL);
  const serverPercentRef = useRef(0);
  const doneRef = useRef(false);
  const seenServerRef = useRef(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!active || !key) return;

    let cancelled = false;
    serverPercentRef.current = 0;
    doneRef.current = false;
    seenServerRef.current = false;
    startedAtRef.current = Date.now();
    setView(INITIAL);

    const poll = async () => {
      try {
        const res = await fetch(`/api/ai-progress?key=${encodeURIComponent(key)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          progress: {
            percent: number;
            stage: string;
            current?: number;
            total?: number;
            done: boolean;
          } | null;
        };
        const p = data.progress;
        if (cancelled || !p) return;
        seenServerRef.current = true;
        if (p.percent > serverPercentRef.current) serverPercentRef.current = p.percent;
        if (p.done) doneRef.current = true;
        setView((prev) => ({
          percent: p.done ? 100 : Math.max(prev.percent, Math.min(p.percent, 97)),
          stage: p.stage || prev.stage,
          current: p.current ?? prev.current,
          total: p.total ?? prev.total,
          elapsedMs: Date.now() - startedAtRef.current,
          done: p.done,
        }));
      } catch {
        // 忽略轮询错误，保持当前进度
      }
    };

    poll();
    const pollId = setInterval(poll, 1000);

    const tickId = setInterval(() => {
      setView((prev) => {
        const elapsedMs = Date.now() - startedAtRef.current;
        if (prev.percent >= 100) return { ...prev, elapsedMs };
        // 服务端尚无上报时缓慢推进到 12%；有上报后仅在服务端进度之上做少量
        // 平滑填充（最多领先 8%），避免把进度顶到接近完成造成“虚假感”。
        const cap = doneRef.current
          ? 100
          : seenServerRef.current
            ? Math.min(92, serverPercentRef.current + 8)
            : 12;
        if (prev.percent >= cap) return { ...prev, elapsedMs };
        const step = Math.max(0.08, (cap - prev.percent) * 0.01);
        return { ...prev, percent: Math.min(cap, prev.percent + step), elapsedMs };
      });
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [key, active]);

  return view;
}
