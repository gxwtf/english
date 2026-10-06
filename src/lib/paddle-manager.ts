/**
 * PaddleOCR 懒加载进程管理器
 *
 * 目标：默认不在应用启动时拉起 PaddleOCR（避免常驻占用大量内存），
 * 而是在首次发起识别请求时按需启动；闲置超过一定时间后自动退出，
 * 将内存归还给系统。
 *
 * 环境变量：
 * - PADDLEOCR_URL            若显式设置，则视为“外部服务”，不进行本地进程管理
 * - PADDLEOCR_PORT           本地服务端口（默认 39821）
 * - PADDLEOCR_IDLE_MS        闲置多少毫秒后自动退出（默认 300000 = 5 分钟）
 * - PADDLEOCR_MAX_REQUESTS   单进程处理多少请求后主动回收（默认 30，0 禁用）
 * - PADDLEOCR_START_TIMEOUT_MS  模型加载最长等待（默认 120000）
 * - PADDLEOCR_DIR            服务目录（默认 <cwd>/paddleocr-service）
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_PORT = 39821;
const DEFAULT_HOST = '127.0.0.1';

interface ManagerState {
  child: ChildProcess | null;
  starting: Promise<void> | null;
  idleTimer: NodeJS.Timeout | null;
  exitHandlersBound: boolean;
  activeRequests: number;
  requestsServed: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __paddleManager: ManagerState | undefined;
}

function state(): ManagerState {
  if (!globalThis.__paddleManager) {
    globalThis.__paddleManager = {
      child: null,
      starting: null,
      idleTimer: null,
      exitHandlersBound: false,
      activeRequests: 0,
      requestsServed: 0,
    };
  }
  return globalThis.__paddleManager;
}

function port(): number {
  return Number(process.env.PADDLEOCR_PORT || DEFAULT_PORT);
}

export function paddleBaseUrl(): string {
  return process.env.PADDLEOCR_URL || `http://${DEFAULT_HOST}:${port()}`;
}

export function isExternalPaddle(): boolean {
  return Boolean(process.env.PADDLEOCR_URL);
}

/** 诊断信息（供测试/排查使用）。 */
export function getPaddleDiagnostics(): {
  childPid: number | null;
  activeRequests: number;
  requestsServed: number;
} {
  const s = state();
  return {
    childPid: s.child?.pid ?? null,
    activeRequests: s.activeRequests,
    requestsServed: s.requestsServed,
  };
}

function idleMs(): number {
  return Number(process.env.PADDLEOCR_IDLE_MS || 300000);
}

function startTimeoutMs(): number {
  return Number(process.env.PADDLEOCR_START_TIMEOUT_MS || 120000);
}

/**
 * 单个进程最多处理多少请求后主动回收。
 * PaddleOCR/OpenCV 长时间运行会导致 RSS 持续增长，定期重启进程可释放内存。
 * 设为 0 表示禁用。默认 30。
 */
function maxRequests(): number {
  const v = process.env.PADDLEOCR_MAX_REQUESTS;
  return v === undefined ? 30 : Number(v);
}

function paddleDir(): string {
  return process.env.PADDLEOCR_DIR
    ? path.resolve(process.env.PADDLEOCR_DIR)
    : path.resolve(process.cwd(), 'paddleocr-service');
}

function pythonBin(): string {
  const venv = path.join(paddleDir(), 'venv', 'bin', 'python');
  return existsSync(venv) ? venv : 'python3';
}

async function health(): Promise<{ ok: boolean; modelReady: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const resp = await fetch(`${paddleBaseUrl()}/health`, { signal: controller.signal });
    if (!resp.ok) return { ok: false, modelReady: false };
    const data = await resp.json();
    return { ok: data.status === 'ok', modelReady: Boolean(data.model_ready) };
  } catch {
    return { ok: false, modelReady: false };
  } finally {
    clearTimeout(timer);
  }
}

function scheduleIdleKill(): void {
  const s = state();
  if (s.idleTimer) clearTimeout(s.idleTimer);
  if (isExternalPaddle()) return;
  s.idleTimer = setTimeout(() => stopPaddle('idle-timeout'), idleMs());
  s.idleTimer.unref?.();
}

export function stopPaddle(reason: string): void {
  const s = state();
  if (s.idleTimer) {
    clearTimeout(s.idleTimer);
    s.idleTimer = null;
  }
  if (s.child && s.child.exitCode === null && !s.child.killed) {
    console.log(`[paddle] 停止本地 OCR 服务（${reason}），释放内存`);
    try {
      s.child.kill('SIGTERM');
    } catch {
      // 进程可能已退出
    }
  }
  s.child = null;
  s.starting = null;
}

function bindExitHandlers(): void {
  const s = state();
  if (s.exitHandlersBound) return;
  s.exitHandlersBound = true;
  const cleanup = () => stopPaddle('process-exit');
  process.once('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
}

async function waitForModel(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const h = await health();
    if (h.ok && h.modelReady) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`PaddleOCR 模型加载超时（${Math.round(timeoutMs / 1000)}s）`);
}

/** 记录一次即将发往 Paddle 的请求，返回服务地址。 */
function serve(): string {
  const s = state();
  s.activeRequests += 1;
  s.requestsServed += 1;
  return paddleBaseUrl();
}

/**
 * 请求完成后调用。当没有在途请求且该进程已处理超过上限时，主动重启以释放内存。
 */
export function releasePaddle(): void {
  const s = state();
  s.activeRequests = Math.max(0, s.activeRequests - 1);
  const max = maxRequests();
  if (!isExternalPaddle() && max > 0 && s.activeRequests === 0 && s.requestsServed >= max) {
    stopPaddle('max-requests');
  }
}

/**
 * 确保本地 PaddleOCR 服务已就绪（首次调用会启动进程并等待模型加载）。
 * 返回服务地址。
 */
export async function ensurePaddleReady(): Promise<string> {
  const s = state();

  // 外部服务：不管理生命周期，直接使用
  if (isExternalPaddle()) return serve();

  // 已有存活进程
  if (s.child && s.child.exitCode === null && !s.child.killed) {
    const h = await health();
    if (h.ok && h.modelReady) {
      scheduleIdleKill();
      return serve();
    }
    if (h.ok) {
      await waitForModel(startTimeoutMs());
      scheduleIdleKill();
      return serve();
    }
    stopPaddle('unhealthy');
  }

  // 正在启动中，等待同一 Promise
  if (s.starting) {
    await s.starting;
    scheduleIdleKill();
    return serve();
  }

  const dir = paddleDir();
  if (!existsSync(path.join(dir, 'server.py'))) {
    throw new Error(`PaddleOCR 服务目录不存在: ${dir}`);
  }

  s.starting = (async () => {
    bindExitHandlers();
    const bin = pythonBin();
    console.log(`[paddle] 首次使用，按需启动本地 OCR 服务（${bin} server.py）...`);
    s.requestsServed = 0;
    const child = spawn(bin, ['server.py'], {
      cwd: dir,
      env: { ...process.env, PADDLEOCR_PORT: String(port()), PADDLEOCR_HOST: DEFAULT_HOST },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    s.child = child;

    child.stdout?.on('data', (d) => process.stdout.write(`[paddle] ${d}`));
    child.stderr?.on('data', (d) => process.stderr.write(`[paddle] ${d}`));

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve());
      child.once('error', (err) => reject(err));
    });

    child.on('exit', (code) => {
      console.log(`[paddle] 服务进程退出，code=${code}`);
      const cur = state();
      if (cur.child === child) {
        cur.child = null;
        cur.starting = null;
      }
    });

    await waitForModel(startTimeoutMs());
    console.log('[paddle] 模型就绪');
  })();

  try {
    await s.starting;
  } catch (e) {
    stopPaddle('start-failed');
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    s.starting = null;
  }

  scheduleIdleKill();
  return serve();
}
