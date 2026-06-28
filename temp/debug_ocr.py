#!/usr/bin/env python3
"""调试 OCR 流程，逐步检查每一步的结果"""
import sys, os, time, cv2, numpy as np

# 设置 GLog 环境变量（与 server.py 一致）
os.environ['GLOG_logtostderr'] = '1'
os.environ['GLOG_minloglevel'] = '3'
os.environ['GLOG_max_log_size'] = '1'
os.environ['GLOG_stop_logging_if_full_disk'] = '1'
os.environ['FLAGS_logtostderr'] = 'true'
os.environ['FLAGS_call_stack_level'] = '0'

sys.path.insert(0, '/home/kevin/kevin/git/gxwtf_english/paddleocr-service')

# 读取图片
with open('/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg', 'rb') as f:
    image_bytes = f.read()

nparr = np.frombuffer(image_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
print(f"1. 原图: {img.shape if img is not None else 'None'}")

# 限制分辨率
MAX_DIM = 2000
h, w = img.shape[:2]
if max(h, w) > MAX_DIM:
    scale = MAX_DIM / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    print(f"   缩放到: {img.shape}")

# 透视变换
from server import auto_transform, remove_highlights_for_ocr, get_ocr, parse_ocr_result
t0 = time.time()
warped_img, transform_matrix = auto_transform(img)
print(f"2. 透视变换: {warped_img.shape if warped_img is not None else 'None'}, 耗时 {time.time()-t0:.2f}s")

# 去高亮
t0 = time.time()
clean_img = remove_highlights_for_ocr(warped_img)
print(f"3. 去高亮: {clean_img.shape if clean_img is not None else 'None'}, 耗时 {time.time()-t0:.2f}s")

# OCR
t0 = time.time()
engine = get_ocr()
print(f"4. OCR 引擎: {type(engine).__name__}, 耗时 {time.time()-t0:.2f}s")

t0 = time.time()
clean_result = engine.ocr(clean_img, cls=True)
clean_lines = parse_ocr_result(clean_result)
print(f"5. 去高亮图 OCR: {len(clean_lines)} 行, 耗时 {time.time()-t0:.2f}s")
for l in clean_lines[:5]:
    print(f"   - \"{l['text']}\"")

t0 = time.time()
raw_result = engine.ocr(warped_img, cls=True)
raw_lines = parse_ocr_result(raw_result)
print(f"6. 原图 OCR: {len(raw_lines)} 行, 耗时 {time.time()-t0:.2f}s")
for l in raw_lines[:5]:
    print(f"   - \"{l['text']}\"")

# 保存中间图片用于检查
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_warped.jpg', warped_img)
cv2.imwrite('/home/kevin/kevin/git/gxwtf_english/temp/debug_clean.jpg', clean_img)
print("7. 已保存 debug_warped.jpg 和 debug_clean.jpg")
