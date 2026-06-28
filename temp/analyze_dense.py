#!/usr/bin/env python3
"""分析 yellow-highlight-dense.jpg 为什么 creatures, environmental 未检测到"""
import base64
import json
import requests

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/yellow-highlight-dense.jpg'
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('ascii')

resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=120)
data = resp.json()

print(f'totalWords={data["stats"]["totalWords"]} highlightedCount={data["stats"]["highlightedCount"]}')

# 找 creatures 和 environmental 附近的词
print('\n=== 所有词中包含 creature/environmental 的 ===')
for w in data.get('words', []):
    text = w.get('text', '').lower()
    if 'creature' in text or 'environment' in text or 'mental' in text:
        print(f'  text={w.get("text")!r:25} highlighted={w.get("isHighlighted")} ratio={w.get("highlightRatio")} bbox={w.get("bbox")}')

# 找所有高亮词
print('\n=== 所有高亮词 ===')
for w in data.get('words', []):
    if w.get('isHighlighted'):
        print(f'  text={w.get("text")!r:25} ratio={w.get("highlightRatio")} bbox={w.get("bbox")}')

# 找所有 ratio > 0.1 的词
print('\n=== 所有 ratio > 0.1 的词 ===')
for w in data.get('words', []):
    if w.get('highlightRatio', 0) > 0.1:
        print(f'  text={w.get("text")!r:25} highlighted={w.get("isHighlighted")} ratio={w.get("highlightRatio")} bbox={w.get("bbox")}')

# 找所有包含 s/c/e 开头的词（可能是 creatures/environmental 的粘连词）
print('\n=== 所有词（前30个） ===')
for i, w in enumerate(data.get('words', [])[:30]):
    print(f'  {i:2d} text={w.get("text")!r:25} ratio={w.get("highlightRatio")}')
