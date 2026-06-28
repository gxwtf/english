#!/usr/bin/env python3
"""检查 01.jpg 中 4 个词的真实像素颜色分布"""
import cv2
import numpy as np

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
img = cv2.imread(img_path)
print(f'Image shape: {img.shape}')

# 4 个词的 bbox
words = {
    'divine': (541, 706, 600, 746),
    'themes': (600, 706, 659, 746),
    'beams': (491, 1088, 543, 1130),
    'prism': (724, 1088, 776, 1130),
}

# 还要检查一些已知的不高亮词作为对照
# 'and' 在 divine 之前 (ratio=0.083) - 应该不高亮
# 'of' 在 beams 之后 (ratio=0.22) - 应该不高亮
controls = {
    'and_before_divine': (490, 706, 540, 746),  # 大致估计
    'of_after_beams': (544, 1088, 580, 1130),
}

print('\n=== 词 bbox 内 HSV 颜色统计 ===')
print(f'{"name":25} {"mean BGR":25} {"mean HSV":25} {"highlight_pixel_ratio":>20}')
for name, (x0, y0, x1, y1) in {**words, **controls}.items():
    region = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)

    mean_bgr = region.reshape(-1, 3).mean(axis=0)
    mean_hsv = hsv.reshape(-1, 3).mean(axis=0)

    # 高亮像素比例
    masks = []
    masks.append(cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([35, 40, 120]), np.array([85, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([140, 30, 120]), np.array([180, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([5, 40, 120]), np.array([20, 255, 255])))
    mask = masks[0]
    for m in masks[1:]:
        mask = cv2.bitwise_or(mask, m)

    highlight_ratio = cv2.countNonZero(mask) / mask.size if mask.size > 0 else 0
    print(f'{name:25} {str(mean_bgr.astype(int)):25} {str(mean_hsv.astype(int)):25} {highlight_ratio:>20.3f}')

# 还要检查 beams 上下行的高亮情况
print('\n=== beams 周围区域 (y=1080-1140) 的颜色分布 ===')
for x_start in range(440, 820, 80):
    x_end = min(x_start + 80, 820)
    region = img[1080:1140, x_start:x_end]
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    masks = []
    masks.append(cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([35, 40, 120]), np.array([85, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([140, 30, 120]), np.array([180, 255, 255])))
    masks.append(cv2.inRange(hsv, np.array([5, 40, 120]), np.array([20, 255, 255])))
    mask = masks[0]
    for m in masks[1:]:
        mask = cv2.bitwise_or(mask, m)
    ratio = cv2.countNonZero(mask) / mask.size
    print(f'  x=[{x_start}-{x_end}]: highlight_ratio={ratio:.3f}')

# 保存 beams 区域放大版
beams_region = img[1000:1200, 400:850]
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_01_beams_area.jpg', beams_region)
print(f'\nBeams area saved to: temp/debug_01_beams_area.jpg')

# 也保存 divine/themes 区域
divine_region = img[620:800, 450:720]
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_01_divine_area.jpg', divine_region)
print(f'Divine area saved to: temp/debug_01_divine_area.jpg')
