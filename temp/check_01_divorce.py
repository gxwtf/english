#!/usr/bin/env python3
"""检查 01.jpg 中 divorce 词的情况"""
import base64, json, requests

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=60)
data = resp.json()

print('=== 所有词 ===')
for i, w in enumerate(data.get('words', [])):
    hl = '★高亮' if w.get('isHighlighted') else ''
    print(f"  {i:2d} text={w['text']!r:25} ratio={w.get('highlightRatio',0):.3f} {hl} bbox={w['bbox']}")

print(f"\n=== 高亮词 ===")
for w in data.get('words', []):
    if w.get('isHighlighted'):
        print(f"  {w['text']} ratio={w.get('highlightRatio')}")

# 搜索 divorce
print(f"\n=== 搜索 divorce ===")
for w in data.get('words', []):
    if 'divorce' in w['text'].lower() or 'divorc' in w['text'].lower():
        print(f"  找到: {w['text']} bbox={w['bbox']} hl={w.get('isHighlighted')} ratio={w.get('highlightRatio')}")

# 检查所有包含 "div" 开头的词
print(f"\n=== 包含 'div' 的词 ===")
for w in data.get('words', []):
    if 'div' in w['text'].lower():
        print(f"  {w['text']} bbox={w['bbox']} hl={w.get('isHighlighted')} ratio={w.get('highlightRatio')}")
