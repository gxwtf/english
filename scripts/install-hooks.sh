#!/usr/bin/env bash
# 安装 git pre-commit hook，阻止硬编码数据库密码被提交
set -e

HOOK_SOURCE="$(cd "$(dirname "$0")/.." && pwd)/.githooks/pre-commit"
HOOK_TARGET="$(cd "$(dirname "$0")/.." && pwd)/.git/hooks/pre-commit"

if [ -f "$HOOK_TARGET" ]; then
  echo "⚠️  pre-commit hook 已存在，将覆盖"
fi

cp "$HOOK_SOURCE" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"
echo "✅ pre-commit hook 已安装到 $HOOK_TARGET"
