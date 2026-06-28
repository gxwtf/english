#!/usr/bin/env node
/**
 * 同时启动 PaddleOCR 服务和 Next.js dev server。
 * 任一进程退出或收到 Ctrl+C 时，两个进程一起终止。
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const children = [];

function start(cmd, args, opts, prefix) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true, ...opts });
  child.stdout.on('data', (d) => process.stdout.write(`[${prefix}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${prefix}] ${d}`));
  child.on('