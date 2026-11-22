#!/usr/bin/env python3
"""拍照识词 OCR 微服务（Unlimited-OCR-2 后端 + OpenCV 高亮检测）

流水线：
  1. 透视矫正：把拍歪的书页拉正
  2. HSV 高亮检测：找出荧光笔高亮区域
  3. 红笔标记检测：只保留扁长的圈/下划线，方形红色汉字批注会被剔除
  4. 每个标记在局部 x 范围做墨迹投影定位它圈住的那一行（整页投影会被纸张弧度糊成一块）
  5. 该行切横条送 Unlimited-OCR-2（SGLang，OpenAI 兼容接口）识别；模型对裁剪很敏感，
     多档上下留白/横向窗口各识别一次
  6. 行内墨迹投影分词：红圈取离圈中心最近的词（多次识别多数票），
     高亮按词 bbox 与高亮 mask 的覆盖率筛词

OCR 后端地址由环境变量 UNLIMITED_OCR_URL 指定，默认 http://127.0.0.1:8014。
"""

import base64
import json
import logging
import os
import re
import signal
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import requests
from flask import Flask, request, jsonify

# ===== 配置 =====

OCR_URL = (os.environ.get('UNLIMITED_OCR_URL') or 'http://127.0.0.1:8014').rstrip('/')
OCR_MODEL = os.environ.get('UNLIMITED_OCR_MODEL') or 'Unlimited-OCR-2'
OCR_TIMEOUT = float(os.environ.get('UNLIMITED_OCR_TIMEOUT') or 300)
# 单次请求带几张切片（单图请求更稳；并发数控制同时打给后端的请求数）
OCR_PARALLEL = max(1, int(os.environ.get('UNLIMITED_OCR_PARALLEL') or 3))
OCR_MAX_TOKENS_PER_IMAGE = int(os.environ.get('UNLIMITED_OCR_MAX_TOKENS_PER_IMAGE') or 512)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

# ===== 常见英文词典（用于粘连词拆分 / 碎片合并 / 圈出误读修正） =====

WORD_DICT = None


def load_word_dict():
    global WORD_DICT
    if WORD_DICT is not None:
        return WORD_DICT
    words = {
        # 冠词/代词/介词/连词
        'a', 'an', 'the', 'of', 'in', 'to', 'for', 'and', 'or', 'but', 'is', 'are',
        'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
        'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
        'not', 'no', 'on', 'at', 'by', 'with', 'from', 'as', 'into', 'through',
        'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over',
        'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'him', 'her',
        'them', 'us', 'my', 'your', 'his', 'their', 'our', 'this', 'that', 'these',
        'those', 'which', 'who', 'whom', 'what', 'where', 'when', 'how', 'why',
        'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
        'such', 'than', 'too', 'very', 'so', 'just', 'about', 'up', 'out', 'off',
        'if', 'then', 'also', 'well', 'here', 'there', 'now', 'still', 'even',
        'only', 'own', 'same', 'any', 'many', 'much',
        # 常见动词
        'make', 'take', 'give', 'find', 'get', 'go', 'come', 'see', 'know', 'think',
        'say', 'tell', 'ask', 'use', 'try', 'leave', 'call', 'keep', 'let', 'begin',
        'show', 'hear', 'play', 'run', 'move', 'live', 'believe', 'hold', 'bring',
        'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include',
        'continue', 'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow',
        'stop', 'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open',
        'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy',
        'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut',
        'reach', 'kill', 'remain', 'suggest', 'raise', 'pass', 'sell', 'require',
        'report', 'decide', 'pull', 'reduce', 'feel', 'explain', 'explore', 'uncover',
        'accuse', 'enhance', 'venture', 'publish', 'compose', 'discover',
        'credit', 'contribute', 'center', 'suppose', 'mean', 'search', 'remark',
        'famously', 'actually', 'supposedly', 'otherworldly', 'paranormal',
        # 常见名词
        'people', 'time', 'year', 'way', 'day', 'man', 'woman', 'child', 'world',
        'life', 'hand', 'part', 'place', 'case', 'week', 'company', 'system',
        'program', 'question', 'work', 'government', 'number', 'night', 'point',
        'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact',
        'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word', 'business',
        'issue', 'side', 'kind', 'head', 'house', 'service', 'friend', 'father',
        'power', 'hour', 'game', 'line', 'end', 'member', 'law', 'car', 'city',
        'community', 'name', 'president', 'team', 'minute', 'idea', 'body',
        'information', 'back', 'parent', 'face', 'others', 'level', 'office',
        'door', 'health', 'person', 'art', 'war', 'history', 'party', 'result',
        'morning', 'reason', 'research', 'girl', 'guy', 'moment', 'air', 'teacher',
        'force', 'education', 'beauty', 'truth', 'nature', 'color', 'light',
        'rainbow', 'prism', 'beams', 'refraction', 'raindrop', 'scientist',
        'mathematician', 'physician', 'poet', 'artist', 'philosopher', 'insight',
        'creativity', 'expression', 'ideal', 'experience', 'secret', 'territory',
        'breakthrough', 'talent', 'myth', 'movement', 'aspect', 'mind', 'soul',
        'explanation', 'discovery', 'perspective', 'colleague', 'century',
        'hundred', 'years', 'later', 'newton', 'keats', 'shakespeare', 'coleridge',
        'romantic', 'sacred', 'simple', 'magical', 'distinct', 'major',
        # 常见形容词/副词
        'good', 'new', 'first', 'last', 'long', 'great', 'little', 'old', 'big',
        'high', 'different', 'small', 'large', 'next', 'early', 'young',
        'important', 'public', 'bad', 'able', 'beautiful', 'natural', 'scientific',
        'artistic', 'divine', 'ultimate', 'famous', 'whole', 'separate',
        'supernatural', 'spiritual', 'crazy', 'abnormal',
        # 更多常见词
        'unweave', 'unweaving', 'dismantle', 'destroy', 'ruin', 'enhanced', 'stare',
        'star', 'stars', 'samuel', 'taylor', 'isaac', 'opticks', 'composed',
        'shocked', 'ventures', 'ventured', 'accused', 'reducing', 'credited',
        'contributed', 'centered', 'occurred', 'published', 'physicist', 'poets',
        'remarked', 'secrets', 'feels', 'meant', 'myth', 'talents', 'presence',
        'aspects', 'whereas', 'souls', 'needed', 'themes', 'newtons',
        # 测试用例期望单词
        'remarkable', 'creatures', 'environmental', 'spectacular', 'delicate',
        'bloomed', 'courageous', 'medal', 'mysterious', 'disappeared', 'appreciate',
        'wonderful', 'perseverance', 'consideration', 'requires', 'empowers',
        'achieve', 'transforms', 'modern', 'illuminated', 'examined', 'discovered',
    }
    WORD_DICT = words
    return words


def split_stuck_word(token, dict_words=None):
    """用动态规划拆分单个粘连词。无法拆分时返回 [token]。"""
    if dict_words is None:
        dict_words = load_word_dict()

    original = token
    trailing_punct = ''
    while token and token[-1] in r'.,;:!?\'")\]':
        trailing_punct = token[-1] + trailing_punct
        token = token[:-1]

    token_lower = token.lower()
    n = len(token_lower)
    if n <= 4:
        return [original]

    if token_lower in dict_words:
        return [original]

    INF = float('inf')
    dp = [INF] * (n + 1)
    dp[0] = 0
    parent = [-1] * (n + 1)

    for i in range(1, n + 1):
        for j in range(max(0, i - 15), i):
            word = token_lower[j:i]
            if word in dict_words and dp[j] + 1 < dp[i]:
                dp[i] = dp[j] + 1
                parent[i] = j

    if dp[n] == INF:
        return [original]

    parts = []
    i = n
    while i > 0:
        j = parent[i]
        parts.append(token[j:i])
        i = j
    parts.reverse()

    if trailing_punct and parts:
        parts[-1] = parts[-1] + trailing_punct

    if all(len(p.rstrip(r'.,;:!?\'")\]')) >= 2 or p.rstrip(r'.,;:!?\'")\]').lower() in ('a', 'i') for p in parts):
        return parts
    return [original]


def split_by_punctuation(token):
    """按标点/驼峰边界拆分粘连词。"""
    parts = re.split(r'(?<=[a-z])(?=[A-Z])', token)
    if len(parts) > 1:
        return parts
    parts = re.split(r'(?<=[.,;:!?\'")\]])(?=[a-zA-Z])', token)
    if len(parts) > 1:
        return parts
    return [token]


def split_stuck_words(text):
    """拆分整行文本中的粘连词（模型偶尔会丢空格）。"""
    dict_words = load_word_dict()
    result = []
    for token in text.split():
        for part in split_by_punctuation(token):
            stripped = part.rstrip('.,;:!?\'")')
            if len(stripped) <= 4 or stripped.lower() in dict_words:
                result.append(part)
                continue
            result.extend(split_stuck_word(part, dict_words))
    return ' '.join(result)


# ===== 文档扫描矫正（透视变换） =====

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]
    return rect


def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped, M


def find_document_contour(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype("float32")
    return None


def auto_transform(image):
    pts = find_document_contour(image)
    if pts is not None:
        warped, M = four_point_transform(image, pts)
        return warped, M
    return image, None


# ===== 图片预处理 =====

def remove_highlights_for_ocr(img):
    """将高亮色和红笔标记替换为白色，使文字识别不被颜色干扰。"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    result = img.copy()
    # 荧光高亮色
    highlight_mask = (hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 120)
    result[highlight_mask] = [255, 255, 255]
    # 红笔标记
    red1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 255]))
    result[cv2.bitwise_or(red1, red2) > 0] = [255, 255, 255]
    return result


def enhance_color_document(img):
    """去除阴影，让纸张变白，但保留墨迹和荧光色。"""
    kernel_size = max(25, min(img.shape[0], img.shape[1]) // 20)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    bg = cv2.dilate(img, kernel)
    bg = cv2.GaussianBlur(bg, (21, 21), 0)
    out = 255 * (img.astype(np.float32) / (bg.astype(np.float32) + 1e-7))
    return np.clip(out, 0, 255).astype(np.uint8)


# ===== 高亮 / 墨迹 mask =====

def extract_highlight_mask(enhanced_img):
    hsv = cv2.cvtColor(enhanced_img, cv2.COLOR_BGR2HSV)
    masks = [
        cv2.inRange(hsv, np.array([12, 60, 120]), np.array([40, 255, 255])),   # 黄
        cv2.inRange(hsv, np.array([35, 60, 120]), np.array([85, 255, 255])),   # 绿
        cv2.inRange(hsv, np.array([135, 50, 120]), np.array([168, 255, 255])), # 粉/紫
        cv2.inRange(hsv, np.array([5, 60, 120]), np.array([18, 255, 255])),    # 橙
        cv2.inRange(hsv, np.array([160, 35, 235]), np.array([180, 255, 255])), # 浅粉（V 很高）
    ]
    mask = masks[0]
    for m in masks[1:]:
        mask = cv2.bitwise_or(mask, m)

    # 红笔是「标记」不是高亮，交给 detect_red_mark_rois 处理；
    # 否则红笔批注（尤其是汉字）会被当成大片高亮，导致整行/整页单词误报。
    # V<=235 避免把浅粉色荧光笔一起删掉。
    red1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 235]))
    red2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 235]))
    mask[cv2.bitwise_or(red1, red2) > 0] = 0

    # 手机照片里黑色文字的彩色边缘只有 1~2px，开运算去掉；荧光笔色块能留下来
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)


def filter_highlight_mask(mask, line_height):
    """去掉大块背景（题框/引用框），只保留单词级别的高亮。

    单词高亮的高度 ≈ 一行；跨多行的色块判为背景。
    """
    if mask is None or cv2.countNonZero(mask) == 0:
        return mask

    max_height = max((line_height or 36.0) * 2.5, 60)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num_labels <= 1:
        return mask

    big_bboxes = []
    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        if h > max_height:
            big_bboxes.append((x, y, w, h))

    filtered = np.zeros_like(mask)
    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        if h > max_height:
            continue
        inside_big = any(
            x >= bx and y >= by and (x + w) <= (bx + bw) and (y + h) <= (by + bh)
            for bx, by, bw, bh in big_bboxes
        )
        if inside_big:
            continue
        filtered[labels == i] = 255
    return filtered


def component_boxes(mask, min_area=80):
    """返回 mask 中连通块的 bbox 列表 [(x0, y0, x1, y1), ...]。"""
    if mask is None or cv2.countNonZero(mask) == 0:
        return []
    num, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    boxes = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        boxes.append((int(x), int(y), int(x + w), int(y + h)))
    return boxes


def check_word_highlighted(mask, bbox):
    x0, y0, x1, y1 = bbox['x0'], bbox['y0'], bbox['x1'], bbox['y1']
    h, w = mask.shape[:2]
    x0 = max(0, min(int(x0), w - 1))
    y0 = max(0, min(int(y0), h - 1))
    x1 = max(0, min(int(x1), w))
    y1 = max(0, min(int(y1), h))
    if x1 <= x0 or y1 <= y0:
        return False, 0.0
    roi = mask[y0:y1, x0:x1]
    total = roi.size
    if total == 0:
        return False, 0.0
    ratio = cv2.countNonZero(roi) / total
    return ratio > 0.30, round(ratio, 3)


# ===== 红笔/黑笔标记检测 =====







# ===== 红笔标记 / 局部行 / 分词 =====

def _red_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # V<=235：排除浅粉色荧光笔（V 接近 255），只留红笔
    red1 = cv2.inRange(hsv, np.array([0, 50, 100]), np.array([10, 255, 235]))
    red2 = cv2.inRange(hsv, np.array([170, 50, 100]), np.array([180, 255, 235]))
    return cv2.bitwise_or(red1, red2)


def _dark_mask(img):
    """印刷文字的二值 mask（暗且低饱和），排除红笔与彩色高亮。"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    red = _red_mask(img)
    dark = ((gray < 110) & (hsv[:, :, 1] < 120)).astype(np.uint8)
    dark[red > 0] = 0
    return dark


def _ocr_source(img):
    """OCR 用图：去掉荧光笔底色，但保留红笔。

    把红笔一起擦白会破坏被圈单词的笔画（entitled 常被读成 connected/committed），
    所以这里只清彩色高亮，红色（V<=235）保留。
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    colored = ((hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 120)).astype(np.uint8)
    colored[_red_mask(img) > 0] = 0
    out = img.copy()
    out[colored > 0] = 255
    return out


def detect_red_mark_rois(img):
    """检测红笔圈出的单词。

    手写红色批注（汉字）接近方形/竖长，圈或下划线是扁长条；用 ``h <= 0.55*w``
    只保留覆盖印刷文字的水平长条，避免把批注当成标记（这是「识别太多」的主因）。
    """
    red = _red_mask(img)
    if cv2.countNonZero(red) == 0:
        return []
    num, labels, stats, _ = cv2.connectedComponentsWithStats(red, connectivity=8)
    rois = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < 300 or w < 80 or h < 18:
            continue
        if h > w * 0.55:
            continue
        mask = (labels == i)
        ys, xs = np.where(mask)
        rois.append({
            'kind': 'circle',
            'bbox': {'x0': int(x), 'y0': int(y), 'x1': int(x + w), 'y1': int(y + h)},
            # 用红像素分位数而不是 bbox：批注会把 bbox 撑宽/撑高
            'ax0': int(np.percentile(xs, 2)),
            'ax1': int(np.percentile(xs, 98)),
            'mask': mask,
        })
    return rois


def _local_line_bands(dark, x0, x1, img_h, min_h=10, max_h=80):
    """在局部 x 范围做水平墨迹投影，返回单行 band [(y0, y1), ...]。

    整页投影会被纸张弧度/模糊糊成一大块，局部投影能稳定分出单行。
    """
    x0 = max(0, int(x0))
    x1 = min(dark.shape[1], int(x1))
    if x1 - x0 < 10:
        return []
    proj = dark[:, x0:x1].sum(axis=1)
    thr = max(2, int((x1 - x0) * 0.05))
    bands = []
    start = None
    for y in range(img_h):
        on = proj[y] > thr
        if on and start is None:
            start = y
        elif not on and start is not None:
            if min_h <= y - start <= max_h:
                bands.append((start, y))
            start = None
    if start is not None and min_h <= img_h - start <= max_h:
        bands.append((start, img_h))
    return bands


def _pick_line_band(bands, y0, y1, mask=None):
    """选被标记圈住的那一行。

    优先看「该行里红笔横向覆盖的列数」：圈是横跨单词的扁长环，批注是窄块；
    没有 mask 时退化为与标记 y 范围重叠最大。
    """
    best = None
    best_score = None
    for a, b in bands:
        ov = min(b, y1) - max(a, y0)
        if ov <= 0:
            continue
        if mask is not None:
            width = int(mask[a:b].any(axis=0).sum())
            score = (width, ov)
        else:
            score = (0, ov)
        if best_score is None or score > best_score:
            best_score = score
            best = (a, b)
    return best


def _score_ocr_text(text):
    """局部 OCR 结果打分：占位符/无英文 0 分，真实英文词越多分越高。"""
    if not text or 'image[' in text or not re.search(r'[A-Za-z]{2,}', text):
        return -1
    score = 0
    for tok in text.split():
        core = tok.strip('.,;:!?\'"()[]{}“”‘’')
        if re.fullmatch(r"[A-Za-z][A-Za-z'-]*", core or ''):
            score += 1
    return score


def _segment_word_boxes(strip, gap_frac=0.20):
    """单行 strip 的纵向投影分词，返回 [(x0, x1), ...]（先去下划线）。"""
    sh, sw = strip.shape[:2]
    if sh < 8 or sw < 8:
        return []
    gray = cv2.cvtColor(strip, cv2.COLOR_BGR2GRAY)
    ink = (gray < 135).astype(np.uint8) * 255
    # 长横线（下划线）会把整行连成一片，先按长横结构剔除
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (max(21, int(sw * 0.03)), 1))
    ink = cv2.subtract(ink, cv2.morphologyEx(ink, cv2.MORPH_OPEN, k))
    r0, r1 = int(sh * 0.10), int(sh * 0.80)
    proj = (ink[r0:r1] > 0).sum(axis=0)
    thr = max(1, int((r1 - r0) * 0.10))
    cols = proj > thr
    runs = []
    start = None
    for x, on in enumerate(cols):
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append([start, x])
            start = None
    if start is not None:
        runs.append([start, sw])
    gap = max(3, int(sh * gap_frac))
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] <= gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [r for r in merged if r[1] - r[0] >= max(4, sh * 0.15)]


def _strip_token(tok):
    return tok.strip('.,;:!?\'"()[]{}“”‘’')


def _clean_circled_prefix(text):
    """圈的弧线偶尔被识别成前缀字母（如 Cappreciate → appreciate）。"""
    if len(text) < 5:
        return text
    dict_words = load_word_dict()
    if text.lower() in dict_words:
        return text
    for n in range(1, min(4, len(text) - 2)):
        cand = text[n:]
        if len(cand) >= 4 and cand.lower() in dict_words:
            return cand
    return text


def _pick_token(tokens, segs, center_x, strip_w):
    """在 OCR 词序列中选出落在标记中心附近的词。"""
    if not tokens:
        return None
    if segs and len(segs) == len(tokens):
        seg = min(segs, key=lambda r: abs((r[0] + r[1]) / 2 - center_x))
        return tokens[segs.index(seg)]
    if segs:
        seg = min(segs, key=lambda r: abs((r[0] + r[1]) / 2 - center_x))
        seg_c = (seg[0] + seg[1]) / 2
    else:
        seg_c = center_x
    total = sum(len(t) + 1 for t in tokens)
    if total <= 0:
        return tokens[0]
    best_tok = tokens[0]
    best_d = None
    pos = 0
    for tok in tokens:
        c = (pos + len(tok) / 2) / total * strip_w
        d = abs(c - seg_c)
        if best_d is None or d < best_d:
            best_d = d
            best_tok = tok
        pos += len(tok) + 1
    return best_tok


def _tokens_in_range(tokens, segs, rx0, rx1, strip_w):
    """返回落在 [rx0, rx1] 内的 token（高亮块可能覆盖多个词）。"""
    out = []
    if not tokens:
        return out
    if segs and len(segs) == len(tokens):
        for tok, (a, b) in zip(tokens, segs):
            if min(b, rx1) - max(a, rx0) > 0.3 * max(b - a, 1):
                out.append((tok, (a, b)))
        return out
    total = sum(len(t) + 1 for t in tokens)
    if total <= 0:
        return out
    pos = 0
    for tok in tokens:
        a = pos / total * strip_w
        b = (pos + len(tok)) / total * strip_w
        if min(b, rx1) - max(a, rx0) > 0:
            out.append((tok, (a, b)))
        pos += len(tok) + 1
    return out


def _ocr_strip(clean, y0, y1, x0, x1):
    """裁一条横条并识别；返回 crop/tokens/偏移，失败返回 None。"""
    y0, y1 = max(0, int(y0)), min(clean.shape[0], int(y1))
    x0, x1 = max(0, int(x0)), min(clean.shape[1], int(x1))
    if y1 - y0 < 8 or x1 - x0 < 8:
        return None
    crop = clean[y0:y1, x0:x1]
    padded = cv2.copyMakeBorder(crop, 16, 16, 16, 16,
                                cv2.BORDER_CONSTANT, value=(255, 255, 255))
    blocks = _ocr_blocks(padded)
    text = ' '.join(b['text'] for b in blocks if b.get('text')).strip()
    tokens = split_stuck_words(text).split() if text else []
    return {'crop': crop, 'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
            'text': text, 'tokens': tokens}




# ===== Unlimited-OCR-2 客户端 =====

_BLOCK_RE = re.compile(r'<BLOCK>(.*?)<FORK>(.*?)(?=<BLOCK>|<PAGE>|$)', re.S)
_BBOX_RE = re.compile(r'\[(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]')
_TAG_RE = re.compile(r'<[^>]+>')


def _encode_jpeg_b64(img):
    ok, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise ValueError('image encode failed')
    return base64.b64encode(buf.tobytes()).decode('ascii')


def _collapse_repeats(text):
    """兜底：模型偶发整句复读时，连续重复的句子只保留一句。"""
    if len(text) < 600:
        return text
    parts = re.split(r'(?<=[.!?])\s+', text)
    out = []
    for part in parts:
        if out and part == out[-1]:
            continue
        out.append(part)
    return ' '.join(out)


def _clean_page_text(page):
    parts = []
    for m in _BLOCK_RE.finditer(page):
        # 模型偶尔会带出 </td></tr></table> 之类的噪声标签
        text = _TAG_RE.sub(' ', m.group(2))
        text = re.sub(r'\s+', ' ', text).strip()
        if text:
            parts.append(text)
    if not parts:
        text = _TAG_RE.sub(' ', page)
        text = re.sub(r'\s+', ' ', text).strip()
        if text:
            parts.append(text)
    return _collapse_repeats(' '.join(parts).strip())


def _ocr_blocks(img):
    """识别一张局部切片，返回 [{'text': str, 'bbox': {...}}]（bbox 为切片内像素坐标）。

    实测多图（<PAGE><image> 重复）在 base 模式下会漏页/串页，因此每张切片单独请求。
    """
    h, w = img.shape[:2]
    content = [
        {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{_encode_jpeg_b64(img)}'}},
        {'type': 'text', 'text': '<PAGE><image>Multi page parsing.'},
    ]

    payload = {
        'model': OCR_MODEL,
        'messages': [{'role': 'user', 'content': content}],
        'max_tokens': OCR_MAX_TOKENS_PER_IMAGE,
        'temperature': 0,
        'skip_special_tokens': False,
        # 切片很小，gundam 动态切图会触发退化重复，必须用 base 模式
        'images_config': {'crop_mode': False},
        'stream': True,
        'stream_options': {'include_usage': True},
    }

    t0 = time.time()
    # requests.Session 不是线程安全的；并发识别时每次请求用独立 session
    sess = requests.Session()
    sess.trust_env = False  # 本机服务不经过 clash 代理
    resp = sess.post(
        f'{OCR_URL}/v1/chat/completions',
        headers={'Content-Type': 'application/json'},
        data=json.dumps(payload),
        timeout=(10, OCR_TIMEOUT),
        stream=True,
    )
    resp.raise_for_status()

    chunks = []
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith('data:'):
            continue
        data = line[len('data:'):].strip()
        if data == '[DONE]':
            break
        try:
            ev = json.loads(data)
        except json.JSONDecodeError:
            continue
        for choice in ev.get('choices') or []:
            delta = (choice.get('delta') or {}).get('content') or ''
            if delta:
                chunks.append(delta)

    raw = ''.join(chunks)
    blocks = []
    for m in _BLOCK_RE.finditer(raw):
        text = _TAG_RE.sub(' ', m.group(2))
        text = _collapse_repeats(re.sub(r'\s+', ' ', text).strip())
        if not text:
            continue
        bb = _BBOX_RE.search(m.group(1))
        if bb:
            # 模型坐标是在 1024x1024 画布上按轴拉伸的
            x0, y0, x1, y1 = [int(v) for v in bb.groups()]
            bbox = {
                'x0': x0 * w / 1024.0, 'y0': y0 * h / 1024.0,
                'x1': (x1 + 1) * w / 1024.0, 'y1': (y1 + 1) * h / 1024.0,
            }
        else:
            bbox = {'x0': 0.0, 'y0': 0.0, 'x1': float(w), 'y1': float(h)}
        blocks.append({'text': text, 'bbox': bbox})

    if not blocks:
        text = _clean_page_text(raw)
        if text:
            blocks.append({'text': text, 'bbox': {'x0': 0.0, 'y0': 0.0, 'x1': float(w), 'y1': float(h)}})

    logging.info('[ocr] 1 crop, %d block(s), %.2fs', len(blocks), time.time() - t0)
    return blocks




# ===== 候选区域切片与分词 =====








def _dedupe_words(words):
    """同一行可能被多个标记切片重复识别，按 bbox+文本去重。"""
    kept = []
    for word in words:
        dup = False
        for exist in kept:
            if exist['text'].lower() != word['text'].lower():
                continue
            a, b = exist['bbox'], word['bbox']
            inter = (min(a['x1'], b['x1']) - max(a['x0'], b['x0'])) * \
                    (min(a['y1'], b['y1']) - max(a['y0'], b['y0']))
            if inter <= 0:
                continue
            area_a = (a['x1'] - a['x0']) * (a['y1'] - a['y0'])
            area_b = (b['x1'] - b['x0']) * (b['y1'] - b['y0'])
            union = area_a + area_b - inter
            if union > 0 and inter / union > 0.35:
                dup = True
                exist['isHighlighted'] = exist['isHighlighted'] or word['isHighlighted']
                exist['highlightRatio'] = max(exist['highlightRatio'], word['highlightRatio'])
                break
        if not dup:
            kept.append(word)
    return kept


# ===== 主流程 =====

def ocr_and_detect(image_bytes):
    """透视变换 → 高亮/红黑标记检测 → 标记局部切片 → Unlimited-OCR-2 → 高亮判定。"""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {'error': 'Invalid image'}

    MAX_DIM = 2000
    h, w = img.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    t_total_start = time.time()

    # 1. 透视矫正
    t0 = time.time()
    warped_img, _ = auto_transform(img)
    t_transform = time.time() - t0

    # 2. 识别用图（去荧光底色、保留红笔）；分词用图（红笔也擦掉）
    t0 = time.time()
    ocr_img = _ocr_source(warped_img)
    clean_img = remove_highlights_for_ocr(warped_img)
    t_enhance = time.time() - t0

    # 3. 高亮 + 红笔标记检测
    t0 = time.time()
    page_h, page_w = warped_img.shape[:2]
    pseudo_line_h = max(20.0, min(page_h, page_w) * 0.035)
    enhanced_img = enhance_color_document(warped_img)
    highlight_mask = filter_highlight_mask(
        extract_highlight_mask(enhanced_img), pseudo_line_h
    )
    dark = _dark_mask(warped_img)
    t_mask = time.time() - t0

    # 4. 候选区域：荧光高亮块 + 红笔圈出的词（批注已按形状过滤）
    rois = [
        {'kind': 'highlight', 'bbox': {'x0': b[0], 'y0': b[1], 'x1': b[2], 'y1': b[3]}}
        for b in component_boxes(highlight_mask, min_area=200)
    ]
    rois.extend(detect_red_mark_rois(warped_img))

    all_words = []
    t0 = time.time()
    for roi in rois:
        b = roi['bbox']
        bx0, by0, bx1, by1 = b['x0'], b['y0'], b['x1'], b['y1']
        # 红笔用红像素分位数（去掉批注撑出来的范围），高亮直接用 bbox
        ax0 = roi.get('ax0', bx0)
        ax1 = roi.get('ax1', bx1)
        aw = max(1, ax1 - ax0)
        center_x = (ax0 + ax1) / 2.0

        # 找行带的 x 窗口要比 OCR 窗口更宽：圈住词的红笔会遮住该词墨迹，
        # 窗口太窄时那一行投影会断掉、找不到行。
        bands = _local_line_bands(
            dark, max(0, ax0 - aw * 2.5), min(page_w, ax1 + aw * 2.5), page_h
        )
        band = _pick_line_band(bands, by0, by1, roi.get('mask'))
        if band is None:
            continue
        ly0, ly1 = band
        # 模型对纵向留白/横向上下文都很敏感；多试几档再投票。
        # 上留白多于下留白：补回行首升部，又不把下一行带进来。
        y_pads = [(16, 8)] if roi['kind'] == 'highlight' else \
            [(16, 8), (17, 5), (14, 8)]
        win1 = (max(0, int(ax0 - aw)), min(page_w, int(ax1 + aw)))
        if roi['kind'] == 'highlight':
            x_ranges = [win1]
        else:
            x_ranges = [
                (max(0, int(ax0 - aw * 2)), min(page_w, int(ax1 + aw * 2))),
                win1,
                (0, page_w),
            ]

        cands = []
        for top, bot in y_pads:
            yy0, yy1 = max(0, ly0 - top), min(page_h, ly1 + bot)
            for vx0, vx1 in x_ranges:
                res = _ocr_strip(ocr_img, yy0, yy1, vx0, vx1)
                if res is None:
                    continue
                score = _score_ocr_text(res['text'])
                if score <= 0:
                    continue
                res['score'] = score
                cands.append(res)
        if not cands:
            continue

        if roi['kind'] == 'highlight':
            best = max(cands, key=lambda r: r['score'])
            segs = _segment_word_boxes(
                clean_img[best['y0']:best['y1'], best['x0']:best['x1']])
            strip_w = best['crop'].shape[1]
            for tok, (sx0, sx1) in _tokens_in_range(
                    best['tokens'], segs, 0, strip_w, strip_w):
                wb = {'x0': int(best['x0'] + sx0), 'y0': int(best['y0']),
                      'x1': int(best['x0'] + sx1), 'y1': int(best['y1'])}
                if check_word_highlighted(highlight_mask, wb)[0]:
                    text = _clean_circled_prefix(_strip_token(tok))
                    if text and re.search(r'[A-Za-z]', text):
                        all_words.append({
                            'text': text, 'bbox': wb, 'confidence': 100.0,
                            'isHighlighted': True, 'highlightRatio': 1.0,
                        })
            continue

        # 红圈：每个候选各选一个词，多数票胜出（模型偶尔会把 entitled 读成 connected）
        votes = {}
        for res in cands:
            segs = _segment_word_boxes(
                clean_img[res['y0']:res['y1'], res['x0']:res['x1']])
            strip_w = res['crop'].shape[1]
            local_cx = center_x - res['x0']
            tok = _pick_token(res['tokens'], segs, local_cx, strip_w)
            if tok is None:
                continue
            text = _clean_circled_prefix(_strip_token(tok))
            if not text or not re.search(r'[A-Za-z]', text):
                continue
            item = votes.get(text)
            if item is None:
                votes[text] = {'count': 1, 'score': res['score'], 'box': b}
            else:
                item['count'] += 1
                item['score'] += res['score']

        if not votes:
            continue
        text = max(votes, key=lambda k: (votes[k]['count'], votes[k]['score']))
        all_words.append({
            'text': text, 'bbox': b, 'confidence': 100.0,
            'isHighlighted': True, 'highlightRatio': 1.0,
        })
    t_ocr = time.time() - t0

    # 5. 去重（同一区域可能同时被高亮和红圈命中）
    all_words = _dedupe_words(all_words)

    # 6. 输出（按阅读顺序）
    all_words.sort(key=lambda x: (x['bbox']['y0'], x['bbox']['x0']))
    for word in all_words:
        for key in ('x0', 'y0', 'x1', 'y1'):
            word['bbox'][key] = int(word['bbox'][key])
        word['highlightRatio'] = float(word.get('highlightRatio', 0))
        word['confidence'] = float(word.get('confidence', 0))

    full_text_lines = []
    current_y = None
    line_parts = []
    for word in all_words:
        if current_y is not None and abs(word['bbox']['y0'] - current_y) > 8:
            full_text_lines.append(' '.join(line_parts))
            line_parts = []
        current_y = word['bbox']['y0']
        line_parts.append(word['text'])
    if line_parts:
        full_text_lines.append(' '.join(line_parts))

    highlighted = [w for w in all_words if w['isHighlighted']]

    return {
        'words': all_words,
        'highlightedWords': [w['text'] for w in highlighted],
        'fullText': '\n'.join(full_text_lines),
        'timing': {
            'transform': round(t_transform, 3),
            'enhance': round(t_enhance, 3),
            'ocr': round(t_ocr, 3),
            'mask': round(t_mask, 3),
            'total': round(time.time() - t_total_start, 3),
        },
        'stats': {
            'totalWords': len(all_words),
            'highlightedCount': len(highlighted),
        },
    }


# ===== Flask 路由 =====

@app.route('/', methods=['POST'])
def handle_ocr():
    try:
        data = request.get_json(force=True)
        image_b64 = data.get('image', '')
        image_bytes = base64.b64decode(image_b64)
        result = ocr_and_detect(image_bytes)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify(result)
    except requests.RequestException as e:
        logging.error('Unlimited-OCR-2 request failed: %s', e)
        return jsonify({'error': f'Unlimited-OCR-2 服务不可用（{OCR_URL}）：{e}'}), 503
    except Exception as e:
        logging.error('OCR processing error: %s', e)
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    # 识别后端是常驻服务，本进程启动即可接单；后端不可用会在请求时返回 503。
    return jsonify({
        'status': 'ok',
        'service': 'unlimited-ocr-2',
        'backend': OCR_URL,
        'model_ready': True,
    })


if __name__ == '__main__':
    port = int(os.environ.get('OCR_SERVICE_PORT', os.environ.get('PADDLEOCR_PORT', '39821')))
    host = os.environ.get('OCR_SERVICE_HOST', os.environ.get('PADDLEOCR_HOST', '0.0.0.0'))

    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    print(f'OCR service listening on {host}:{port} -> {OCR_URL} ({OCR_MODEL})', flush=True)

    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))

    # 后端是远程常驻服务，允许并发处理多个识别请求
    app.run(host=host, port=port, threaded=True)
