'use client';

import { markQuestionAsFailed } from '@/actions/ai-question';

export interface PendingQuestionItem {
  questionId: string;
  questionType: string;
  wordIds: number[];
  options: any;
  relatedWordEntries: any[];
}

/**
 * 客户端触发单道 AI 题目的生成（不阻塞调用方）。
 * 生成成功/失败会由服务端更新题目状态，调用方通过轮询获取最新状态。
 *
 * 通过 Route Handler（/api/ai-generate）触发，而非 Server Action：
 * Server Action 会进入 App Router 的 action 队列串行执行，长时间运行的
 * 出题会阻塞同一客户端后续的 Server Action（如读取题目状态），导致页面
 * 一直停留在“加载中”而无法展示进度。Route Handler 不参与该队列。
 */
export async function dispatchQuestionGeneration(item: PendingQuestionItem): Promise<void> {
  const { questionId } = item;

  try {
    const res = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      console.error('[dispatchQuestionGeneration] 生成请求失败:', res.status);
    }
  } catch (error) {
    console.error('AI 出题异常:', error);
    try {
      await markQuestionAsFailed(questionId);
    } catch {
      // ignore
    }
  }
}

/**
 * 从 sessionStorage 中取出指定题目的待生成项，并移除该项。
 */
export function takePendingQuestion(questionId: string): PendingQuestionItem | null {
  const raw = sessionStorage.getItem('pendingQuestions');
  if (!raw) return null;

  let items: PendingQuestionItem[];
  try {
    items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      sessionStorage.removeItem('pendingQuestions');
      return null;
    }
  } catch {
    sessionStorage.removeItem('pendingQuestions');
    return null;
  }

  const index = items.findIndex((it) => it?.questionId === questionId);
  if (index === -1) return null;

  const [found] = items.splice(index, 1);
  if (items.length > 0) {
    sessionStorage.setItem('pendingQuestions', JSON.stringify(items));
  } else {
    sessionStorage.removeItem('pendingQuestions');
  }
  return found;
}

/**
 * 从 sessionStorage 中取出所有待生成项并清空。
 */
export function takeAllPendingQuestions(): PendingQuestionItem[] {
  const raw = sessionStorage.getItem('pendingQuestions');
  if (!raw) return [];

  let items: PendingQuestionItem[];
  try {
    items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      sessionStorage.removeItem('pendingQuestions');
      return [];
    }
  } catch {
    sessionStorage.removeItem('pendingQuestions');
    return [];
  }

  sessionStorage.removeItem('pendingQuestions');
  return items;
}
