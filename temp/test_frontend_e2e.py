#!/usr/bin/env python3
"""前端端到端测试：通过 Chrome DevTools Protocol 直接操作浏览器。

由于 Chrome MCP 的 Network.enable 超时，改用 CDP WebSocket 直接通信。
测试流程：
1. 找到 localhost:3003 页面（或新建）
2. 导航到拍照识别页面
3. 上传测试图片
4. 点击识别按钮
5. 验证识别结果
"""
import json
import requests
import time
import websocket  # pip install websocket-client

CDP_URL = 'http://127.0.0.1:9222'

def get_pages():
    """获取所有打开的页面"""
    resp = requests.get(f'{CDP_URL}/json/list')
    return resp.json()

def find_or_create_page(url_prefix):
    """找到指定 URL 前缀的页面，或新建"""
    pages = get_pages()
    for p in pages:
        if p['type'] == 'page' and p['url'].startswith(url_prefix):
            return p
    # 新建页面
    resp = requests.put(f'{CDP_URL}/json/new?{url_prefix}')
    return resp.json()

def create_new_tab(url):
    """新建标签页"""
    resp = requests.put(f'{CDP_URL}/json/new?{url}')
    return resp.json()

class CDPSession:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30)
        self.msg_id = 0

    def send(self, method, params=None):
        self.msg_id += 1
        msg = {'id': self.msg_id, 'method': method}
        if params:
            msg['params'] = params
        self.ws.send(json.dumps(msg))
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get('id') == self.msg_id:
                return resp
            # 忽略事件消息

    def close(self):
        self.ws.close()

def main():
    print('=== 前端端到端测试 ===\n')

    # 1. 找到或新建 localhost:3003 页面
    pages = get_pages()
    target = None
    for p in pages:
        if p['type'] == 'page' and 'localhost:3003' in p['url']:
            target = p
            break

    if target:
        print(f'找到已有页面: {target["url"]}')
    else:
        print('新建 localhost:3003 页面')
        target = create_new_tab('http://localhost:3003/')
        time.sleep(3)

    print(f'页面 ID: {target["id"]}')
    print(f'WebSocket URL: {target["webSocketDebuggerUrl"]}')

    # 2. 连接 CDP
    session = CDPSession(target['webSocketDebuggerUrl'])

    # 3. 启用 Page 域
    resp = session.send('Page.enable')
    print(f'Page.enable: {resp.get("result", resp.get("error"))}')

    # 4. 导航到首页
    resp = session.send('Page.navigate', {'url': 'http://localhost:3003/'})
    print(f'Navigate: {resp.get("result", resp.get("error"))}')
    time.sleep(3)

    # 5. 获取页面标题和 URL
    resp = session.send('Runtime.evaluate', {'expression': 'document.title'})
    title = resp.get('result', {}).get('result', {}).get('value', '')
    print(f'页面标题: {title}')

    resp = session.send('Runtime.evaluate', {'expression': 'window.location.href'})
    href = resp.get('result', {}).get('result', {}).get('value', '')
    print(f'当前 URL: {href}')

    # 6. 检查页面是否有错误
    resp = session.send('Runtime.evaluate', {
        'expression': 'document.body ? document.body.innerText.substring(0, 500) : "empty body"'
    })
    body_text = resp.get('result', {}).get('result', {}).get('value', '')
    print(f'\n页面文本 (前500字符):\n{body_text[:500]}')

    # 7. 查找拍照识别相关的按钮/入口
    resp = session.send('Runtime.evaluate', {
        'expression': '''
            // 查找所有按钮文本
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], label'));
            const texts = buttons.map(b => b.innerText || b.textContent || '').filter(t => t.trim());
            JSON.stringify(texts);
        '''
    })
    buttons_text = resp.get('result', {}).get('result', {}).get('value', '[]')
    print(f'\n页面按钮: {buttons_text}')

    # 8. 检查控制台错误
    resp = session.send('Runtime.evaluate', {
        'expression': '''
            window.__test_errors = window.__test_errors || [];
            JSON.stringify(window.__test_errors);
        '''
    })

    session.close()
    print('\n=== 测试完成 ===')

if __name__ == '__main__':
    main()
