#!/usr/bin/env python3
"""分析所有红笔/黑笔圈出/下划线测试图片"""
import cv2
import numpy as np
import os

test_dir = '/home/kevin/kevin/git/gxwtf_english/temp/tests'
test_cases = [
    ('red-circle-2.jpg', '红笔圈出-2词', ['courageous', 'medal']),
    ('red-underline-2.jpg', '红下划线-2词', ['mysterious', 'disappeared']),
    ('black-circle-2.jpg', '黑笔圈出-2词', ['appreciate', 'wonderful']),
    ('black-underline-2.jpg', '黑下划线-2词', ['requires', 'perseverance']),
    ('red-circle-3.jpg', '红笔圈出-3词', ['important', 'require', 'consideration']),
]

for filename, name, expected in test_cases:
    img_path = os.path.join(test_dir, filename)
    img = cv2.imread(img_path)
    print(f'\n{"="*60}')
    print(f'{name} ({filename}) - 期望: {expected}')
    print(f'Image shape: {img.shape}')

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # 红色 mask
    red_mask1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 255]))
    red_mask2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)
    red_ratio = cv2.countNonZero(red_mask) / red_mask.size

    # 黑色 mask (低饱和度、低亮度)
    black_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 50, 80]))
    black_ratio = cv2.countNonZero(black_mask) / black_mask.size

    print(f'红色像素: {red_ratio:.3f}, 黑色像素: {black_ratio:.3f}')

    # 找红色区域
    n_red, _, stats_red, _ = cv2.connectedComponentsWithStats(red_mask, connectivity=8)
    red_components = []
    for i in range(1, n_red):
        x, y, w, h, area = stats_red[i]
        if area > 100:
            red_components.append((x, y, w, h, area))
            bbox_area = w * h
            fill_ratio = area / bbox_area if bbox_area > 0 else 0
            print(f'  红色组件: bbox=({x},{y},{w}x{h}) area={area} fill={fill_ratio:.2f}')

    # 找黑色区域（排除文字本身）
    # 文字是黑色的，所以黑色区域很多。需要找"非文字"的黑色区域
    # 黑笔圈出/下划线的线条比文字粗，可以用形态学来区分
    # 简单方法：找面积 > 500 的黑色连通组件
    n_black, _, stats_black, _ = cv2.connectedComponentsWithStats(black_mask, connectivity=8)
    black_components = []
    for i in range(1, n_black):
        x, y, w, h, area = stats_black[i]
        if area > 200:  # 过滤小噪点
            black_components.append((x, y, w, h, area))

    print(f'  黑色大组件数: {len(black_components)}')
    for x, y, w, h, area in black_components[:5]:
        bbox_area = w * h
        fill_ratio = area / bbox_area if bbox_area > 0 else 0
        print(f'    黑色组件: bbox=({x},{y},{w}x{h}) area={area} fill={fill_ratio:.2f}')

    # 判断标记类型
    if red_components:
        # 检查红色组件的形状：圈出 vs 下划线
        for x, y, w, h, area in red_components:
            bbox_area = w * h
            fill_ratio = area / bbox_area if bbox_area > 0 else 0
            aspect_ratio = w / h if h > 0 else 0
            if fill_ratio < 0.3:
                mark_type = '圈出（环形，填充率低）'
            elif aspect_ratio > 3:
                mark_type = '下划线（宽扁形状）'
            else:
                mark_type = '实心标记'
            print(f'  → 标记类型: {mark_type} (fill={fill_ratio:.2f}, aspect={aspect_ratio:.2f})')
