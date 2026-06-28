#!/usr/bin/env python3
"""调试 01.jpg 的高亮区域位置和颜色分布"""
import base64
import json
import requests
import cv2
import numpy as np

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
img = cv2.imread(img_path)
print(f'Image shape: {img.shape}')

# 调用 OCR
with open(img_path, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('ascii')
resp = requests.post('http://localhost:39821/', json={'image': img_b64}, timeout=120)
data = resp.json()

# 获取原图 + 高亮 mask
# 检查每个高亮的词的 bbox
print('\n=== 高亮词的 bbox 位置 ===')
for w in data.get('words', []):
    if w.get('isHighlighted'):
        bbox = w.get('bbox') or w.get('box')
        print(f'  word={w.get("text")!r} ratio={w.get("highlightRatio")} bbox={bbox}')

# 用 debug 接口获取原图和 mask
print('\n=== 通过 debug 接口获取 ===')
resp2 = requests.post('http://localhost:39821/', json={'image': img_b64, 'debug': True}, timeout=120)
print(f'HTTP {resp2.status_code}')
if resp2.status_code == 200:
    try:
        data2 = resp2.json()
        print(f'keys: {list(data2.keys())}')
    except:
        print('no json')
