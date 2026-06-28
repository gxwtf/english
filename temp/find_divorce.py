#!/usr/bin/env python3
"""在 01.jpg 中查找 divorce 词的位置和高亮状态"""
import cv2
import numpy as np

img = cv2.imread('/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg')
h, w = img.shape[:2]
print(f'图片尺寸: {w}x{h}')

# 在图片中搜索 "divorce" 的位置
# 使用 OCR 的 clean result 找到所有文本
import sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')

# 直接调用 PaddleOCR
os_environ = __import__('os').environ
os_environ['GLOG_logtostderr'] = '1'
os_environ['GLOG_minloglevel'] = '3'

from paddleocr import PaddleOCR
engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

# 在原图和去高亮图上分别 OCR
clean_img = img.copy()
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
h_ch, s_ch, v_ch = cv2.split(hsv)
highlight_mask = (s_ch > 40) & (v_ch > 120)
clean_img[highlight_mask] = [255, 255, 255]

# 红色也移除
red1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 255]))
red2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 255]))
red_mask = cv2.bitwise_or(red1, red2)
clean_img[red_mask > 0] = [255, 255, 255]

print('\n=== Clean OCR (去高亮) ===')
result = engine.ocr(clean_img, cls=True)
for line in result:
    if line is None:
        continue
    for item in line:
        bbox, (text, conf) = item
        x0, y0 = int(bbox[0][0]), int(bbox[0][1])
        x1, y1 = int(bbox[2][0]), int(bbox[2][1])
        if 'divorc' in text.lower() or 'div' in text.lower():
            print(f'  ★ {text!r} bbox=({x0},{y0},{x1},{y1}) conf={conf:.3f}')

print('\n=== Raw OCR (原图) ===')
result = engine.ocr(img, cls=True)
for line in result:
    if line is None:
        continue
    for item in line:
        bbox, (text, conf) = item
        x0, y0 = int(bbox[0][0]), int(bbox[0][1])
        x1, y1 = int(bbox[2][0]), int(bbox[2][1])
        if 'divorc' in text.lower() or 'div' in text.lower():
            print(f'  ★ {text!r} bbox=({x0},{y0},{x1},{y1}) conf={conf:.3f}')

# 检查 divine 附近是否实际是 "divorce"
print('\n=== divine 附近 (y=680-760) 的所有词 ===')
for line in result:
    if line is None:
        continue
    for item in line:
        bbox, (text, conf) = item
        x0, y0 = int(bbox[0][0]), int(bbox[0][1])
        x1, y1 = int(bbox[2][0]), int(bbox[2][1])
        if 680 <= y0 <= 760 or 680 <= y1 <= 760:
            print(f'  {text!r:25} bbox=({x0},{y0},{x1},{y1}) conf={conf:.3f}')

# 检查 divine 区域的高亮状态
print('\n=== 检查 divine 区域高亮 ===')
# enhance + HSV mask
kernel_size = max(25, min(img.shape[0], img.shape[1]) // 20)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
bg = cv2.dilate(img, kernel)
bg = cv2.GaussianBlur(bg, (21, 21), 0)
enhanced = np.clip(255 * (img.astype(np.float32) / (bg.astype(np.float32) + 1e-7)), 0, 255).astype(np.uint8)
enhanced_hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
hl_mask = cv2.inRange(enhanced_hsv, np.array([15, 40, 120]), np.array([45, 255, 255]))

# 在 divine 附近 (y=700-750) 搜索所有高亮区域
for y in range(690, 760, 5):
    for x in range(0, w, 10):
        if hl_mask[y:y+5, x:x+10].sum() > 0:
            # 找到高亮区域的边界
            print(f'  高亮区域: x={x}-{x+10}, y={y}-{y+5}')
            break
