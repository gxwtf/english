#!/usr/bin/env python3
"""通过 CDP 在浏览器中测试前端 OCR 功能"""
import json, requests, websocket, time, base64

def get_ws():
    resp = requests.get('http://127.0.0.1:9222/json/list', proxies={'http': None})
    pages = resp.json()
    target = [p for p in pages if 'localhost:3003' in p.get('url', '')][0]
    return websocket.create_connection(target['webSocketDebuggerUrl'], timeout=60)

def eval_js(ws, js, msg_id=1):
    ws.send(json.dumps({'id': msg_id, 'method': 'Runtime.evaluate', 'params': {
        'expression': js, 'awaitPromise': True
    }}))
    result = json.loads(ws.recv())
    return result.get('result', {}).get('result', {}).get('value', '')

ws = get_ws()

# 1. 尝试通过 dispatchEvent 点击编辑按钮
print("=== 步骤1: 点击编辑按钮 ===")
js_click = """
(() => {
    const h3s = document.querySelectorAll('h3');
    for (const h3 of h3s) {
        if (h3.textContent.trim() === 'dog') {
            const card = h3.closest('[class*=rounded]');
            if (card) {
                const btns = card.querySelectorAll('button');
                if (btns.length >= 1) {
                    const btn = btns[0];
                    const opts = {bubbles: true, cancelable: true, view: window};
                    btn.dispatchEvent(new MouseEvent('pointerdown', opts));
                    btn.dispatchEvent(new MouseEvent('mousedown', opts));
                    btn.dispatchEvent(new MouseEvent('pointerup', opts));
                    btn.dispatchEvent(new MouseEvent('mouseup', opts));
                    btn.dispatchEvent(new MouseEvent('click', opts));
                    return 'clicked: ' + btn.tagName;
                }
            }
        }
    }
    return 'not found';
})()
"""
print(eval_js(ws, js_click))
time.sleep(3)

# 2. 检查模态框是否打开
print("\n=== 步骤2: 检查模态框 ===")
js_check = """
(() => {
    const fixed = [];
    document.querySelectorAll('*').forEach(el => {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' && el.offsetParent !== null && el.children.length > 0) {
            fixed.push({tag: el.tagName, class: el.className?.toString()?.substring(0, 80), text: el.textContent?.substring(0, 100)});
        }
    });
    const dialog = document.querySelector('[role=dialog]');
    return JSON.stringify({
        fixedCount: fixed.length,
        fixed: fixed.slice(0, 3),
        dialog: dialog ? 'found' : 'none'
    });
})()
"""
result = eval_js(ws, js_check, 2)
print(result)
info = json.loads(result) if result else {}
if info.get('fixedCount', 0) > 0 or info.get('dialog') == 'found':
    print("模态框已打开!")
else:
    print("模态框未打开，尝试其他方式...")

    # 3. 尝试直接点击单词文本（有些卡片点击文本也能打开）
    print("\n=== 步骤3: 尝试点击单词卡片 ===")
    js_click_card = """
    (() => {
        const h3s = document.querySelectorAll('h3');
        for (const h3 of h3s) {
            if (h3.textContent.trim() === 'dog') {
                const card = h3.closest('[class*=rounded]') || h3.parentElement;
                if (card) {
                    const opts = {bubbles: true, cancelable: true, view: window};
                    card.dispatchEvent(new MouseEvent('click', opts));
                    return 'clicked card: ' + card.tagName;
                }
            }
        }
        return 'not found';
    })()
    """
    print(eval_js(ws, js_click_card, 3))
    time.sleep(2)

    # 再检查
    result2 = eval_js(ws, js_check, 4)
    print(f"检查结果: {result2}")

# 4. 如果模态框打开了，查找拍照识别功能
print("\n=== 步骤4: 查找拍照识别功能 ===")
js_find_ocr = """
(() => {
    const all = document.querySelectorAll('*');
    const matches = [];
    for (const el of all) {
        const t = el.textContent?.trim() || '';
        if (t.length > 0 && t.length < 30 && (t.includes('拍照') || t.includes('识别') || t.includes('Photo') || t.includes('图片'))) {
            matches.push({tag: el.tagName, text: t});
        }
    }
    // 也查找 file input
    const fileInputs = document.querySelectorAll('input[type=file]');
    return JSON.stringify({matches: matches.slice(0, 10), fileInputs: fileInputs.length});
})()
"""
result = eval_js(ws, js_find_ocr, 5)
print(f"OCR 相关元素: {result}")

ws.close()
print("\n前端测试完成")
