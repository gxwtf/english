#!/usr/bin/env python3
"""OCR 高亮识别测试脚本 - 测试所有用例并生成报告"""
import base64, json, urllib.request, os, sys, time

SERVER = 'http://localhost:39821/'
TEST_DIR = '/home/kevin/kevin/git/gxwtf_english/temp/tests'

def call_ocr(image_path, timeout=120):
    """调用 OCR API，返回结果字典"""
    with open(image_path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode()
    req = urllib.request.Request(SERVER,
        data=json.dumps({'image': img_b64}).encode(),
        headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(resp.read())

def normalize_word(w):
    """标准化单词用于比较（小写、去标点）"""
    import re
    return re.sub(r'[^a-z]', '', w.lower())

def compare_words(actual, expected):
    """比较实际识别和期望的单词列表，返回匹配详情"""
    actual_norm = {normalize_word(w) for w in actual}
    expected_norm = {normalize_word(w) for w in expected}

    matched = expected_norm & actual_norm
    missing = expected_norm - actual_norm
    extra = actual_norm - expected_norm

    return {
        'matched': sorted(matched),
        'missing': sorted(missing),
        'extra': sorted(extra),
        'precision': len(matched) / len(actual_norm) if actual_norm else 0,
        'recall': len(matched) / len(expected_norm) if expected_norm else 1,
    }

def run_test(filename, expected_words, style):
    """运行单个测试用例"""
    image_path = os.path.join(TEST_DIR, filename)
    if not os.path.exists(image_path):
        return {'filename': filename, 'status': 'SKIP', 'error': '文件不存在'}

    t0 = time.time()
    try:
        result = call_ocr(image_path)
        elapsed = time.time() - t0

        actual_words = result.get('highlightedWords', [])
        stats = result.get('stats', {})
        timing = result.get('timing', {})

        cmp = compare_words(actual_words, expected_words)

        # 判定状态
        if cmp['recall'] == 1.0 and len(cmp['extra']) == 0:
            status = 'PASS'
        elif cmp['recall'] == 1.0:
            status = 'PASS_WITH_EXTRA'
        elif cmp['recall'] >= 0.5:
            status = 'PARTIAL'
        else:
            status = 'FAIL'

        return {
            'filename': filename,
            'name': style,
            'status': status,
            'expected': expected_words,
            'actual': actual_words,
            'matched': cmp['matched'],
            'missing': cmp['missing'],
            'extra': cmp['extra'],
            'precision': round(cmp['precision'], 2),
            'recall': round(cmp['recall'], 2),
            'total_words': stats.get('totalWords', 0),
            'highlighted_count': stats.get('highlightedCount', 0),
            'elapsed': round(elapsed, 1),
            'timing': timing,
        }
    except Exception as e:
        return {'filename': filename, 'status': 'ERROR', 'error': str(e)}

def main():
    # 读取 manifest
    with open(os.path.join(TEST_DIR, 'manifest.json')) as f:
        manifest = json.load(f)

    results = []
    pass_count = 0
    total = len(manifest)

    print(f"{'='*80}")
    print(f"OCR 高亮识别测试 - {total} 个用例")
    print(f"{'='*80}\n")

    for case in manifest:
        filename = case['filename']
        expected = case['expectedWords']
        style = case['name']

        print(f"[测试] {style} ({filename})")
        print(f"  期望: {expected if expected else '（无高亮）'}")

        result = run_test(filename, expected, style)
        results.append(result)

        if result['status'] in ('PASS',):
            pass_count += 1
            marker = '✓'
        elif result['status'] == 'PASS_WITH_EXTRA':
            pass_count += 1
            marker = '✓~'
        elif result['status'] == 'PARTIAL':
            marker = '△'
        else:
            marker = '✗'

        actual = result.get('actual', [])
        print(f"  实际: {actual if actual else '（无）'}")
        print(f"  结果: {marker} {result['status']} "
              f"(匹配={result.get('matched',[])}, 缺失={result.get('missing',[])}, "
              f"多余={result.get('extra',[])}, 耗时={result.get('elapsed',0)}s)")
        print()

    # 总结
    print(f"{'='*80}")
    print(f"测试总结: {pass_count}/{total} 通过")
    print(f"{'='*80}")

    # 详细统计
    status_counts = {}
    for r in results:
        s = r['status']
        status_counts[s] = status_counts.get(s, 0) + 1
    print(f"状态分布: {status_counts}")

    # 保存报告
    report_path = os.path.join(TEST_DIR, 'test-report.json')
    with open(report_path, 'w') as f:
        json.dump({
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'total': total,
            'passed': pass_count,
            'results': results,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n报告已保存: {report_path}")

    return 0 if pass_count == total else 1

if __name__ == '__main__':
    sys.exit(main())
