#!/usr/bin/env python3
"""检查 01_full.jpg 和 01_crop.jpg 中是否有 divorce"""
import cv2, base64, requests

for fname in ['temp/tests/01_full.jpg', 'temp/tests/01_crop.jpg']:
    img = cv2.imread(fname)
    if img is None:
        print(f"{fname}: 读取失败")
        continue
    h, w = img.shape[:2]
    print(f"\n=== {fname} ({w}x{h}) ===")

    _, buffer = cv2.imencode('.jpg', img)
    img_b64 = base64.b64encode(buffer).decode()

    resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                         proxies={'http': None, 'https': None}, timeout=120)
    data = resp.json()

    all_words = data.get('words', [])
    full_text = data.get('fullText', '')

    # 搜索 divorce
    found = False
    for wd in all_words:
        text = wd.get('text', '').lower()
        if 'divorc' in text or 'divor' in text or 'divo' in text or text == 'divorce':
            print(f"  找到 divorce: '{wd['text']}'  bbox={wd['bbox']}  highlighted={wd.get('isHighlighted')}")
            found = True

    if 'divorce' in full_text.lower():
        idx = full_text.lower().index('divorce')
        context = full_text[max(0, idx-50):idx+60]
        print(f"  fullText 中找到: ...{context}...")
        found = True

    if not found:
        # 搜索包含 div 的词
        for wd in all_words:
            text = wd.get('text', '').lower()
            if 'div' in text:
                print(f"  包含 div 的词: '{wd['text']}'  highlighted={wd.get('isHighlighted')}")

    print(f"  词数: {len(all_words)}, 高亮: {data.get('stats', {}).get('highlightedCount', 0)}")
    print(f"  高亮词: {[w['text'] for w in all_words if w.get('isHighlighted')]}")
