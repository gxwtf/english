#!/usr/bin/env python3
"""检查 01.jpg 是否整页都是黄色背景"""
import cv2
import numpy as np

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
img = cv2.imread(img_path)
h, w = img.shape[:2]
print(f'Image: {w}x{h}')

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
h_ch, s_ch, v_ch = cv2.split(hsv)

# 黄色 mask (HSV)
yellow_mask = cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255]))
yellow_ratio = cv2.countNonZero(yellow_mask) / yellow_mask.size
print(f'整图黄色像素比例: {yellow_ratio:.3f}')

# 把图片分成 10x10 的网格，看每个网格的黄色比例
print(f'\n=== 10x10 网格黄色比例 ===')
for gy in range(10):
    row = []
    for gx in range(10):
        y0 = gy * h // 10
        y1 = (gy + 1) * h // 10
        x0 = gx * w // 10
        x1 = (gx + 1) * w // 10
        region = yellow_mask[y0:y1, x0:x1]
        ratio = cv2.countNonZero(region) / region.size
        row.append(f'{ratio:.2f}')
    print(f'  y={gy}: {" ".join(row)}')

# 检查纸张颜色：四个角落和中心
print(f'\n=== 各位置 BGR 平均值 ===')
positions = {
    'top-left': (0, 0),
    'top-right': (w-100, 0),
    'center': (w//2-50, h//2-50),
    'bottom-left': (0, h-100),
    'bottom-right': (w-100, h-100),
}
for name, (x, y) in positions.items():
    region = img[y:y+100, x:x+100]
    mean_bgr = region.reshape(-1, 3).mean(axis=0).astype(int)
    mean_hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(axis=0).astype(int)
    print(f'  {name:15} BGR={mean_bgr} HSV={mean_hsv}')

# 检查文本行的背景颜色
# 取 OCR 词 "the" (391-417, 706-746) 的背景（去掉文字像素）
# 简单地取词周围上下 5px 的背景
print(f'\n=== 文本行背景颜色 (y=700, x=400-500) ===')
bg_region = img[700:715, 400:500]
mean_bgr = bg_region.reshape(-1, 3).mean(axis=0).astype(int)
print(f'  BGR={mean_bgr}')
hsv_bg = cv2.cvtColor(bg_region, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(axis=0).astype(int)
print(f'  HSV={hsv_bg}')

# 看一下 divine 词 (541-600, 706-746) 与普通文本行背景 (391-417, 706-746) 的颜色差异
print(f'\n=== divine vs 普通文本词 颜色对比 ===')
divine_region = img[706:746, 541:600]
mean_bgr_divine = divine_region.reshape(-1, 3).mean(axis=0).astype(int)
hsv_divine = cv2.cvtColor(divine_region, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(axis=0).astype(int)
print(f'  divine: BGR={mean_bgr_divine} HSV={hsv_divine}')

normal_region = img[706:746, 391:417]
mean_bgr_normal = normal_region.reshape(-1, 3).mean(axis=0).astype(int)
hsv_normal = cv2.cvtColor(normal_region, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(axis=0).astype(int)
print(f'  normal: BGR={mean_bgr_normal} HSV={hsv_normal}')

# 检查 highlight mask 中的大块组件
print(f'\n=== 原图 mask 的大块组件 (面积 > 5000) ===')
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

n, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 5000:
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area}')

# 保存一张可视化图，标注所有大块黄色区域
viz = img.copy()
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 5000:
        cv2.rectangle(viz, (x, y), (x+w, y+h), (0, 0, 255), 5)
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_01_yellow_areas.jpg', viz)
print(f'\n可视化保存到: temp/debug_01_yellow_areas.jpg')
