#!/usr/bin/env node
/**
 * 同时启动 PaddleOCR 服务和 Next.js（dev 或 start）。
 * 任一进程退出或收到 Ctrl+C 时，两个进程一起终止。
 *
 * 用法：
 *   node scripts/dev.mjs dev    → next dev（开发模式）
 *   node scripts/dev.mjs start  → next start（生产模式）
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'dev';
const children = [];

function start(cmd, args, opts, prefix) {
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    ...opts,
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${prefix}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${prefix}] ${d}`));
  child.on('exit', (code) => {
    console.log(`[${prefix}] exited with code ${code}`);
    killAll();
    process.exit(code ?? 1);
  });
  children.push(child);
}

function killAll() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      // 子进程可能已退出
    }
  }
}

// 等待 PaddleOCR 健康检查通过且模型就绪（最长等待 180 秒，首次需要下载模型）
async function waitForPaddleOCR(maxWaitMs = 180000) {
  const healthUrl = 'http://127.0.0.1:39821/health';
  const start = Date.now();
  let serviceReady = false;
  process.stdout.write('[ocr] 等待 PaddleOCR 健康检查');
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(healthUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'ok') {
          if (!serviceReady) {
            serviceReady = true;
            process.stdout.write(' 服务已启动');
          }
          if (data.model_ready) {
            process.stdout.write('，模型就绪 ✓\n');
            return true;
          }
        }
      }
    } catch (e) {
      // 服务还未就绪
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  process.stdout.write(` 超时${serviceReady ? '（模型未就绪，继续启动）' : '（服务未启动）'}\n`);
  return false;
}

// 1. 先启动 PaddleOCR（模型加载较慢，先启动）
const paddleDir = resolve(root, 'paddleocr-service');
if (existsSync(paddleDir)) {
  start('python3', ['server.py'], { cwd: paddleDir }, 'ocr');
}

// 2. 等待 PaddleOCR 健康检查通过后再启动 Next.js
await waitForPaddleOCR();

// 3. 启动 Next.js（直接用 node 调用 next CLI，避免 shell 依赖）
const nextBin = resolve(root, 'node_modules/next/dist/bin/next');
const nextArgs = mode === 'start' ? ['start', '-p', '3003'] : ['dev', '-p', '3003'];
start('node', [nextBin, ...nextArgs], { cwd: root }, 'web');

// 4. Ctrl+C / 终止信号 → 杀死所有子进程
process.on('SIGINT', () => {
  killAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  killAll();
  process.exit(0);
});
