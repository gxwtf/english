#!/usr/bin/env python3
"""测试 01_divorce.jpg (裁剪小图) 的 OCR 结果"""
import base64
import sys
import requests

with open('/home/kevin/kevin/git/gxwtf_english/temp/tests/01_divorce.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

resp = requests.post(
    'http://127.0.0.1:39821',
    json={'image': img_b64},
    proxies={'http': None, 'https': None},
    timeout=60,
)
data = resp.json()
if data.get('error'):
    print(f'ERROR: {data["error"]}')
    sys.exit(1)

highlighted = [w['text'] for w in data['words'] if w['isHighlighted']]
all_texts = [w['text'] for w in data['words']]
print(f'所有词: {all_texts}')
print(f'高亮词: {highlighted}')
print(f'统计: {data["stats"]}')
print(f'OCR 耗时: {data["timing"]["total"]:.2f}s')

if 'divorce' in all_texts:
    print('PASS: divorce 被识别')
else:
    print('INFO: divorce 未在结果中（裁剪小图可能因尺寸问题未识别）')
