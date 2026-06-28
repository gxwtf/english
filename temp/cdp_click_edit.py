#!/usr/bin/env python3
"""CDP 精确点击编辑按钮并测试 OCR 前端"""
import json, requests, websocket, time, base64

def cdp_call(ws, method, params=None, msg_id=1):
    msg = {'id': msg_id, 'method': method}
    if params:
        msg['params'] = params
    ws.send(json.dumps(msg))
    while True:
        result = json.loads(ws.recv())
        if result.get('id') == msg_id:
            return result

resp = requests.get('http://127.0.0.1:9222/json/list', proxies={'http': None})
pages = resp.json()
target = [p for p in pages if 'localhost:3003' in p.get('url', '')][0]
ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=60)

# 1. 获取编辑按钮的精确坐标
print("=== 获取编辑按钮坐标 ===")
result = cdp_call(ws, 'Runtime.evaluate', {
    'expression': """
    (() => {
        const h3s = document.querySelectorAll('h3');
        for (const h3 of h3s) {
            if (h3.textContent.trim() === 'dog') {
                const card = h3.closest('[class*=rounded]');
                if (card) {
                    card.scrollIntoView({block: 'center'});
                    const btns = card.querySelectorAll('button');
                    if (btns.length >= 1) {
                        const rect = btns[0].getBoundingClientRect();
                        return JSON.stringify({
                            x: rect.x + rect.width/2,
                            y: rect.y + rect.height/2,
                            w: rect.width,
                            h: rect.height,
                            vh: window.innerHeight
                        });
                    }
                }
            }
        }
        return '{}';
    })()
    """,
    'returnByValue': True
}, 1)
val = result.get('result', {}).get('result', {}).get('value', '{}')
info = json.loads(val)
print(f"按钮坐标: {info}")

if not info:
    print("未找到按钮")
    ws.close()
    exit(1)

x, y = info['x'], info['y']
print(f"点击位置: ({x:.0f}, {y:.0f})")

time.sleep(0.5)

# 2. 用 CDP Input.dispatchMouseEvent 模拟真实鼠标点击
print("\n=== 模拟鼠标点击 ===")
for evt_type in ['mouseMoved', 'mousePressed', 'mouseReleased']:
    result = cdp_call(ws, 'Input.dispatchMouseEvent', {
        'type': evt_type,
        'x': x,
        'y': y,
        'button': 'left',
        'clickCount': 1,
        'buttons': 1 if evt_type == 'mousePressed' else 0
    }, 2)
    time.sleep(0.1)

print("已点击")
time.sleep(3)

# 3. 检查模态框
print("\n=== 检查模态框 ===")
result = cdp_call(ws, 'Runtime.evaluate', {
    'expression': """
    (() => {
        const fixed = [];
        document.querySelectorAll('*').forEach(el => {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' && el.offsetParent !== null && el.children.length > 0) {
                fixed.push({tag: el.tagName, class: el.className?.toString()?.substring(0, 80), text: el.textContent?.substring(0, 80)});
            }
        });
        const dialog = document.querySelector('[role=dialog]');
        return JSON.stringify({
            fixedCount: fixed.length,
            fixed: fixed.slice(0, 3),
            dialogFound: !!dialog
        });
    })()
    """,
    'returnByValue': True
}, 3)
val = result.get('result', {}).get('result', {}).get('value', '{}')
info = json.loads(val)
print(f"Fixed 元素: {info['fixedCount']}")
for f in info.get('fixed', []):
    print(f"  <{f['tag']}> {f['text'][:60]}")
print(f"Dialog found: {info['dialogFound']}")

if info['fixedCount'] > 0 or info['dialogFound']:
    print("\n模态框已打开!")
    # 4. 查找拍照识别功能
    result = cdp_call(ws, 'Runtime.evaluate', {
        'expression': """
        (() => {
            const all = document.querySelectorAll('*');
            const matches = [];
            for (const el of all) {
                const t = el.textContent?.trim() || '';
                if (t.length > 0 && t.length < 30 && (t.includes('拍照') || t.includes('识别') || t.includes('Photo'))) {
                    matches.push({tag: el.tagName, text: t});
                }
            }
            const fileInputs = document.querySelectorAll('input[type=file]');
            return JSON.stringify({matches: matches.slice(0, 10), fileInputs: fileInputs.length});
        })()
        """,
        'returnByValue': True
    }, 4)
    val = result.get('result', {}).get('result', {}).get('value', '{}')
    print(f"OCR 元素: {val}")
else:
    print("\n模态框未打开")

    # 截图查看页面状态
    result = cdp_call(ws, 'Page.captureScreenshot', {'format': 'png'}, 5)
    if 'result' in result:
        import base64 as b64
        img_data = b64.b64decode(result['result']['data'])
        with open('/tmp/page_screenshot.png', 'wb') as f:
            f.write(img_data)
        print("截图已保存: /tmp/page_screenshot.png")

ws.close()
print("\n测试完成")
