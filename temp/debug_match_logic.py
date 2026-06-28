#!/usr/bin/env python3
"""调试 match_words_to_line 的碎片修正逻辑"""
import sys
sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')
import cv2
import numpy as np
import server

img_path = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
with open(img_path, 'rb') as f:
    img_bytes = f.read()

nparr = np.frombuffer(img_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
MAX_DIM = 2000
h, w = img.shape[:2]
if max(h, w) > MAX_DIM:
    scale = MAX_DIM / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

warped_img, M = server.auto_transform(img)
clean_img = server.remove_highlights_for_ocr(warped_img)
engine = server.get_ocr()
clean_result = engine.ocr(clean_img, cls=True)
clean_lines = server.parse_ocr_result(clean_result)
raw_result = engine.ocr(warped_img, cls=True)
raw_lines = server.parse_ocr_result(raw_result)

enhanced_img = server.enhance_color_document(warped_img)
highlight_mask = server.extract_highlight_mask(enhanced_img)
highlight_mask = server.filter_highlight_mask(highlight_mask, clean_lines + raw_lines)

# 对 raw_lines 检测高亮
for line in raw_lines:
    is_hl, hl_ratio = server.check_word_highlighted(highlight_mask, line['bbox'])
    line['isHighlighted'] = is_hl
    line['highlightRatio'] = hl_ratio

# 找 divine/themes 所在的行 (y=706-746)
print('=== clean_lines 中 divine/themes 所在行 ===')
for line in clean_lines:
    if 'divine' in line['text'].lower() or 'theme' in line['text'].lower():
        print(f'  text={line["text"]!r} bbox={line["bbox"]}')

print('\n=== raw_lines 中 y=700-750 范围内的碎片 ===')
for line in raw_lines:
    y0 = line['bbox']['y0']
    y1 = line['bbox']['y1']
    if 680 < y0 < 760 or 680 < y1 < 760:
        print(f'  text={line["text"]!r:30} highlighted={line["isHighlighted"]} ratio={line["highlightRatio"]} bbox={line["bbox"]}')

# 模拟 match_words_to_line 的碎片修正
print('\n=== 模拟 match_words_to_line 的碎片修正 ===')
# 找包含 divine/themes 的 clean_line
for clean_line in clean_lines:
    if 'divine' in clean_line['text'].lower() or 'theme' in clean_line['text'].lower():
        text = server.split_stuck_words(clean_line['text'])
        tokens = text.split()
        line_bbox = clean_line['bbox']
        line_x0, line_x1 = line_bbox['x0'], line_bbox['x1']
        line_y0, line_y1 = line_bbox['y0'], line_bbox['y1']
        line_width = line_x1 - line_x0
        total_chars = sum(len(t) for t in tokens) + len(tokens) - 1

        print(f'clean_line: text={clean_line["text"]!r}')
        print(f'split tokens: {tokens}')
        print(f'line_bbox: ({line_x0},{line_y0},{line_x1},{line_y1}) width={line_width}')

        # 等比分配 bbox
        words = []
        current_x = line_x0
        for token in tokens:
            char_count = len(token) + 1
            part_width = int(line_width * char_count / total_chars)
            word_bbox = {'x0': current_x, 'y0': line_y0, 'x1': current_x + part_width, 'y1': line_y1}
            is_hl, hl_ratio = server.check_word_highlighted(highlight_mask, word_bbox)
            words.append({'text': token, 'bbox': word_bbox, 'isHighlighted': is_hl, 'highlightRatio': hl_ratio})
            print(f'  token={token!r:15} bbox=({word_bbox["x0"]},{word_bbox["y0"]},{word_bbox["x1"]},{word_bbox["y1"]}) ratio={hl_ratio}')
            current_x += part_width

        # 找该行的碎片
        cl_y_center = (line_bbox['y0'] + line_bbox['y1']) / 2
        avg_height = line_bbox['y1'] - line_bbox['y0']
        matching_frags = []
        for frag in raw_lines:
            frag_y_center = (frag['bbox']['y0'] + frag['bbox']['y1']) / 2
            if abs(frag_y_center - cl_y_center) < avg_height * 0.6:
                if frag['bbox']['x1'] > line_bbox['x0'] and frag['bbox']['x0'] < line_bbox['x1']:
                    matching_frags.append(frag)

        print(f'\nmatching_frags: {len(matching_frags)}')
        for frag in matching_frags:
            print(f'  frag: text={frag["text"]!r:30} highlighted={frag["isHighlighted"]} ratio={frag["highlightRatio"]} bbox={frag["bbox"]}')

        # 应用碎片修正
        print('\n=== 应用碎片修正后 ===')
        for frag in matching_frags:
            frag_cx = (frag['bbox']['x0'] + frag['bbox']['x1']) / 2
            for w in words:
                if w['bbox']['x0'] <= frag_cx <= w['bbox']['x1']:
                    if frag.get('isHighlighted'):
                        print(f'  修正: {w["text"]!r} 被碎片 {frag["text"]!r} 标记为高亮 (frag ratio={frag["highlightRatio"]})')
                        w['isHighlighted'] = True
                        w['highlightRatio'] = max(w['highlightRatio'], frag.get('highlightRatio', 0))
                    break

        for w in words:
            print(f'  final: {w["text"]!r:15} highlighted={w["isHighlighted"]} ratio={w["highlightRatio"]}')
        break
