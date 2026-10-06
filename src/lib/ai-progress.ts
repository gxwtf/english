/**
 * 服务端内存中的 AI 进度存储。
 *
 * 出题 / 批改等 Server Action 在关键节点写入进度，客户端通过
 * `getAIProgressAction` 轮询读取，从而在等待期间展示实时进度。
 *
 * 说明：进度仅用于 UI 展示，属于“尽力而为”的临时数据，
 * 因此存储在进程内存中，无需落库；超时条目会自动清理。
 */

export interface AIProgress {
  /** 0-100 的进度百分比 */
  percent: number;
  /** 当前阶段的人类可读描述 */
  stage: string;
  /** 当前处理到第几项（批改逐题时使用） */
  current?: number;
  /** 总项数（批改逐题时使用） */
  total?: number;
  /** 开始时间戳（毫秒） */
  startedAt: number;
  /** 最后更新时间戳（毫秒） */
  updatedAt: number;
  /** 是否已完成 */
  done: boolean;
}

const MAX_AGE_MS = 30 * 60 * 1000;

function getStore(): Map<string, AIProgress> {
  const g = globalThis as unknown as { __gxAIProgressStore?: Map<string, AIProgress> };
  if (!g.__gxAIProgressStore) {
    g.__gxAIProgressStore = new Map<string, AIProgress>();
  }
  return g.__gxAIProgressStore;
}

function prune(): void {
  const store = getStore();
  const now = Date.now();
  for (const [key, value] of store) {
    if (now - value.updatedAt > MAX_AGE_MS) store.delete(key);
  }
}

/**
 * 开始（或重启）一个进度条目。
 */
export function startAIProgress(key: string, stage = '正在准备...', percent = 2): void {
  const now = Date.now();
  getStore().set(key, {
    percent,
    stage,
    startedAt: now,
    updatedAt: now,
    done: false,
  });
}

/**
 * 更新进度。未提供的字段沿用上一次的值。
 */
export function setAIProgress(
  key: string,
  patch: Partial<Omit<AIProgress, 'startedAt' | 'updatedAt'>>,
): void {
  const store = getStore();
  const prev = store.get(key);
  const now = Date.now();
  store.set(key, {
    percent: patch.percent ?? prev?.percent ?? 0,
    stage: patch.stage ?? prev?.stage ?? '',
    current: patch.current ?? prev?.current,
    total: patch.total ?? prev?.total,
    startedAt: prev?.startedAt ?? now,
    updatedAt: now,
    done: patch.done ?? prev?.done ?? false,
  });
}

/**
 * 读取进度。不存在或已过期时返回 null。
 */
export function getAIProgress(key: string): AIProgress | null {
  prune();
  return getStore().get(key) ?? null;
}

/**
 * 删除进度条目。
 */
export function clearAIProgress(key: string): void {
  getStore().delete(key);
}

/**
 * 在长时间 AI 调用期间，基于经过时间平滑推进进度。
 *
 * Server Action 中的 AI 调用是原子的，无法在中途上报，因此从一个起始百分比
 * 出发，用缓出曲线向目标百分比逼近并更新阶段文案（含已等待秒数），让进度更
 * 贴近真实等待时长，避免长时间卡死。返回停止函数，应在调用结束时执行。
 */
export function startProgressHeartbeat(
  key: string,
  template: {
    fromPercent: number;
    toPercent: number;
    durationMs: number;
    stage: (elapsedMs: number) => string;
  },
): () => void {
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const entry = getAIProgress(key);
    if (!entry || entry.done) {
      clearInterval(timer);
      return;
    }
    const elapsed = Date.now() - startedAt;
    const t = Math.min(1, elapsed / template.durationMs);
    const eased = 1 - Math.pow(1 - t, 2);
    const percent = Math.min(
      template.toPercent,
      template.fromPercent + (template.toPercent - template.fromPercent) * eased,
    );
    if (percent > entry.percent) {
      setAIProgress(key, { percent, stage: template.stage(elapsed) });
    }
  }, 2000);
  return () => clearInterval(timer);
}
