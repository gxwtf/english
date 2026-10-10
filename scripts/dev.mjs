#!/usr/bin/env node
/**
 * 启动 Next.js（dev 或 start）。
 *
 * 注意：PaddleOCR 采用懒加载策略——不再在应用启动时拉起，
 * 而是在首次拍照识别请求时由 src/lib/paddle-manager.ts 按需启动，
 * 闲置一段时间后自动退出以释放内存。
 *
 * 用法：
 *   node scripts/dev.mjs dev    → next dev（开发模式）
 *   node scripts/dev.mjs start  → next start（生产模式）
 *   可选 -p <port> 指定端口（默认 3003），例如：
 *   pnpm run dev -p 3005
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'dev';
const portIdx = process.argv.indexOf('-p');
const port =
  portIdx !== -1 && process.argv[portIdx + 1] ? process.argv[portIdx + 1] : '3003';
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

// 启动 Next.js（直接用 node 调用 next CLI，避免 shell 依赖）
const nextBin = resolve(root, 'node_modules/next/dist/bin/next');
const nextArgs = mode === 'start' ? ['start', '-p', port] : ['dev', '-p', port];
start('node', [nextBin, ...nextArgs], { cwd: root }, 'web');

// Ctrl+C / 终止信号 → 杀死所有子进程
process.on('SIGINT', () => {
  killAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  killAll();
  process.exit(0);
});
