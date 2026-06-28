#!/usr/bin/env python3
"""生成极端测试样例，测试系统鲁棒性。

从现有测试图片生成极端变体：
1. 旋转图片（5度倾斜）
2. 暗光图片（亮度降低50%）
3. 模糊图片（高斯模糊）
4. 小尺寸图片（缩小到300px宽）
5. 大尺寸图片（放大到2000px宽）
6. 无文字纯高亮图片
7. 噪声图片
"""
import cv2
import numpy as np
import os

SRC_DIR = '/home/kevin/kevin/git/gxwtf_english/temp/tests'
OUT_DIR = '/home/kevin/kevin/git/gxwtf_english/temp/tests/extreme'
os.makedirs(OUT_DIR, exist_ok=True)

# 源图片：黄色高亮-3词（有明确的高亮词用于验证）
SRC = os.path.join(SRC_DIR, 'yellow-highlight-3.jpg')
img = cv2.imread(SRC)
print(f'源图片: {SRC}  size={img.shape[1]}x{img.shape[0]}')

# 1. 旋转 5 度
h, w = img.shape[:2]
M = cv2.getRotationMatrix2D((w / 2, h / 2), 5, 1)
rotated = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
cv2.imwrite(os.path.join(OUT_DIR, 'rotated-5deg.jpg'), rotated)
print('生成: rotated-5deg.jpg (旋转5度)')

# 2. 暗光：降低亮度
dark = cv2.convertScaleAbs(img, alpha=0.5, beta=0)
cv2.imwrite(os.path.join(OUT_DIR, 'dark-50pct.jpg'), dark)
print('生成: dark-50pct.jpg (亮度降低50%)')

# 3. 模糊：高斯模糊
blur = cv2.GaussianBlur(img, (7, 7), 0)
cv2.imwrite(os.path.join(OUT_DIR, 'blur-heavy.jpg'), blur)
print('生成: blur-heavy.jpg (重度高斯模糊)')

# 4. 小尺寸：缩小到 300px 宽
scale = 300 / w
small = cv2.resize(img, (300, int(h * scale)), interpolation=cv2.INTER_AREA)
cv2.imwrite(os.path.join(OUT_DIR, 'small-300w.jpg'), small)
print(f'生成: small-300w.jpg (缩小到300px宽, size={small.shape[1]}x{small.shape[0]})')

# 5. 大尺寸：放大到 2000px 宽
scale = 2000 / w
large = cv2.resize(img, (2000, int(h * scale)), interpolation=cv2.INTER_CUBIC)
cv2.imwrite(os.path.join(OUT_DIR, 'large-2000w.jpg'), large)
print(f'生成: large-2000w.jpg (放大到2000px宽, size={large.shape[1]}x{large.shape[0]})')

# 6. 无文字纯高亮色块（纯色矩形，无文字）
blank = np.full((200, 600, 3), 255, dtype=np.uint8)
cv2.rectangle(blank, (50, 50), (200, 150), (0, 255, 255), -1)   # 黄色块
cv2.rectangle(blank, (250, 50), (400, 150), (255, 0, 255), -1)  # 粉色块
cv2.imwrite(os.path.join(OUT_DIR, 'no-text-colors.jpg'), blank)
print('生成: no-text-colors.jpg (无文字纯色块)')

# 7. 噪声图片
noise = np.random.randint(0, 256, (200, 600, 3), dtype=np.uint8)
cv2.imwrite(os.path.join(OUT_DIR, 'pure-noise.jpg'), noise)
print('生成: pure-noise.jpg (纯噪声)')

# 8. 完全空白白色图片
white = np.full((200, 600, 3), 255, dtype=np.uint8)
cv2.imwrite(os.path.join(OUT_DIR, 'blank-white.jpg'), white)
print('生成: blank-white.jpg (纯白图片)')

# 9. 旋转 15 度（更倾斜）
M2 = cv2.getRotationMatrix2D((w / 2, h / 2), 15, 1)
rotated15 = cv2.warpAffine(img, M2, (w, h), borderMode=cv2.BORDER_REPLICATE)
cv2.imwrite(os.path.join(OUT_DIR, 'rotated-15deg.jpg'), rotated15)
print('生成: rotated-15deg.jpg (旋转15度)')

# 10. 对比度极低
low_contrast = cv2.convertScaleAbs(img, alpha=0.3, beta=100)
cv2.imwrite(os.path.join(OUT_DIR, 'low-contrast.jpg'), low_contrast)
print('生成: low-contrast.jpg (低对比度)')

print(f'\n共生成 10 个极端测试图片，保存在 {OUT_DIR}')
