#!/usr/bin/env python3
"""直接调用 server.ocr_and_detect，对比 API 结果"""
import sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')
import server

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
with open(img_path, 'rb') as f:
    img_bytes = f.read()

print('Calling server.ocr_and_detect...')
result = server.ocr_and_detect(img_bytes)

print(f'\ntotalWords={result["stats"]["totalWords"]} highlightedCount={result["stats"]["highlightedCount"]}')
print(f'\n=== Highlighted Words ===')
for w in result.get('words', []):
    if w.get('isHighlighted'):
        print(f'  {w.get("text")!r:25} ratio={w.get("highlightRatio")} bbox={w.get("bbox")}')

print(f'\n=== themes 相关词 ===')
for w in result.get('words', []):
    if 'theme' in w.get('text', '').lower():
        print(f'  {w.get("text")!r:25} ratio={w.get("highlightRatio")} bbox={w.get("bbox")}')

print(f'\n=== divine 相关词 ===')
for w in result.get('words', []):
    if 'divine' in w.get('text', '').lower():
        print(f'  {w.get("text")!r:25} ratio={w.get("highlightRatio")} bbox={w.get("bbox")}')
