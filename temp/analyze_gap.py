#!/usr/bin/env python3
"""用 OpenCV 分析 01.jpg 间隙区域的像素特征，查找可能的文字"""
import cv2
import numpy as np

img = cv2.imread('temp/tests/01.jpg')
h, w = img.shape[:2]

# 分析间隙区域 y=1400-1650
gap = img[1400:1650, :]
gh, gw = gap.shape[:2]

# 转灰度
gray = cv2.cvtColor(gap, cv2.COLOR_BGR2GRAY)

# 计算每行的平均像素值（文字行会有更暗的像素）
row_means = gray.mean(axis=1)

# 找到有文字的行（平均像素值较低）
print("=== 间隙区域 y=1400-1650 行分析 ===")
print(f"  整体平均像素值: {gray.mean():.1f}")
print(f"  最暗行: {row_means.min():.1f} (y={row_means.argmin() + 1400})")
print(f"  最亮行: {row_means.max():.1f}")

# 找到有文字的行（平均像素值 < 200，表示有深色文字）
text_rows = []
for i, m in enumerate(row_means):
    if m < 220:  # 有深色像素的行
        text_rows.append(i + 1400)

if text_rows:
    print(f"  有深色像素的行范围: y={min(text_rows)}-{max(text_rows)} ({len(text_rows)} 行)")

    # 裁剪有文字的区域
    y0 = max(1400, min(text_rows) - 10)
    y1 = min(1650, max(text_rows) + 10)
    text_region = img[y0:y1, :]
    cv2.imwrite('/tmp/01_text_region.jpg', text_region)
    print(f"  文字区域已保存: /tmp/01_text_region.jpg (y={y0}-{y1})")

    # 对这个区域做 OCR
    import base64, requests
    _, buffer = cv2.imencode('.jpg', text_region)
    img_b64 = base64.b64encode(buffer).decode()
    resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                         proxies={'http': None, 'https': None}, timeout=120)
    data = resp.json()
    all_words = data.get('words', [])
    full_text = data.get('fullText', '')
    print(f"  OCR 词数: {len(all_words)}")
    print(f"  OCR 文本: {full_text[:300]}")

    # 搜索 divorce
    for wd in all_words:
        text = wd.get('text', '').lower()
        if 'divorc' in text or 'divor' in text or 'divo' in text:
            print(f"  *** 找到 divorce: '{wd['text']}'  highlighted={wd.get('isHighlighted')}")

    if 'divorce' in full_text.lower():
        idx = full_text.lower().index('divorce')
        context = full_text[max(0, idx-60):idx+80]
        print(f"  *** fullText 中找到: ...{context}...")
else:
    print("  间隙区域没有深色像素（无文字）")

# 同时分析整个图片，查找 "divorce" 可能出现的区域
# 用滑动窗口方式，每个窗口 200px 高，步长 100px
print("\n=== 滑动窗口 OCR 搜索 divorce ===")
window_h = 300
step = 150
for y0 in range(0, h - window_h + 1, step):
    window = img[y0:y0 + window_h, :]
    _, buffer = cv2.imencode('.jpg', window)
    img_b64 = base64.b64encode(buffer).decode()
    resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                         proxies={'http': None, 'https': None}, timeout=120)
    data = resp.json()
    full_text = data.get('fullText', '').lower()
    if 'divorce' in full_text or 'divorc' in full_text:
        print(f"  [y={y0}-{y0+window_h}] 找到! text: {data.get('fullText', '')[:200]}")
        for wd in data.get('words', []):
            if 'divorc' in wd.get('text', '').lower():
                print(f"    词: '{wd['text']}'  bbox={wd['bbox']}  highlighted={wd.get('isHighlighted')}")
