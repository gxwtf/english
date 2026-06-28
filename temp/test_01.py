#!/usr/bin/env python3
"""测试 01.jpg 的 OCR 结果，定位 'divine, themes, beams, prism' 错误识别的原因"""
import base64
import json
import requests
import sys

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('ascii')

print(f'Image size (base64): {len(img_b64)} bytes')
resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=120)
print(f'HTTP {resp.status_code}')
data = resp.json()

print('\n=== All Words ===')
for i, w in enumerate(data.get('words', [])):
    bbox = w.get('bbox') or w.get('box')
    print(f'  {i:2d} text={w.get("text")!r:30} highlighted={w.get("isHighlighted")} ratio={w.get("highlightRatio")} bbox={bbox}')

print(f'\n=== Stats ===')
print(f'totalWords={data["stats"]["totalWords"]} highlightedCount={data["stats"]["highlightedCount"]}')

print('\n=== Highlighted Words (returned to user) ===')
for w in data.get('words', []):
    if w.get('isHighlighted'):
        print(f'  -> {w.get("text")}')

print('\n=== Timing ===')
print(json.dumps(data.get('timing', {}), indent=2))

print('\n=== Thinking ===')
print(data.get('thinking', ''))
