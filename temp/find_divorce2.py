#!/usr/bin/env python3
"""检查 01.jpg 中是否包含 divorce 词，以及 OCR 是否识别到"""
import base64, requests, json, cv2, numpy as np

# 1. 调用 PaddleOCR 服务，获取完整 OCR 结果
with open('temp/tests/01.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

resp = requests.post('http://localhost:39821/', json={'image': img_b64},
                     proxies={'http': None, 'https': None}, timeout=120)
data = resp.json()

# 2. 搜索所有包含 "divorce" 或 "div" 的词
print("=== 所有 OCR 识别到的词中包含 'div' 的 ===")
all_words = data.get('words', [])
for w in all_words:
    text = w.get('text', '').lower()
    if 'div' in text or 'divorce' in text:
        print(f"  text='{w['text']}'  bbox={w['bbox']}  isHighlighted={w.get('isHighlighted')}  ratio={w.get('highlightRatio')}")

# 3. 搜索所有包含 "divorce" 的词（模糊匹配）
print("\n=== 模糊搜索 'divorce' ===")
for w in all_words:
    text = w.get('text', '').lower()
    # 检查编辑距离
    if len(text) > 3:
        # 简单检查是否包含 div, divorce, divorc 等子串
        if 'divo' in text or 'divor' in text or 'divorc' in text or text == 'divorce':
            print(f"  text='{w['text']}'  bbox={w['bbox']}  isHighlighted={w.get('isHighlighted')}")

# 4. 打印所有高亮词
print("\n=== 所有高亮词 ===")
for w in all_words:
    if w.get('isHighlighted'):
        print(f"  text='{w['text']}'  bbox={w['bbox']}  ratio={w.get('highlightRatio')}")

# 5. 打印所有词的完整列表（前100个）
print(f"\n=== 所有词 (共 {len(all_words)} 个，前100个) ===")
for i, w in enumerate(all_words[:100]):
    hl = '★' if w.get('isHighlighted') else ' '
    print(f"  {i:3d} {hl} '{w['text']}'")

# 6. 打印剩余的词
if len(all_words) > 100:
    print(f"\n=== 剩余词 ({len(all_words) - 100} 个) ===")
    for i, w in enumerate(all_words[100:], 100):
        hl = '★' if w.get('isHighlighted') else ' '
        print(f"  {i:3d} {hl} '{w['text']}'")

# 7. 在原始图片中搜索 "divorce" 文字区域
print("\n=== 在图片中搜索 divorce 文字区域 ===")
img = cv2.imread('temp/tests/01.jpg')
h, w = img.shape[:2]
print(f"图片尺寸: {w}x{h}")

# 裁剪图片的下半部分（divorce 可能在后面）
# 先检查 fullText 中是否有 divorce
full_text = data.get('fullText', '')
if 'divorce' in full_text.lower():
    print("fullText 中包含 'divorce'!")
    # 找到 divorce 在 fullText 中的位置
    idx = full_text.lower().index('divorce')
    context = full_text[max(0, idx-50):idx+60]
    print(f"  上下文: ...{context}...")
else:
    print("fullText 中不包含 'divorce'")
    # 检查是否有类似词
    for word in ['divorc', 'divore', 'divor', 'dvorce', 'divorce']:
        if word in full_text.lower():
            idx = full_text.lower().index(word)
            context = full_text[max(0, idx-50):idx+60]
            print(f"  找到 '{word}': ...{context}...")
