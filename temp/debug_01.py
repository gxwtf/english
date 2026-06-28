#!/usr/bin/env python3
"""调试 01.jpg - 生成可视化结果，用于分析高亮检测问题"""
import base64
import json
import requests
import cv2
import numpy as np
from pathlib import Path

ROOT = Path('/home/kevin/kevin/git/gxwtf_english')
IMG_PATH = ROOT / 'temp/tests/01.jpg'
OUT_DIR = ROOT / 'temp/debug_out'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. 调用 OCR 服务
with open(IMG_PATH, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
print('Calling OCR service...')
r = requests.post('http://127.0.0.1:39821/', json={'image': img_b64}, timeout=180)
data = r.json()
print(f"Stats: {data.get('stats')}")
print(f"Highlighted words count: {len(data.get('highlightedWords', []))}")

# 2. 加载原图
img = cv2.imread(str(IMG_PATH))
h, w = img.shape[:2]
print(f'Image size: {w}x{h}')

# 限制最大分辨率（与 server.py 一致）
MAX_DIM = 2000
if max(h, w) > MAX_DIM:
    scale = MAX_DIM / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
h, w = img.shape[:2]

# 3. 复现 server.py 中的高亮检测流程
# 透视变换
def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[1]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped, M

def find_document_contour(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype("float32")
    return None

def auto_transform(image):
    pts = find_document_contour(image)
    if pts is not None:
        warped, M = four_point_transform(image, pts)
        return warped, M
    return image, None

warped_img, _ = auto_transform(img)

# 光照归一化
def enhance_color_document(img):
    kernel_size = max(25, min(img.shape[0], img.shape[1]) // 20)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    bg = cv2.dilate(img, kernel)
    bg = cv2.GaussianBlur(bg, (21, 21), 0)
    img_float = img.astype(np.float32)
    bg_float = bg.astype(np.float32)
    out = 255 * (img_float / (bg_float + 1e-7))
    out = np.clip(out, 0, 255).astype(np.uint8)
    return out

enhanced_img = enhance_color_document(warped_img)

# 高亮 mask
def extract_highlight_mask(enhanced_img):
    hsv = cv2.cvtColor(enhanced_img, cv2.COLOR_BGR2HSV)
    masks = []
    masks.append(cv2.inRange(hsv, np.array([15, 40, 120]), np.array([45, 255, 255])))  # 黄
    masks.append(cv2.inRange(hsv, np.array([35, 40, 120]), np.array([85, 255, 255])))  # 绿
    masks.append(cv2.inRange(hsv, np.array([140, 30, 120]), np.array([180, 255, 255])))  # 粉/紫
    masks.append(cv2.inRange(hsv, np.array([5, 40, 120]), np.array([20, 255, 255])))  # 橙
    mask = masks[0]
    for m in masks[1:]:
        mask = cv2.bitwise_or(mask, m)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    return mask

highlight_mask = extract_highlight_mask(enhanced_img)

# 4. 保存可视化结果
# 4.1 原图（变换后）
cv2.imwrite(str(OUT_DIR / '01_warped.jpg'), warped_img, [cv2.IMWRITE_JPEG_QUALITY, 85])

# 4.2 增强图
cv2.imwrite(str(OUT_DIR / '01_enhanced.jpg'), enhanced_img, [cv2.IMWRITE_JPEG_QUALITY, 85])

# 4.3 高亮 mask
mask_color = cv2.applyColorMap(highlight_mask, cv2.COLORMAP_JET)
cv2.imwrite(str(OUT_DIR / '01_mask.png'), mask_color)

# 4.4 在原图上绘制高亮区域（mask 半透明叠加）
overlay = warped_img.copy()
overlay[highlight_mask > 0] = (0, 0, 255)  # 红色叠加
blended = cv2.addWeighted(warped_img, 0.6, overlay, 0.4, 0)
cv2.imwrite(str(OUT_DIR / '01_highlight_overlay.jpg'), blended, [cv2.IMWRITE_JPEG_QUALITY, 85])

# 4.5 在原图上绘制每个单词的 bbox
bbox_img = warped_img.copy()
for w in data.get('words', []):
    bbox = w['bbox']
    is_hl = w.get('isHighlighted', False)
    color = (0, 0, 255) if is_hl else (0, 255, 0)  # 红色=高亮, 绿色=未高亮
    cv2.rectangle(bbox_img, (bbox['x0'], bbox['y0']), (bbox['x1'], bbox['y1']), color, 2)
    if is_hl:
        label = f"{w['text']}({w.get('highlightRatio', 0):.2f})"
        cv2.putText(bbox_img, label, (bbox['x0'], max(bbox['y0'] - 5, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
cv2.imwrite(str(OUT_DIR / '01_bboxes.jpg'), bbox_img, [cv2.IMWRITE_JPEG_QUALITY, 85])

# 5. 分析高亮区域的连通组件，找出大块高亮区域
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(highlight_mask, connectivity=8)
print(f'\n连通组件数量: {num_labels - 1} (不含背景)')
print('Top 10 大块高亮区域:')
components_info = []
for i in range(1, num_labels):
    x, y, ww, hh, area = stats[i]
    components_info.append((i, x, y, ww, hh, area, centroids[i]))
components_info.sort(key=lambda c: -c[5])
for i, (label_id, x, y, ww, hh, area, centroid) in enumerate(components_info[:15]):
    print(f'  区域{label_id}: 位置=({x},{y}) 尺寸={ww}x{hh} 面积={area} 中心=({centroid[0]:.0f},{centroid[1]:.0f})')

# 6. 在原图上绘制每个连通组件
comp_img = warped_img.copy()
for i, (label_id, x, y, ww, hh, area, centroid) in enumerate(components_info[:15]):
    color = (0, 0, 255) if i < 4 else (0, 255, 255)
    cv2.rectangle(comp_img, (x, y), (x + ww, y + hh), color, 2)
    cv2.putText(comp_img, f'#{label_id} a={area}', (x, max(y - 5, 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
cv2.imwrite(str(OUT_DIR / '01_components.jpg'), comp_img, [cv2.IMWRITE_JPEG_QUALITY, 85])

# 7. 保存高亮单词列表
hl_words = [w for w in data.get('words', []) if w.get('isHighlighted')]
with open(OUT_DIR / 'highlighted_words.json', 'w') as f:
    json.dump({
        'highlighted_words': hl_words,
        'all_words_count': len(data.get('words', [])),
        'highlighted_count': len(hl_words),
        'components': [{
            'id': c[0], 'x': int(c[1]), 'y': int(c[2]),
            'width': int(c[3]), 'height': int(c[4]), 'area': int(c[5])
        } for c in components_info[:20]]
    }, f, indent=2, ensure_ascii=False)

print(f'\n可视化结果保存到: {OUT_DIR}')
print(f'  - 01_warped.jpg (透视变换后)')
print(f'  - 01_enhanced.jpg (光照归一化)')
print(f'  - 01_mask.png (高亮 mask)')
print(f'  - 01_highlight_overlay.jpg (高亮叠加)')
print(f'  - 01_bboxes.jpg (单词 bbox)')
print(f'  - 01_components.jpg (连通组件)')
print(f'  - highlighted_words.json (高亮单词详情)')
