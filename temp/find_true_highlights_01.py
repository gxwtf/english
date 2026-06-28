#!/usr/bin/env python3
"""找出 01.jpg 中所有真正的高亮词"""
import sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')
import cv2
import numpy as np
import server

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
with open(img_path, 'rb') as f:
    img_bytes = f.read()
nparr = np.frombuffer(img_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

MAX_DIM = 2000
h, w = img.shape[:2]
if max(h, w) > MAX_DIM:
    scale = MAX_DIM / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

# 用原图（不增强）的 HSV mask 检测每个词的高亮
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
masks = []
masks.append(cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255])))
masks.append(cv2.inRange(hsv, np.array([35, 40, 120]), np.array([85, 255, 255])))
masks.append(cv2.inRange(hsv, np.array([140, 30, 120]), np.array([180, 255, 255])))
masks.append(cv2.inRange(hsv, np.array([5, 40, 120]), np.array([20, 255, 255])))
mask = masks[0]
for m in masks[1:]:
    mask = cv2.bitwise_or(mask, m)
kernel = np.ones((3, 3), np.uint8)
mask = cv2.dilate(mask, kernel, iterations=1)

# 获取 OCR 结果
engine = server.get_ocr()
clean_img = server.remove_highlights_for_ocr(img)
clean_result = engine.ocr(clean_img, cls=True)
clean_lines = server.parse_ocr_result(clean_result)

print(f'OCR 行数: {len(clean_lines)}')
print(f'\n=== 每行的真实高亮词 (ratio > 0.3) ===')

# 用原图 mask 检测每个词的高亮
all_true_highlights = []
for line in clean_lines:
    line_text = line['text']
    line_bbox = line['bbox']
    # 检查整个 line bbox 的 mask
    x0, y0, x1, y1 = line_bbox['x0'], line_bbox['y0'], line_bbox['x1'], line_bbox['y1']
    line_region = mask[y0:y1, x0:x1]
    line_ratio = cv2.countNonZero(line_region) / line_region.size if line_region.size > 0 else 0
    if line_ratio > 0.05:
        # 这一行有高亮，拆分单词检查
        tokens = server.split_stuck_words(line_text).split()
        if not tokens:
            continue
        # 等比分配 bbox
        bbox_width = x1 - x0
        total_chars = sum(len(t) for t in tokens) + len(tokens) - 1
        current_x = x0
        for token in tokens:
            char_count = len(token) + 1
            part_width = int(bbox_width * char_count / total_chars)
            word_bbox = (current_x, y0, current_x + part_width, y1)
            word_region = mask[y0:y1, current_x:current_x+part_width]
            word_ratio = cv2.countNonZero(word_region) / word_region.size if word_region.size > 0 else 0
            if word_ratio > 0.3:
                print(f'  {token!r:25} ratio={word_ratio:.3f} bbox={word_bbox}')
                all_true_highlights.append(token)
            current_x += part_width

print(f'\n=== 真实高亮词总数: {len(all_true_highlights)} ===')
print(f'真实高亮词: {all_true_highlights}')
