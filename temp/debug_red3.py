#!/usr/bin/env python3
"""调试 red-circle-3.jpg 的 OCR 结果"""
import base64, json, requests

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/red-circle-3.jpg'
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=60)
data = resp.json()

print('=== Highlighted words ===')
for w in data.get('words', []):
    if w.get('isHighlighted'):
        print(f"  text={w['text']!r:20} bbox={w['bbox']}")

print('\n=== All words (first 20) ===')
for i, w in enumerate(data.get('words', [])[:20]):
    print(f"  {i:2d} text={w['text']!r:20} hl={w.get('isHighlighted')} bbox={w['bbox']}")
