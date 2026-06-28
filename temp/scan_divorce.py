#!/usr/bin/env python3
"""将 01.jpg 分区域 OCR，查找 divorce 词"""
import cv2, numpy as np, base64, requests, json

# 读取图片
img = cv2.imread('temp/tests/01.jpg')
h, w = img.shape[:2]
print(f"图片尺寸: {w}x{h}")

# 将图片分成 6 个水平条带，分别 OCR
NUM_BANDS = 6
band_h = h // NUM_BANDS

for i in range(NUM_BANDS):
    y0 = i * band_h
    y1 = (i + 1) * band_h if i < NUM_BANDS - 1 else h
    band = img[y0:y1, :]

    # 调用 PaddleOCR
    _, buffer = cv2.imencode('.jpg', band)
    img_b64 = base64.b64encode(buffer).decode()

    resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                         proxies={'http': None, 'https': None}, timeout=120)
    data = resp.json()

    all_words = data.get('words', [])
    full_text = data.get('fullText', '')

    # 搜索 divorce
    found_divorce = False
    for w in all_words:
        text = w.get('text', '').lower()
        if 'divorce' in text or 'divorc' in text or 'divor' in text or 'divo' in text:
            print(f"  [条带 {i}] 找到: '{w['text']}'  bbox={w['bbox']}  highlighted={w.get('isHighlighted')}")
            found_divorce = True

    if 'divorce' in full_text.lower():
        idx = full_text.lower().index('divorce')
        context = full_text[max(0, idx-40):idx+50]
        print(f"  [条带 {i}] fullText 中找到 divorce: ...{context}...")
        found_divorce = True

    if not found_divorce:
        # 检查是否有类似 divorce 的词
        for w in all_words:
            text = w.get('text', '').lower()
            if len(text) > 4 and text.startswith('div'):
                print(f"  [条带 {i}] 类似词: '{w['text']}'  bbox={w['bbox']}")

    print(f"  [条带 {i}] y={y0}-{y1}, 词数={len(all_words)}, 高亮={data.get('stats', {}).get('highlightedCount', 0)}")
