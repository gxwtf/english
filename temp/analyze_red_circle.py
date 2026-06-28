#!/usr/bin/env python3
"""分析 red-circle-2.jpg 的图片内容和颜色"""
import cv2
import numpy as np

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/red-circle-2.jpg'
img = cv2.imread(img_path)
print(f'Image shape: {img.shape}')

# 检查红色像素
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# 红色在 HSV 中有两个范围
red_mask1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 255]))
red_mask2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 255]))
red_mask = cv2.bitwise_or(red_mask1, red_mask2)
red_ratio = cv2.countNonZero(red_mask) / red_mask.size
print(f'红色像素比例: {red_ratio:.3f}')

# 检查黑色像素
black_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 50, 80]))
black_ratio = cv2.countNonZero(black_mask) / black_mask.size
print(f'黑色像素比例: {black_ratio:.3f}')

# 找红色区域
n, _, stats, _ = cv2.connectedComponentsWithStats(red_mask, connectivity=8)
print(f'\n=== 红色区域 (面积 > 100) ===')
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 100:
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area}')

# 调用 OCR
import base64
import requests
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('ascii')
resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=120)
data = resp.json()

print(f'\n=== OCR 结果 ===')
print(f'totalWords={data["stats"]["totalWords"]} highlightedCount={data["stats"]["highlightedCount"]}')
for i, w in enumerate(data.get('words', [])):
    bbox = w.get('bbox')
    print(f'  {i:2d} text={w.get("text")!r:20} bbox={bbox} ratio={w.get("highlightRatio")}')

# 看红色区域与 OCR 词的重叠
print(f'\n=== 红色区域与 OCR 词的重叠 ===')
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 100:
        rx0, ry0, rx1, ry1 = x, y, x+w, y+h
        for j, word in enumerate(data.get('words', [])):
            wbbox = word['bbox']
            wx0, wy0, wx1, wy1 = wbbox['x0'], wbbox['y0'], wbbox['x1'], wbbox['y1']
            # 计算重叠
            ix0 = max(rx0, wx0)
            iy0 = max(ry0, wy0)
            ix1 = min(rx1, wx1)
            iy1 = min(ry1, wy1)
            if ix0 < ix1 and iy0 < iy1:
                overlap = (ix1 - ix0) * (iy1 - iy0)
                word_area = (wx1 - wx0) * (wy1 - wy0)
                overlap_ratio = overlap / word_area if word_area > 0 else 0
                if overlap_ratio > 0.1:
                    print(f'  红色区域({rx0},{ry0},{rx1},{ry1}) 与词 {word["text"]!r}({wx0},{wy0},{wx1},{wy1}) 重叠 {overlap_ratio:.2f}')

# 保存可视化
viz = img.copy()
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 100:
        cv2.rectangle(viz, (x, y), (x+w, y+h), (0, 255, 0), 2)
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_red_circle_viz.jpg', viz)
print(f'\n可视化保存到: temp/debug_red_circle_viz.jpg')
