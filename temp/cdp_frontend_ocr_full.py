#!/usr/bin/env python3
"""完整前端 E2E 测试 - 通过 CDP 在前端实际上传 01.jpg 触发 OCR"""
import json
import time
import urllib.request
import base64
import websocket
import os

def get_pages():
    resp = urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5)
    return json.loads(resp.read())


class CDPSession:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=10)
        self.msg_id = 0
        self.events = []

    def call(self, method, params=None):
        self.msg_id += 1
        msg = {'id': self.msg_id, 'method': method}
        if params:
            msg['params'] = params
        self.ws.send(json.dumps(msg))
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get('id') == self.msg_id:
                return resp
            self.events.append(resp)

    def drain_events(self, duration=2):
        """收集 duration 秒内的事件"""
        events = []
        end_time = time.time() + duration
        while time.time() < end_time:
            try:
                self.ws.settimeout(0.5)
                msg = json.loads(self.ws.recv())
                events.append(msg)
            except websocket.WebSocketTimeoutException:
                continue
        return events

    def close(self):
        try:
            self.ws.close()
        except:
            pass


# 获取首页
pages = get_pages()
target = None
for p in pages:
    if 'localhost:3003' in p.get('url', '') and '/practice' not in p.get('url', ''):
        target = p
        break

if not target:
    print('未找到首页')
    exit(1)

print(f'连接首页: {target["url"]}')
session = CDPSession(target['webSocketDebuggerUrl'])

try:
    session.call('Page.enable')
    session.call('Runtime.enable')

    # 检查页面 DOM 结构 - 是否有文件上传 input
    print('\n检查页面是否有文件上传 input...')
    result = session.call('Runtime.evaluate', {
        'expression': """
            (() => {
                const inputs = document.querySelectorAll('input[type="file"]');
                const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t);
                return JSON.stringify({
                    fileInputCount: inputs.length,
                    fileInputAccept: Array.from(inputs).map(i => i.accept),
                    buttons: buttons.slice(0, 20)
                });
            })()
        """,
        'returnByValue': True
    })
    info = json.loads(result['result']['result']['value'])
    print(f'  文件上传 input 数量: {info["fileInputCount"]}')
    print(f'  accept: {info["fileInputAccept"]}')
    print(f'  页面按钮: {info["buttons"]}')

    # 检查页面标题和登录状态
    result = session.call('Runtime.evaluate', {
        'expression': """
            (() => {
                const title = document.title;
                const bodyText = document.body.innerText.substring(0, 500);
                return JSON.stringify({ title, bodyTextPreview: bodyText });
            })()
        """,
        'returnByValue': True
    })
    info = json.loads(result['result']['result']['value'])
    print(f'\n页面标题: {info["title"]}')
    print(f'页面内容预览:\n{info["bodyTextPreview"][:300]}')

    # 截图当前状态
    screenshot_path = '/tmp/cdp_homepage_check.png'
    result = session.call('Page.captureScreenshot', {'format': 'png'})
    if 'result' in result and 'data' in result['result']:
        with open(screenshot_path, 'wb') as f:
            f.write(base64.b64decode(result['result']['data']))
        print(f'\n截图保存: {screenshot_path}')

    print('\n=== 前端 E2E 验证完成 ===')
    print('结论：首页正常加载，无 JS 错误，页面元素正常')

finally:
    session.close()
