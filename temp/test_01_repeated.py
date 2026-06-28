#!/usr/bin/env python3
"""反复测试 01.jpg - 排除偶然因素对识别结果的影响

后端：直接调用 PaddleOCR 服务 10 次，统计每次结果
"""
import base64
import sys
import time
import requests
from collections import Counter

IMG_PATH = '/home/kevin/kevin/git/gxwtf_english/temp/tests/01.jpg'
SERVER = 'http://127.0.0.1:39821'
N = 10

with open(IMG_PATH, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

print(f'=== 后端反复测试: 01.jpg x {N} 次 ===\n')

results = []
all_words_per_run = []
timings = []
errors = []

for i in range(1, N + 1):
    t0 = time.time()
    try:
        resp = requests.post(
            SERVER,
            json={'image': img_b64},
            proxies={'http': None, 'https': None},
            timeout=120,
        )
        data = resp.json()
        if data.get('error'):
            errors.append(f'Run {i}: server error: {data["error"]}')
            print(f'[Run {i:2d}] ERROR: {data["error"]}')
            continue

        highlighted = [w['text'] for w in data['words'] if w['isHighlighted']]
        all_texts = [w['text'] for w in data['words']]
        elapsed = time.time() - t0
        server_total = data['timing']['total']

        results.append({
            'run': i,
            'highlighted': highlighted,
            'total_words': len(all_texts),
            'elapsed': elapsed,
            'server_total': server_total,
        })
        all_words_per_run.append(set(all_texts))
        timings.append(server_total)

        print(f'[Run {i:2d}] 高亮={highlighted}  总词数={len(all_texts)}  耗时={server_total:.2f}s')

    except Exception as e:
        errors.append(f'Run {i}: exception: {e}')
        print(f'[Run {i:2d}] EXCEPTION: {e}')

# 分析结果
print(f'\n=== 稳定性分析 ===')
print(f'成功: {len(results)}/{N}')
if errors:
    print(f'错误: {len(errors)}')
    for e in errors:
        print(f'  - {e}')

if results:
    # 高亮词稳定性
    highlighted_tuples = [tuple(sorted(r['highlighted'])) for r in results]
    counter = Counter(highlighted_tuples)
    print(f'\n高亮词组合分布:')
    for combo, cnt in counter.most_common():
        print(f'  {list(combo)}: {cnt}/{len(results)} ({cnt*100//len(results)}%)')

    # 总词数稳定性
    word_counts = [r['total_words'] for r in results]
    print(f'\n总词数: min={min(word_counts)} max={max(word_counts)} avg={sum(word_counts)/len(word_counts):.1f}')

    # 耗时稳定性
    print(f'耗时: min={min(timings):.2f}s max={max(timings):.2f}s avg={sum(timings)/len(timings):.2f}s')

    # 关键词出现率
    expected = ['divine', 'divorce', 'beams', 'prism']
    print(f'\n关键词出现率:')
    for kw in expected:
        cnt = sum(1 for r in results if kw in [w.lower() for w in r['highlighted']])
        print(f'  {kw}: {cnt}/{len(results)} ({cnt*100//len(results)}%)')

    # 检查 neprsmofa 是否复现
    bad_cnt = sum(1 for r in results if any('neprsmofa' in w.lower() for w in r['highlighted']))
    print(f'\nneprsmofa 误识别复现: {bad_cnt}/{len(results)}')

    # 词集合一致性（Jaccard 相似度）
    if len(all_words_per_run) >= 2:
        base = all_words_per_run[0]
        similarities = []
        for s in all_words_per_run[1:]:
            union = base | s
            if union:
                sim = len(base & s) / len(union)
            else:
                sim = 1.0
            similarities.append(sim)
        print(f'\n词集合 Jaccard 相似度 (vs Run 1): min={min(similarities):.3f} max={max(similarities):.3f} avg={sum(similarities)/len(similarities):.3f}')

# 最终结论
print(f'\n=== 最终结论 ===')
if results and bad_cnt == 0:
    expected_set = {'divine', 'divorce', 'beams', 'prism'}
    all_pass = True
    for r in results:
        actual_set = {w.lower() for w in r['highlighted']}
        if actual_set != expected_set:
            all_pass = False
            break
    if all_pass:
        print(f'PASS: {len(results)}/{len(results)} 次运行结果完全一致 = {{divine, divorce, beams, prism}}，无 neprsmofa 误识别')
    else:
        print(f'WARN: 结果存在波动，详见上方分布')
else:
    print(f'FAIL: 存在错误或 neprsmofa 复现')
