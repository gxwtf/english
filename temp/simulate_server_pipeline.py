#!/usr/bin/env python3
"""模拟 server 的完整流程，检查 filter_highlight_mask 的效果"""
import sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')

import cv2
import numpy as np
import base64
import requests

# 加载 server 模块
import server

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
with open(img_path, 'rb') as f:
    img_bytes = f.read()

nparr = np.frombuffer(img_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
print(f'Original image shape: {img.shape}')

MAX_DIM = 2000
h, w = img.shape[:2]
if max(h, w) > MAX_DIM:
    scale = MAX_DIM / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    print(f'Resized: {img.shape}')

# 透视变换
warped_img, M = server.auto_transform(img)
print(f'Warped: {warped_img.shape}')

# 去高亮图
clean_img = server.remove_highlights_for_ocr(warped_img)

# OCR (调用 server 的 engine)
engine = server.get_ocr()
print('Running clean OCR...')
clean_result = engine.ocr(clean_img, cls=True)
clean_lines = server.parse_ocr_result(clean_result)
print(f'Clean lines: {len(clean_lines)}')

print('Running raw OCR...')
raw_result = engine.ocr(warped_img, cls=True)
raw_lines = server.parse_ocr_result(raw_result)
print(f'Raw lines: {len(raw_lines)}')

# 光照归一化
enhanced_img = server.enhance_color_document(warped_img)
highlight_mask = server.extract_highlight_mask(enhanced_img)
print(f'Raw mask non-zero: {cv2.countNonZero(highlight_mask)}')

# 过滤前：列出大块组件
n1, _, stats1, _ = cv2.connectedComponentsWithStats(highlight_mask, connectivity=8)
print(f'\n=== 过滤前: 大块组件 (高度 > 80) ===')
for i in range(1, n1):
    x, y, w, h, area = stats1[i]
    if h > 80:
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area}')

# 计算中位行高
all_heights = [l['bbox']['y1'] - l['bbox']['y0'] for l in clean_lines + raw_lines if l['bbox']['y1'] > l['bbox']['y0']]
all_heights.sort()
median_height = all_heights[len(all_heights) // 2] if all_heights else 0
max_height_threshold = max(median_height * 2.5, 60)
print(f'\nMedian line height: {median_height}, max_height threshold: {max_height_threshold}')

# 过滤后
filtered_mask = server.filter_highlight_mask(highlight_mask, clean_lines + raw_lines)
print(f'\nFiltered mask non-zero: {cv2.countNonZero(filtered_mask)}')

# 检查 4 个词在过滤后的 mask 中的高亮比例
words = {
    'divine': (541, 706, 600, 746),
    'themes': (600, 706, 659, 746),
    'beams': (491, 1088, 543, 1130),
    'prism': (724, 1088, 776, 1130),
}
print(f'\n=== 过滤后, 每个词 bbox 内的高亮像素 ===')
for name, (x0, y0, x1, y1) in words.items():
    region = filtered_mask[y0:y1, x0:x1]
    total = region.size
    highlighted = cv2.countNonZero(region)
    ratio = highlighted / total if total > 0 else 0
    print(f'  {name}: {highlighted}/{total} = {ratio:.3f}')

# 保存过滤后的 mask
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_01_filtered_mask.jpg', filtered_mask)
print(f'\nFiltered mask saved to: temp/debug_01_filtered_mask.jpg')

# 还要列出过滤后的大块组件
n2, _, stats2, _ = cv2.connectedComponentsWithStats(filtered_mask, connectivity=8)
print(f'\n=== 过滤后: 仍存在的大块组件 (高度 > 80) ===')
for i in range(1, n2):
    x, y, w, h, area = stats2[i]
    if h > 80:
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area}')
