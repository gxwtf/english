#!/usr/bin/env python3
"""检查 01.jpg 中 4 个被识别为高亮的词的真实高亮情况"""
import cv2
import numpy as np

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
img = cv2.imread(img_path)

# 4 个词的 bbox
words = {
    'divine': (541, 706, 600, 746),
    'themes': (600, 706, 659, 746),
    'beams': (491, 1088, 543, 1130),
    'prism': (724, 1088, 776, 1130),
}

# 扩展 bbox 一定区域，检查周围是否有高亮
def check_region(name, x0, y0, x1, y1):
    # 扩展 50px
    ex0 = max(0, x0 - 50)
    ey0 = max(0, y0 - 50)
    ex1 = min(img.shape[1], x1 + 50)
    ey1 = min(img.shape[0], y1 + 50)
    region = img[ey0:ey1, ex0:ex1]
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)

    # 提取高亮 mask
    masks = []
    masks.append(cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([35, 40, 120]), np.array([85, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([140, 30, 120]), np.array([180, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([5, 40, 120]), np.array([20, 255, 255])))
    mask = masks[0]
    for m in masks[1:]:
        mask = cv2.bitwise_or(mask, m)

    # 在扩展区域内，找出高亮区域
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    print(f'\n=== {name} bbox=({x0},{y0},{x1},{y1}) 扩展区域=({ex0},{ey0},{ex1},{ey1}) ===')
    print(f'组件数: {n}')
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area > 30:
            # 转回原图坐标
            abs_x = ex0 + x
            abs_y = ey0 + y
            print(f'  组件{i}: bbox=({abs_x},{abs_y},{w}x{h}) area={area}')

    # 保存可视化
    out = region.copy()
    out[mask > 0] = [0, 0, 255]
    out_path = f'/home/kevin/kevin/git/gxwtf_english/temp/debug_01_{name}_region.jpg'
    cv2.imwrite(out_path, out)

for name, (x0, y0, x1, y1) in words.items():
    check_region(name, x0, y0, x1, y1)

# 同时看下整张图最大块的几个连通组件，看是否真有大块高亮
print('\n\n=== 整图所有面积>5000 的高亮区域 ===')
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

n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 5000:
        print(f'  组件{i}: bbox=({x},{y},{w}x{h}) area={area}')
