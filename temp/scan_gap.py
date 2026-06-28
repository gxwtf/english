#!/usr/bin/env python3
"""检查 01.jpg 中 y=1434-1598 间隙区域，以及周围区域"""
import cv2, base64, requests

img = cv2.imread('temp/tests/01.jpg')
h, w = img.shape[:2]

# 检查行 22 和行 23 之间的间隙（y=1400-1650）
# 扩大范围确保覆盖
regions = [
    ('gap-1400-1650', 1400, 1650),
    ('gap-1430-1600', 1430, 1600),
    ('gap-1350-1650', 1350, 1650),
]

for name, y0, y1 in regions:
    crop = img[y0:y1, :]
    h2, w2 = crop.shape[:2]
    print(f"\n=== {name} ({w2}x{h2}) ===")

    _, buffer = cv2.imencode('.jpg', crop)
    img_b64 = base64.b64encode(buffer).decode()

    resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                         proxies={'http': None, 'https': None}, timeout=120)
    data = resp.json()

    all_words = data.get('words', [])
    full_text = data.get('fullText', '')

    print(f"  词数: {len(all_words)}")
    print(f"  fullText: {full_text[:500]}")

    # 搜索 divorce
    for wd in all_words:
        text = wd.get('text', '').lower()
        if 'divorc' in text or 'divor' in text or 'divo' in text:
            print(f"  *** 找到 divorce: '{wd['text']}'  bbox={wd['bbox']}  highlighted={wd.get('isHighlighted')}")

    if 'divorce' in full_text.lower():
        idx = full_text.lower().index('divorce')
        context = full_text[max(0, idx-60):idx+80]
        print(f"  *** fullText 中找到: ...{context}...")

    # 保存裁剪图片
    cv2.imwrite(f'/tmp/01_{name}.jpg', crop)
    print(f"  裁剪图已保存: /tmp/01_{name}.jpg")
