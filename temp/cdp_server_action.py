#!/usr/bin/env python3
"""通过 CDP 在浏览器中调用 Next.js Server Action 测试 OCR"""
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
ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=120)

# 1. 查找 Server Action ID
print("=== 查找 recognizeWordsFromImage 的 Server Action ID ===")
result = cdp_call(ws, 'Runtime.evaluate', {
    'expression': """
    (() => {
        // 在页面的 script 标签中查找 action ID
        const scripts = document.querySelectorAll('script');
        const actionIds = [];
        for (const s of scripts) {
            const text = s.textContent || '';
            // Server Action 通常有格式 "$Fxx" 引用
            const matches = text.match(/\\$F([a-f0-9]{32,})/g);
            if (matches) actionIds.push(...matches);
        }
        // 也查找 __next_f 数据
        const nextF = (window.__next_f || []).map(item => {
            if (typeof item === 'string') return item.substring(0, 200);
            if (Array.isArray(item) && item.length > 1) return JSON.stringify(item[1]).substring(0, 200);
            return '';
        });
        return JSON.stringify({actionIds: [...new Set(actionIds)].slice(0, 10), nextF: nextF.slice(0, 5)});
    })()
    """,
    'returnByValue': True
}, 1)
val = result.get('result', {}).get('result', {}).get('value', '{}')
info = json.loads(val)
print(f"Action IDs: {info.get('actionIds', [])}")
print(f"Next-F 数据 (前5项): {info.get('nextF', [])[:2]}")

# 2. 直接通过 fetch 调用 PaddleOCR 服务（从 Node.js 服务端，不是浏览器）
# 由于浏览器有 CORS 限制，我们通过 Next.js 的 Server Action 中转
# 但首先尝试直接通过 CDP 在浏览器的 Node.js 环境中调用

# 3. 用 Node.js fetch 直接调用 PaddleOCR（绕过浏览器 CORS）
print("\n=== 通过 Node.js 服务端调用 PaddleOCR ===")
with open('temp/tests/01.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

# 在 Next.js 服务端执行 OCR（通过 Server Action fetch）
result = cdp_call(ws, 'Runtime.evaluate', {
    'expression': f"""
    (async () => {{
        try {{
            // 直接调用 PaddleOCR 服务（从服务端，通过 Next.js 的 fetch）
            const resp = await fetch('http://127.0.0.1:39821/', {{
                method: 'POST',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify({{image: '{img_b64[:100]}...'}})
            }});
            return JSON.stringify({{ok: resp.ok, status: resp.status}});
        }} catch(e) {{
            return JSON.stringify({{ok: false, error: e.message}});
        }}
    }})()
    """,
    'awaitPromise': True,
    'returnByValue': True
}, 2)
val = result.get('result', {}).get('result', {}).get('value', '{}')
print(f"浏览器直接调用 PaddleOCR: {val}")

# 4. 通过 Next.js 的 API 路由调用（如果存在）
print("\n=== 检查是否有 API 路由 ===")
result = cdp_call(ws, 'Runtime.evaluate', {
    'expression': """
    (async () => {
        try {
            const resp = await fetch('/api/ocr', {method: 'GET'});
            return JSON.stringify({ok: resp.ok, status: resp.status});
        } catch(e) {
            return JSON.stringify({ok: false, error: e.message});
        }
    })()
    """,
    'awaitPromise': True,
    'returnByValue': True
}, 3)
val = result.get('result', {}).get('result', {}).get('value', '{}')
print(f"API /api/ocr: {val}")

ws.close()
print("\n测试完成")
