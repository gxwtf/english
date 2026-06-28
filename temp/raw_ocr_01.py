#!/usr/bin/env python3
"""直接用 PaddleOCR 原始 API 对 01.jpg 做 OCR，查看所有文本行"""
import os, sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')

# 设置环境变量
os.environ['GLOG_logtostderr'] = '1'
os.environ['GLOG_minloglevel'] = '3'
os.environ['GLOG_max_log_size'] = '1'
os.environ['GLOG_stop_logging_if_full_disk'] = '1'
os.environ['FLAGS_logtostderr'] = 'true'
os.environ['FLAGS_call_stack_level'] = '0'

import cv2
from paddleocr import PaddleOCR

# 初始化
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False, use_gpu=False)

# 读取图片
img = cv2.imread('temp/tests/01.jpg')
h, w = img.shape[:2]
print(f"图片尺寸: {w}x{h}")

# 直接 OCR（原图，不预处理）
result = ocr.ocr(img, cls=True)

# 打印所有文本行
print(f"\n=== PaddleOCR 原始结果（共 {len(result[0])} 行） ===")
for i, line in enumerate(result[0]):
    bbox, (text, conf) = line
    # bbox 是 4 个点的坐标
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    print(f"  行 {i:3d}: '{text}'  conf={conf:.3f}  bbox=({x0:.0f},{y0:.0f})-({x1:.0f},{y1:.0f})")

# 搜索 divorce
print("\n=== 搜索 divorce ===")
for i, line in enumerate(result[0]):
    text = line[1][0]
    if 'divorce' in text.lower() or 'divorc' in text.lower():
        print(f"  找到! 行 {i}: '{text}'")

# 搜索所有包含 div 的行
print("\n=== 包含 'div' 的行 ===")
for i, line in enumerate(result[0]):
    text = line[1][0]
    if 'div' in text.lower():
        print(f"  行 {i}: '{text}'")
