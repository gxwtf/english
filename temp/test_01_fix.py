#!/usr/bin/env python3
"""测试 01.jpg 的 OCR 结果 - 验证 neprsmofa 误识别已修复"""
import base64
import json
import sys
import requests

# 读取 01.jpg
with open('/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

# 调用 PaddleOCR 服务
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
print(f'高亮词: {highlighted}')
print(f'统计: {data["stats"]}')
print(f'OCR 耗时: {data["timing"]["total"]:.2f}s')

# 检查是否有 neprsmofa
all_texts = [w['text'] for w in data['words']]
if 'neprsmofa' in all_texts:
    print('FAIL: neprsmofa 误识别仍然存在')
    sys.exit(1)
else:
    print('PASS: neprsmofa 误识别已消除')

# 检查是否包含 4 个高亮词
expected = {'divine', 'divorce', 'beams', 'prism'}
actual = set(highlighted)
missing = expected - actual
extra = actual - expected
if missing:
    print(f'FAIL: 缺少高亮词: {missing}')
if extra:
    print(f'WARN: 多余高亮词: {extra}')
if not missing:
    print(f'PASS: 4 个高亮词全部识别 (divine, divorce, beams, prism)')
