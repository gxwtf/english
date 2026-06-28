#!/usr/bin/env bash
# 一键创建 Python 虚拟环境并安装 PaddleOCR 服务依赖
# 用法：cd paddleocr-service && ./setup.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="$SCRIPT_DIR/venv"

# 检查 python3
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] 未找到 python3，请先安装：sudo apt install python3 python3-venv python3-full"
    exit 1
fi

# 检查 python3-venv
if ! python3 -m venv --help &> /dev/null; then
    echo "[ERROR] python3-venv 未安装，请运行：sudo apt install python3-venv python3-full"
    exit 1
fi

# 创建虚拟环境
if [ ! -d "$VENV_DIR" ]; then
    echo "[1/3] 创建虚拟环境 venv/ ..."
    python3 -m venv "$VENV_DIR"
else
    echo "[1/3] 虚拟环境已存在，跳过创建"
fi

# 升级 pip
echo "[2/3] 升级 pip ..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip --quiet

# 安装依赖
echo "[3/3] 安装依赖（paddlepaddle + paddleocr + opencv + flask）..."
echo "      首次安装可能需要 5-10 分钟（paddlepaddle ~200MB）"
"$VENV_DIR/bin/pip" install -r requirements.txt

echo ""
echo "✓ 安装完成！"
echo "  虚拟环境：$VENV_DIR"
echo "  启动服务：cd .. && npm start  （dev.mjs 会自动使用 venv/bin/python）"
echo "  手动启动：$VENV_DIR/bin/python server.py"
