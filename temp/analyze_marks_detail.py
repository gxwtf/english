#!/usr/bin/env python3
"""详细分析红笔/黑笔标记图片的特征，为检测算法提供参数"""
import cv2
import numpy as np
import os

TEST_DIR = '/home/kevin/kevin/git/gxwtf_english/temp/tests'
IMAGES = [
    ('red-circle-2.jpg', '红笔圈出-2词', ['courageous', 'medal']),
    ('red-underline-2.jpg', '红下划线-2词', ['mysterious', 'disappeared']),
    ('black-circle-2.jpg', '黑笔圈出-2词', ['appreciate', 'wonderful']),
    ('black-underline-2.jpg', '黑下划线-2词', ['requires', 'perseverance']),
    ('red-circle-3.jpg', '红笔圈出-3词', ['important', 'require', 'consideration']),
]

for fname, name, expected in IMAGES:
    path = os.path.join(TEST_DIR, fname)
    if not os.path.exists(path):
        print(f'缺失: {fname}')
        continue
    img = cv2.imread(path)
    if img is None:
        continue
    h, w = img.shape[:2]
    print(f'\n{"="*70}')
    print(f'{name} ({fname})  size={w}x{h}  expected={expected}')
    print(f'{"="*70}')

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # 红色 mask（两个范围）
    red1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red1, red2)

    # 黑色 mask（低饱和度低亮度）
    black_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 50, 80]))

    for label, mask in [('红色', red_mask), ('黑色', black_mask)]:
        cnt = cv2.countNonZero(mask)
        if cnt == 0:
            print(f'  [{label}] 无像素')
            continue
        # 找连通组件
        num, labels, stats, cent = cv2.connectedComponentsWithStats(mask, connectivity=8)
        comps = []
        for i in range(1, num):
            x, y, cw, ch, area = stats[i]
            if area < 30:  # 过滤太小的噪点
                continue
            bbox_area = cw * ch
            fill_ratio = area / bbox_area if bbox_area > 0 else 0
            aspect = cw / ch if ch > 0 else 0
            comps.append({
                'x': x, 'y': y, 'w': cw, 'h': ch, 'area': area,
                'fill': round(fill_ratio, 3), 'aspect': round(aspect, 2),
                'cx': round(cent[i][0]), 'cy': round(cent[i][1]),
            })
        # 按面积排序，取前 10 个
        comps.sort(key=lambda c: -c['area'])
        print(f'  [{label}] 共 {len(comps)} 个组件 (总面积 {cnt} 像素)')
        for c in comps[:10]:
            shape = '?'
            if c['fill'] < 0.3 and c['w'] > 20 and c['h'] > 20:
                shape = '圈/环'
            elif c['aspect'] > 3 and c['h'] < 30:
                shape = '下划线'
            elif c['fill'] > 0.8:
                shape = '实心块'
            print(f"    x={c['x']:4d} y={c['y']:4d} w={c['w']:3d} h={c['h']:3d} area={c['area']:5d} "
                  f"fill={c['fill']} aspect={c['aspect']} cx={c['cx']} cy={c['cy']} -> {shape}")
