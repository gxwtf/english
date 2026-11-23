#!/usr/bin/env python3
"""拍照识词「标记检测」回归脚本。

用法（在 paddleocr-service 目录下）：

    ./venv/bin/python regression.py                # 跑 tune_samples/ 下已有的样例
    ./venv/bin/python regression.py a.jpg b.jpg    # 指定图片
    ./venv/bin/python regression.py --debug        # 带上判据日志

样例照片涉及学生真实作业，放在 ``tune_samples/`` 且**不入库**（见 .gitignore）。
文件缺失时对应用例记 SKIP，不影响其它用例。

判定口径：
  * 精确用例：期望词必须**全部命中**、且输出里没有期望之外的多余词；
  * 包含用例：期望词必须全部命中，允许多余词（页面划了很多处、边界难说死的场景）。

调参后请跑一次，末行必须是 PASS。
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CASES = [
    {
        # 英语学习资料：5 处红笔圈出单词（笔很淡，旧版全漏）
        'file': 'sample1.jpg',
        'mode': 'exact',
        'expect': ['blistered', 'clumsily', 'newfound', 'tangible', 'dignity'],
    },
    {
        # 阅读理解页：大量红笔下划线 + 页边手写中文批注（不应产生任何中文/批注词）
        'file': 'sample2.jpg',
        'mode': 'subset',
        'expect': ['playful', 'annoyance', 'literature'],
    },
]


def main(argv):
    debug = '--debug' in argv
    files = [a for a in argv if not a.startswith('--')]
    if debug:
        os.environ['OCR_DEBUG'] = '1'

    import server  # noqa: E402  （放在 OCR_DEBUG 之后，保证开关生效）

    here = os.path.dirname(os.path.abspath(__file__))
    if not files:
        files = [os.path.join(here, 'tune_samples', c['file']) for c in CASES]
        selected = CASES
    else:
        selected = []
        for f in files:
            match = next((c for c in CASES if os.path.basename(c['file']) == os.path.basename(f)), None)
            selected.append(match or {'file': f, 'mode': 'subset', 'expect': []})

    failures = 0
    ran = 0
    for case, path in zip(selected, files):
        if not os.path.exists(path):
            print(f'SKIP {os.path.basename(path)}（样例不存在）')
            continue
        ran += 1
        with open(path, 'rb') as fh:
            res = server.ocr_and_detect(fh.read())
        if 'error' in res:
            print(f'FAIL {os.path.basename(path)}: {res["error"]}')
            failures += 1
            continue
        got = [w['text'] for w in res['words'] if w['isHighlighted']]
        got_l = [g.lower() for g in got]
        expect = [e.lower() for e in case['expect']]
        missing = [e for e in expect if e not in got_l]
        extra = [g for g in got_l if g not in expect]
        ok = not missing and (case['mode'] != 'exact' or not extra)
        print(f'{"PASS" if ok else "FAIL"} {os.path.basename(path)} '
              f'({res["timing"]["total"]}s, {len(got)} 词)')
        print(f'     got   : {got}')
        if missing:
            print(f'     漏识  : {missing}')
        if extra:
            print(f'     多出  : {extra}')
        if not ok:
            failures += 1

    if ran == 0:
        print('没有可跑的样例（把样例照片放到 tune_samples/）')
        return 0
    print('PASS' if failures == 0 else f'FAIL ({failures}/{ran})')
    return 0 if failures == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
