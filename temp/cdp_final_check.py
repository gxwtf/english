#!/usr/bin/env python3
"""CDP 最终检查：控制台错误 + 截图"""
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
        # 收集控制台消息
        if result.get('method') == 'Runtime.consoleAPICalled':
            args = result.get('params', {}).get('args', [])
            text = ' '.join(a.get('value', a.get('description', '')) for a in args)
            print(f'  [CONSOLE] {result["params"]["type"]}: {text}')

resp = requests.get('http://127.0.0.1:9222/json/list', proxies={'http': None})
pages = resp.json()
target = [p for p in pages if 'localhost:3003' in p.get('url', '')][0]
ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=60)

# 启用 Runtime 和 Console
cdp_call(ws, 'Runtime.enable', {}, 1)
cdp_call(ws, 'Console.enable', {}, 2)
cdp_call(ws, 'Page.enable', {}, 3)

# 刷新页面以捕获所有控制台消息
print("=== 刷新页面并捕获控制台消息 ===")
cdp_call(ws, 'Page.reload', {'ignoreCache': True}, 4)
time.sleep(5)

# 收集 3 秒内的控制台消息
print("\n=== 等待控制台消息 (3秒) ===")
ws.settimeout(3)
try:
    while True:
        result = json.loads(ws.recv())
        if result.get('method') == 'Runtime.consoleAPICalled':
            args = result.get('params', {}).get('args', [])
            text = ' '.join(str(a.get('value', a.get('description', ''))) for a in args)
            msg_type = result['params']['type']
            if msg_type in ['error', 'warning']:
                print(f'  [{msg_type.upper()}] {text}')
except:
    pass
ws.settimeout(60)

# 截图
print("\n=== 截图 ===")
result = cdp_call(ws, 'Page.captureScreenshot', {'format': 'png'}, 5)
if 'result' in result:
    img_data = base64.b64decode(result['result']['data'])
    with open('/tmp/frontend_home.png', 'wb') as f:
        f.write(img_data)
    print("首页截图已保存: /tmp/frontend_home.png")

# 检查页面状态
print("\n=== 页面状态 ===")
result = cdp_call(ws, 'Runtime.evaluate', {
    'expression': """
    (() => {
        return JSON.stringify({
            url: location.href,
            title: document.title,
            wordCount: document.querySelectorAll('h3').length,
            bodyTextLen: document.body.innerText.length,
            hasError: document.body.innerText.includes('Error') || document.body.innerText.includes('error')
        });
    })()
    """,
    'returnByValue': True
}, 6)
val = result.get('result', {}).get('result', {}).get('value', '{}')
info = json.loads(val)
print(f"URL: {info['url']}")
print(f"标题: {info['title']}")
print(f"单词卡片数: {info['wordCount']}")
print(f"页面文本长度: {info['bodyTextLen']}")
print(f"有错误: {info['hasError']}")

ws.close()
print("\n检查完成")
