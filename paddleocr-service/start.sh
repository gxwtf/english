#!/bin/bash
# PaddleOCR 独立服务启动脚本
# 用法: ./start.sh [port]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PADDLEOCR_PORT:-${1:-39821}}"
HOST="${PADDLEOCR_HOST:-0.0.0.0}"

echo "Starting PaddleOCR service on ${HOST}:${PORT}..."
exec python3 server.py
