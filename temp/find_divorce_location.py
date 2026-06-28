#!/usr/bin/env python3
"""用模板匹配在 01.jpg 中找到 01_divorce.jpg 的位置"""
import cv2
import numpy as np

# 读取原图和模板
img = cv2.imread('temp/tests/01.jpg')
template = cv2.imread('temp/tests/01_divorce.jpg')

h, w = img.shape[:2]
th, tw = template.shape[:2]
print(f"原图: {w}x{h}, 模板: {tw}x{th}")

# 模板匹配
result = cv2.matchTemplate(img, template, cv2.TM_CCOEFF_NORMED)
min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

print(f"最佳匹配位置: {max_loc} (置信度: {max_val:.3f})")
print(f"匹配区域: x={max_loc[0]}-{max_loc[0]+tw}, y={max_loc[1]}-{max_loc[1]+th}")

# 在原图上标注 divorce 的位置
marked = img.copy()
cv2.rectangle(marked, max_loc, (max_loc[0]+tw, max_loc[1]+th), (0, 0, 255), 3)
cv2.imwrite('/tmp/01_divorce_location.jpg', marked)
print(f"标注图已保存: /tmp/01_divorce_location.jpg")

# 裁剪 divorce 周围更大的区域，分析为什么 OCR 漏掉了它
margin = 100
x0 = max(0, max_loc[0] - margin)
y0 = max(0, max_loc[1] - margin)
x1 = min(w, max_loc[0] + tw + margin)
y1 = min(h, max_loc[1] + th + margin)
context = img[y0:y1, x0:x1]
cv2.imwrite('/tmp/01_divorce_context.jpg', context)
print(f"上下文区域已保存: /tmp/01_divorce_context.jpg (x={x0}-{x1}, y={y0}-{y1})")

# 分析 divorce 区域的像素特征
divorce_region = img[max_loc[1]:max_loc[1]+th, max_loc[0]:max_loc[0]+tw]
gray = cv2.cvtColor(divorce_region, cv2.COLOR_BGR2GRAY)
hsv = cv2.cvtColor(divorce_region, cv2.COLOR_BGR2HSV)

print(f"\ndivorce 区域像素特征:")
print(f"  灰度: mean={gray.mean():.1f}, min={gray.min()}, max={gray.max()}")
print(f"  HSV: H mean={hsv[:,:,0].mean():.1f}, S mean={hsv[:,:,1].mean():.1f}, V mean={hsv[:,:,2].mean():.1f}")

# 检查这个区域是否有高亮色
h, s, v = cv2.split(hsv)
highlight_mask = (s > 40) & (v > 120)
highlight_ratio = highlight_mask.sum() / highlight_mask.size
print(f"  高亮像素比例: {highlight_ratio:.3f}")

# 分析为什么 OCR 漏掉了这个词
print(f"\n=== 分析 OCR 漏掉的原因 ===")
print(f"  divorce 词尺寸: {tw}x{th} 像素")
print(f"  在 1080x1920 图片中，这个词相对较小")
print(f"  PaddleOCR det 模型的 limit_side_len 默认 960，图片会被缩小")
print(f"  缩小后 divorce 词尺寸: {tw*960/1080:.0f}x{th*960/1920:.0f} 像素（可能太小被漏掉）")

# 尝试对 divorce 周围区域单独 OCR
import base64, requests
context_bigger = img[max(0, max_loc[1]-50):max_loc[1]+th+50,
                     max(0, max_loc[0]-200):min(w, max_loc[0]+tw+200)]
_, buffer = cv2.imencode('.jpg', context_bigger)
img_b64 = base64.b64encode(buffer).decode()
resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                     proxies={'http': None, 'https': None}, timeout=120)
data = resp.json()
all_words = data.get('words', [])
print(f"\n  周围区域 OCR 结果: {len(all_words)} 个词")
for wd in all_words:
    print(f"    '{wd['text']}'  highlighted={wd.get('isHighlighted')}")
