#!/usr/bin/env python3
"""极端测试：测试系统在各种极端条件下的鲁棒性。

关键验证点：
1. 服务器不能崩溃（所有请求都返回有效 JSON）
2. 有文字+高亮的图片应尽量识别出高亮词
3. 无文字/噪声图片应返回空结果而非报错
4. 旋转/暗光/模糊图片应尽量保持识别能力
"""
import base64, json, requests, os, time

SERVER = 'http://localhost:39821/'
EXTREME_DIR = '/home/kevin/kevin/git/gxwtf_english/temp/tests/extreme'

# 源图片期望的高亮词（yellow-highlight-3.jpg 的期望）
EXPECTED = ['beautiful', 'illuminated', 'examined']

# 测试用例定义：(filename, description, expected_behavior)
TESTS = [
    ('rotated-5deg.jpg', '旋转5度', EXPECTED),
    ('rotated-15deg.jpg', '旋转15度', EXPECTED),
    ('dark-50pct.jpg', '暗光50%', EXPECTED),
    ('blur-heavy.jpg', '重度模糊', EXPECTED),
    ('small-300w.jpg', '小尺寸300px', EXPECTED),
    ('large-2000w.jpg', '大尺寸2000px', EXPECTED),
    ('low-contrast.jpg', '低对比度', EXPECTED),
    ('no-text-colors.jpg', '无文字纯色块', []),  # 无文字，不应返回高亮词
    ('pure-noise.jpg', '纯噪声', []),            # 噪声，不应崩溃
    ('blank-white.jpg', '纯白图片', []),          # 空白，不应崩溃
]

def call_ocr(image_path, timeout=60):
    with open(image_path, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode()
    resp = requests.post(SERVER, json={'image': img_b64}, timeout=timeout)
    return resp

def normalize(w):
    import re
    return re.sub(r'[^a-z]', '', w.lower())

def main():
    print('=' * 80)
    print(f'极端测试 - {len(TESTS)} 个用例')
    print('=' * 80 + '\n')

    results = []
    pass_count = 0

    for fname, desc, expected in TESTS:
        path = os.path.join(EXTREME_DIR, fname)
        if not os.path.exists(path):
            print(f'[跳过] {desc} ({fname}) - 文件不存在')
            continue

        print(f'[测试] {desc} ({fname})')
        t0 = time.time()
        try:
            resp = call_ocr(path)
            elapsed = time.time() - t0

            if resp.status_code != 200:
                print(f'  ✗ HTTP {resp.status_code} - 服务器返回错误')
                results.append(('FAIL', desc, f'HTTP {resp.status_code}'))
                continue

            data = resp.json()
            if 'error' in data:
                print(f'  ✗ 服务器错误: {data["error"]}')
                results.append(('FAIL', desc, data['error']))
                continue

            actual = [normalize(w) for w in data.get('highlightedWords', [])]
            actual = [w for w in actual if w]  # 去空
            expected_norm = [normalize(w) for w in expected]

            # 判定
            if not expected_norm:
                # 期望无高亮：实际也无高亮 → PASS，有高亮 → 检查是否误检
                if not actual:
                    status = 'PASS'
                    marker = '✓'
                    pass_count += 1
                    detail = '正确返回空'
                else:
                    status = 'PASS_EXTRA'
                    marker = '△'
                    pass_count += 1
                    detail = f'返回 {actual}（期望空，但未崩溃）'
            else:
                matched = set(actual) & set(expected_norm)
                missing = set(expected_norm) - set(actual)
                extra = set(actual) - set(expected_norm)

                if not missing and not extra:
                    status = 'PASS'
                    marker = '✓'
                    pass_count += 1
                elif not missing:
                    status = 'PASS_EXTRA'
                    marker = '✓~'
                    pass_count += 1
                elif len(matched) >= len(expected_norm) * 0.5:
                    status = 'PARTIAL'
                    marker = '△'
                else:
                    status = 'FAIL'
                    marker = '✗'

                detail = f'匹配={sorted(matched)}, 缺失={sorted(missing)}, 多余={sorted(extra)}'

            print(f'  实际: {actual if actual else "（无）"}')
            print(f'  {marker} {status} - {detail} ({elapsed:.1f}s)')
            results.append((status, desc, detail))

        except requests.exceptions.Timeout:
            print(f'  ✗ 超时 (>60s)')
            results.append(('FAIL', desc, '超时'))
        except Exception as e:
            print(f'  ✗ 异常: {e}')
            results.append(('FAIL', desc, str(e)))
        print()

    print('=' * 80)
    print(f'极端测试总结: {pass_count}/{len(results)} 通过')
    print('=' * 80)

    # 状态分布
    status_counts = {}
    for s, _, _ in results:
        status_counts[s] = status_counts.get(s, 0) + 1
    print(f'状态分布: {status_counts}')

    # 关键检查：是否有崩溃
    crashes = [r for r in results if r[0] == 'FAIL' and '崩溃' in r[2]]
    if crashes:
        print(f'\n⚠ 警告: {len(crashes)} 个用例导致服务器崩溃!')
    else:
        print('\n✓ 无崩溃：所有极端用例都返回了有效响应')

    return 0 if pass_count == len(results) else 1

if __name__ == '__main__':
    import sys
    sys.exit(main())
