#!/usr/bin/env python3
"""可视化 01.jpg 的高亮 mask，确认高亮位置"""
import base64
import cv2
import numpy as np
import requests

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
img = cv2.imread(img_path)
print(f'Image shape: {img.shape}')

# 模拟 server 的处理流程
# 1. 提取高亮 mask
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
masks = []
# 黄色
masks.append(cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255])))
# 绿色
masks.append(cv2.inRange(hsv, np.array([35, 40, 120]), np.array([85, 255, 255])))
# 粉色/紫色
masks.append(cv2.inRange(hsv, np.array([140, 30, 120]), np.array([180, 255, 255])))
# 橙色
masks.append(cv2.inRange(hsv, np.array([5, 40, 120]), np.array([20, 255, 255])))
mask = masks[0]
for m in masks[1:]:
    mask = cv2.bitwise_or(mask, m)
kernel = np.ones((3, 3), np.uint8)
mask = cv2.dilate(mask, kernel, iterations=1)

# 找到高亮区域的轮廓
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print(f'\n高亮区域数: {len(contours)}')

# 标记每个高亮区域的中心和大小
for i, c in enumerate(contours):
    x, y, w, h = cv2.boundingRect(c)
    area = cv2.contourArea(c)
    if area > 50:  # 过滤小噪点
        print(f'  {i}: bbox=({x},{y},{w}x{h}) area={area:.0f}')

# 在原图上画框，可视化
viz = img.copy()
cv2.drawContours(viz, contours, -1, (0, 0, 255), 3)

# 输出原图和 mask 的可视化
out_path = '/home/kevin/kevin/git/gxwtf_english/temp/debug_01_viz.jpg'
cv2.imwrite(out_path, viz)
print(f'\n可视化保存到: {out_path}')

# 单独保存 mask
mask_path = '/home/kevin/kevin/git/gxwtf_english/temp/debug_01_mask.jpg'
cv2.imwrite(mask_path, mask)
print(f'Mask 保存到: {mask_path}')

# 列出 mask 中所有连通组件
n_components, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
print(f'\n连通组件数 (含背景): {n_components}')
for i in range(1, n_components):
    x, y, w, h, area = stats[i]
    if area > 100:
        cx, cy = centroids[i]
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area} center=({cx:.0f},{cy:.0f})')
