#!/bin/bash
# 拍照识词 OCR 本地微服务启动脚本（OpenCV 预处理 + Unlimited-OCR-2）
# 用法: ./start.sh [port]
# 环境变量: UNLIMITED_OCR_URL（默认 http://127.0.0.1:8014）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${OCR_SERVICE_PORT:-${PADDLEOCR_PORT:-${1:-39821}}}"
HOST="${OCR_SERVICE_HOST:-${PADDLEOCR_HOST:-0.0.0.0}}"

echo "Starting OCR service on ${HOST}:${PORT} (backend ${UNLIMITED_OCR_URL:-http://127.0.0.1:8014})..."
exec python3 server.py
