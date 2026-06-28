#!/usr/bin/env python3
"""验证 enhance_color_document 后 themes 词的高亮比例"""
import sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')
import cv2
import numpy as np
import server

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
img = cv2.imread(img_path)

# 模拟 server 流程
warped_img, M = server.auto_transform(img)
enhanced_img = server.enhance_color_document(warped_img)
highlight_mask = server.extract_highlight_mask(enhanced_img)
filtered_mask = server.filter_highlight_mask(highlight_mask, [])

# 4 个词的 bbox
words = {
    'divine': (541, 706, 600, 746),
    'themes': (600, 706, 659, 746),
    'beams': (491, 1088, 543, 1130),
    'prism': (724, 1088, 776, 1130),
}

print('=== enhanced_img (server 流程) 中各词的高亮比例 ===')
for name, (x0, y0, x1, y1) in words.items():
    # 原始 mask (未过滤)
    region_raw = highlight_mask[y0:y1, x0:x1]
    ratio_raw = cv2.countNonZero(region_raw) / region_raw.size
    # 过滤后 mask
    region_filtered = filtered_mask[y0:y1, x0:x1]
    ratio_filtered = cv2.countNonZero(region_filtered) / region_filtered.size
    print(f'  {name:8} raw={ratio_raw:.3f}  filtered={ratio_filtered:.3f}')

# 看 themes 词附近的 enhanced_img 颜色
print('\n=== themes 词在 enhanced_img 中的颜色 ===')
themes_region = enhanced_img[706:746, 600:659]
mean_bgr = themes_region.reshape(-1, 3).mean(axis=0).astype(int)
hsv_themes = cv2.cvtColor(themes_region, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(axis=0).astype(int)
print(f'  themes: BGR={mean_bgr} HSV={hsv_themes}')

divine_region = enhanced_img[706:746, 541:600]
mean_bgr_d = divine_region.reshape(-1, 3).mean(axis=0).astype(int)
hsv_d = cv2.cvtColor(divine_region, cv2.COLOR_BGR2HSV).reshape(-1, 3).mean(axis=0).astype(int)
print(f'  divine: BGR={mean_bgr_d} HSV={hsv_d}')

# 看一下 themes 词附近的高亮 mask 是不是与 divine 的高亮区域连通
print('\n=== themes 词在 raw highlight_mask 中的连通组件 ===')
# 找 themes 附近的连通组件
themes_area_mask = highlight_mask[700:750, 580:680]
n, labels, stats, centroids = cv2.connectedComponentsWithStats(themes_area_mask, connectivity=8)
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 30:
        print(f'  组件{i}: bbox=({x+580},{y+700},{w}x{h}) area={area}')

# 保存 enhanced_img 中 themes 区域
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_01_enhanced_themes.jpg',
            enhanced_img[680:770, 530:680])
print(f'\nEnhanced themes region saved')

# 看一下 divine 的高亮区域是否延伸到 themes
print('\n=== divine 高亮区域 (raw mask) ===')
divine_area_mask = highlight_mask[700:750, 530:680]
n, labels, stats, centroids = cv2.connectedComponentsWithStats(divine_area_mask, connectivity=8)
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area > 30:
        abs_x = 530 + x
        abs_y = 700 + y
        print(f'  组件{i}: bbox=({abs_x},{abs_y},{w}x{h}) area={area}')
