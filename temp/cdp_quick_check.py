#!/usr/bin/env python3
"""快速 CDP 验证前端无控制台错误"""
import json, time, urllib.request, websocket, base64

pages = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5).read())
target = None
for p in pages:
    if 'localhost:3003' in p.get('url', '') and '/practice' not in p.get('url', ''):
        target = p
        break

if not target:
    print('未找到首页，跳过前端验证')
    exit(0)

ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=10)
msg_id = 0

def call(method, params=None):
    global msg_id
    msg_id += 1
    msg = {'id': msg_id, 'method': method}
    if params:
        msg['params'] = params
    ws.send(json.dumps(msg))
    while True:
        resp = json.loads(ws.recv())
        if resp.get('id') == msg_id:
            return resp

call('Page.enable')
call('Runtime.enable')
call('Page.reload', {'ignoreCache': True})
time.sleep(3)

errors = []
end_time = time.time() + 3
while time.time() < end_time:
    try:
        ws.settimeout(0.5)
        msg = json.loads(ws.recv())
        if msg.get('method') == 'Runtime.consoleAPICalled' and msg['params'].get('type') == 'error':
            args = msg['params'].get('args', [])
            text = ' '.join(str(a.get('value', '')) for a in args)
            errors.append(text)
        elif msg.get('method') == 'Runtime.exceptionThrown':
            errors.append(str(msg['params'].get('exceptionDetails', {})))
    except websocket.WebSocketTimeoutException:
        continue

ws.close()
print(f'控制台错误数: {len(errors)}')
for e in errors[:5]:
    print(f'  - {e[:200]}')
print(f'结果: {"PASS" if len(errors) == 0 else "FAIL"}')
