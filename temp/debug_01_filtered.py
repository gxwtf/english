#!/usr/bin/env python3
"""调试 01.jpg - 检查过滤后的 mask 状态"""
import base64
import json
import requests
import cv2
import numpy as np
from pathlib import Path
import sys

ROOT = Path('/home/kevin/kevin/git/gxwtf_english')
sys.path.insert(0, str(ROOT / 'paddleocr-service'))

# 导入 server.py 中的函数
from server import (
    order_points, four_point_transform, find_document_contour, auto_transform,
    enhance_color_document, extract_highlight_mask, filter_highlight_mask,
    check_word_highlighted, parse_ocr_result, get_ocr
)

IMG_PATH = ROOT / 'temp/tests/01.jpg'
OUT_DIR = ROOT / 'temp/debug_out'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. 加载图片
img = cv2.imread(str(IMG_PATH))
h, w = img.shape[:2]
MAX_DIM = 2000
if max(h, w) > MAX_DIM:
    scale = MAX_DIM / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
print(f'Image size: {img.shape[1]}x{img.shape[0]}')

# 2. 透视变换
warped_img, _ = auto_transform(img)

# 3. 双 OCR
engine = get_ocr()
print('Running OCR on clean image...')
clean_img = cv2.cvtColor(warped_img, cv2.COLOR_BGR2HSV)
clean_img = warped_img.copy()
# 模拟 remove_highlights_for_ocr
hsv = cv2.cvtColor(warped_img, cv2.COLOR_BGR2HSV)
h, s, v = cv2.split(hsv)
highlight_mask_tmp = (s > 40) & (v > 120)
clean_img = warped_img.copy()
clean_img[highlight_mask_tmp] = [255, 255, 255]

clean_result = engine.ocr(clean_img, cls=True)
clean_lines = parse_ocr_result(clean_result)
print(f'Clean lines: {len(clean_lines)}')

print('Running OCR on raw image...')
raw_result = engine.ocr(warped_img, cls=True)
raw_lines = parse_ocr_result(raw_result)
print(f'Raw lines: {len(raw_lines)}')

# 4. 生成高亮 mask
enhanced_img = enhance_color_document(warped_img)
original_mask = extract_highlight_mask(enhanced_img)

# 5. 过滤 mask
all_ocr_lines = clean_lines + raw_lines
filtered_mask = filter_highlight_mask(original_mask, all_ocr_lines)

# 6. 比较过滤前后
print(f'\n原始 mask 像素数: {cv2.countNonZero(original_mask)}')
print(f'过滤后 mask 像素数: {cv2.countNonZero(filtered_mask)}')

# 7. 分析过滤前后的连通组件
print('\n=== 原始 mask 连通组件 (Top 15) ===')
num_labels_orig, labels_orig, stats_orig, centroids_orig = cv2.connectedComponentsWithStats(original_mask, connectivity=8)
comps_orig = []
for i in range(1, num_labels_orig):
    x, y, ww, hh, area = stats_orig[i]
    comps_orig.append((i, x, y, ww, hh, area, centroids_orig[i]))
comps_orig.sort(key=lambda c: -c[5])
for i, (lid, x, y, ww, hh, area, centroid) in enumerate(comps_orig[:15]):
    print(f'  区域{lid}: 位置=({x},{y}) 尺寸={ww}x{hh} 面积={area} 中心=({centroid[0]:.0f},{centroid[1]:.0f})')

print('\n=== 过滤后 mask 连通组件 (Top 15) ===')
num_labels_filt, labels_filt, stats_filt, centroids_filt = cv2.connectedComponentsWithStats(filtered_mask, connectivity=8)
comps_filt = []
for i in range(1, num_labels_filt):
    x, y, ww, hh, area = stats_filt[i]
    comps_filt.append((i, x, y, ww, hh, area, centroids_filt[i]))
comps_filt.sort(key=lambda c: -c[5])
for i, (lid, x, y, ww, hh, area, centroid) in enumerate(comps_filt[:15]):
    print(f'  区域{lid}: 位置=({x},{y}) 尺寸={ww}x{hh} 面积={area} 中心=({centroid[0]:.0f},{centroid[1]:.0f})')

# 8. 计算行高阈值
heights = [l['bbox']['y1'] - l['bbox']['y0'] for l in all_ocr_lines if l['bbox']['y1'] > l['bbox']['y0']]
heights.sort()
median_height = heights[len(heights) // 2]
max_height_threshold = max(median_height * 2.5, 60)
print(f'\n行高统计: 中位数={median_height}, 阈值={max_height_threshold:.1f}')
print(f'OCR 行数: {len(all_ocr_lines)}')

# 9. 检查 "probably" 单词的位置
print('\n=== 检查 probably 单词 ===')
# probably 的 bbox: {'x0': 639, 'x1': 740, 'y0': 1652, 'y1': 1694}
prob_bbox = {'x0': 639, 'y0': 1652, 'x1': 740, 'y1': 1694}
is_hl_orig, ratio_orig = check_word_highlighted(original_mask, prob_bbox)
is_hl_filt, ratio_filt = check_word_highlighted(filtered_mask, prob_bbox)
print(f'  probably bbox: {prob_bbox}')
print(f'  原始 mask: is_hl={is_hl_orig}, ratio={ratio_orig}')
print(f'  过滤 mask: is_hl={is_hl_filt}, ratio={ratio_filt}')

# 检查 probably 区域内有哪些组件
print('  过滤后 mask 中 probably 区域内的组件:')
for i, (lid, x, y, ww, hh, area, centroid) in enumerate(comps_filt):
    # 检查组件是否与 probably bbox 重叠
    if x < prob_bbox['x1'] and x + ww > prob_bbox['x0'] and y < prob_bbox['y1'] and y + hh > prob_bbox['y0']:
        print(f'    区域{lid}: 位置=({x},{y}) 尺寸={ww}x{hh} 面积={area} 中心=({centroid[0]:.0f},{centroid[1]:.0f})')

# 10. 保存可视化
# 过滤后的 mask 叠加
overlay = warped_img.copy()
overlay[filtered_mask > 0] = (0, 0, 255)
blended = cv2.addWeighted(warped_img, 0.6, overlay, 0.4, 0)
cv2.imwrite(str(OUT_DIR / '01_filtered_overlay.jpg'), blended, [cv2.IMWRITE_JPEG_QUALITY, 85])

# 过滤后 mask 的 bbox
bbox_img = warped_img.copy()
# 重新调用 OCR 服务获取 words
with open(IMG_PATH, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
r = requests.post('http://127.0.0.1:39821/', json={'image': img_b64}, timeout=180)
data = r.json()
for w in data.get('words', []):
    bbox = w['bbox']
    is_hl = w.get('isHighlighted', False)
    color = (0, 0, 255) if is_hl else (0, 255, 0)
    cv2.rectangle(bbox_img, (bbox['x0'], bbox['y0']), (bbox['x1'], bbox['y1']), color, 2)
    if is_hl:
        label = f"{w['text']}({w.get('highlightRatio', 0):.2f})"
        cv2.putText(bbox_img, label, (bbox['x0'], max(bbox['y0'] - 5, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
cv2.imwrite(str(OUT_DIR / '01_filtered_bboxes.jpg'), bbox_img, [cv2.IMWRITE_JPEG_QUALITY, 85])

print(f'\n可视化保存到: {OUT_DIR}/01_filtered_overlay.jpg 和 01_filtered_bboxes.jpg')
