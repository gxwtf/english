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
#
# 注意：必须使用 --copies。默认的 venv 会把 bin/python3 做成指向系统 Python
# （如 /usr/bin/python3）的符号链接，而该目标是项目根目录之外的路径。Next.js
# 的 Turbopack 在构建期追踪 paddleocr-service 目录时会跟随该链接并直接 panic：
#   Symlink .../venv/bin/python is invalid, it points out of the filesystem root
# 使用 --copies 会把解释器复制进 venv，避免任何指向项目根之外的符号链接。
if [ ! -d "$VENV_DIR" ]; then
    echo "[1/3] 创建虚拟环境 venv/（--copies）..."
    python3 -m venv --copies "$VENV_DIR"
else
    echo "[1/3] 虚拟环境已存在，跳过创建"
fi

# 修复已有 venv：把解析到 venv 之外（项目根之外）的符号链接替换为实体副本。
# 这样无需重新安装依赖，就能让旧环境兼容 Turbopack 构建。
repair_venv_symlinks() {
    find "$VENV_DIR" -type l | while read -r link; do
        target="$(readlink -f "$link" 2>/dev/null || true)"
        if [ -n "$target" ] && [ -e "$target" ] && [ "${target#"$VENV_DIR"/}" = "$target" ]; then
            cp -L "$target" "$link.tmp" && mv -f "$link.tmp" "$link"
            echo "  修复符号链接: ${link#"$VENV_DIR"/} -> 实体副本"
        fi
    done
}
echo "[1/3] 检查 venv 中指向项目根之外的符号链接 ..."
repair_venv_symlinks

# 升级 pip + 安装 setuptools/wheel（Python 3.12+ venv 默认不含）
echo "[2/3] 升级 pip + 安装 setuptools/wheel ..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip setuptools wheel --quiet

# 安装依赖
echo "[3/3] 安装依赖（paddlepaddle + paddleocr + opencv + flask）..."
echo "      首次安装可能需要 5-10 分钟（paddlepaddle ~200MB）"
"$VENV_DIR/bin/pip" install -r requirements.txt

# 安装完成后再次检查，防止依赖在 site-packages 中引入指向项目根之外的符号链接
echo "[3/3] 复查符号链接 ..."
repair_venv_symlinks

echo ""
echo "✓ 安装完成！"
echo "  虚拟环境：$VENV_DIR"
echo "  启动服务：cd .. && pnpm start  （dev.mjs 会自动使用 venv/bin/python）"
echo "  手动启动：$VENV_DIR/bin/python server.py"
