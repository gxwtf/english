#!/usr/bin/env python3
"""检查 yellow-highlight-dense.jpg 实际有哪些高亮词"""
import base64, json, requests

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/yellow-highlight-dense.jpg'
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=60)
data = resp.json()

print('=== Highlighted words ===')
for w in data.get('words', []):
    if w.get('isHighlighted'):
        print(f"  text={w['text']!r:20} ratio={w.get('highlightRatio')} bbox={w['bbox']}")

print(f"\n=== Stats: total={data['stats']['totalWords']} highlighted={data['stats']['highlightedCount']} ===")

# 检查期望的 4 个词
expected = ['discovered', 'remarkable', 'creatures', 'environmental']
all_text = [w['text'].lower() for w in data.get('words', [])]
print('\n=== Expected word check ===')
for word in expected:
    found = any(word in t or t in word for t in all_text)
    print(f"  {word}: {'found in OCR' if found else 'NOT found'}")
    # Show matching words
    for t in all_text:
        if word in t or t in word:
            print(f"    -> {t}")
