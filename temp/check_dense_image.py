#!/usr/bin/env python3
"""检查 yellow-highlight-dense.jpg 的图片尺寸和 OCR 范围"""
import cv2
import base64
import json
import requests

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/yellow-highlight-dense.jpg'
img = cv2.imread(img_path)
print(f'Image shape: {img.shape}')

# 调用 OCR
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('ascii')
resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=120)
data = resp.json()

# 打印所有词的 bbox
print(f'\ntotalWords={data["stats"]["totalWords"]}')
print('\n=== 所有词的 bbox ===')
for i, w in enumerate(data.get('words', [])):
    bbox = w.get('bbox')
    print(f'  {i:2d} text={w.get("text")!r:20} bbox={bbox} ratio={w.get("highlightRatio")}')

# 看图片的 y 范围，判断 OCR 是否覆盖了整张图
y_ranges = [(w['bbox']['y0'], w['bbox']['y1']) for w in data.get('words', [])]
if y_ranges:
    print(f'\nOCR y 范围: {min(y[0] for y in y_ranges)} - {max(y[1] for y in y_ranges)}')
    print(f'Image y 范围: 0 - {img.shape[0]}')

# 用原图 HSV 检测高亮区域
import numpy as np
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

# 找大块高亮区域
n, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
print(f'\n=== 原图高亮区域 (面积 > 500) ===')
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 500:
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area}')

# 保存可视化
viz = img.copy()
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 500:
        cv2.rectangle(viz, (x, y), (x+w, y+h), (0, 0, 255), 3)
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_dense_viz.jpg', viz)
print(f'\n可视化保存到: temp/debug_dense_viz.jpg')
