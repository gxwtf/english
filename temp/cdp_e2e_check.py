#!/usr/bin/env python3
"""CDP 直连测试 - 验证前端 E2E 功能（首页 + practice 页面无控制台错误）"""
import json
import time
import urllib.request
import websocket  # websocket-client

# 1. 获取 localhost:3003 的页面 websocket url
def get_pages():
    resp = urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5)
    return json.loads(resp.read())

# 2. 通过 CDP websocket 操作页面
class CDPSession:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=10)
        self.msg_id = 0

    def call(self, method, params=None):
        self.msg_id += 1
        msg = {'id': self.msg_id, 'method': method}
        if params:
            msg['params'] = params
        self.ws.send(json.dumps(msg))
        # 等待响应（跳过事件消息）
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get('id') == self.msg_id:
                return resp
            # 否则是事件，忽略

    def close(self):
        try:
            self.ws.close()
        except:
            pass


def test_page(page_url, page_title):
    """测试指定页面：刷新、收集控制台错误、截图"""
    print(f'\n=== 测试页面: {page_title} ({page_url}) ===')
    pages = get_pages()
    target = None
    for p in pages:
        if p.get('url', '').rstrip('/') == page_url.rstrip('/'):
            target = p
            break
    if not target:
        print(f'  未找到页面 {page_url}')
        return False

    ws_url = target['webSocketDebuggerUrl']
    print(f'  连接 CDP: {ws_url[:80]}...')
    session = CDPSession(ws_url)

    try:
        # 启用 Console 和 Runtime
        session.call('Console.enable')
        session.call('Runtime.enable')

        # 收集控制台消息
        console_errors = []
        console_warnings = []

        # 刷新页面
        print('  刷新页面...')
        session.call('Page.enable')
        session.call('Page.reload', {'ignoreCache': True})

        # 等待页面加载
        time.sleep(3)

        # 收集 5 秒内的控制台消息
        end_time = time.time() + 5
        while time.time() < end_time:
            try:
                session.ws.settimeout(1)
                msg = json.loads(session.ws.recv())
                if msg.get('method') == 'Runtime.consoleAPICalled':
                    args = msg['params'].get('args', [])
                    text = ' '.join(str(a.get('value', '')) for a in args)
                    level = msg['params'].get('type', '')
                    if level == 'error':
                        console_errors.append(text)
                    elif level == 'warning':
                        console_warnings.append(text)
                elif msg.get('method') == 'Runtime.exceptionThrown':
                    exc = msg['params'].get('exceptionDetails', {})
                    text = exc.get('text', '') + ' ' + str(exc.get('exception', {}).get('description', ''))
                    console_errors.append(f'EXCEPTION: {text}')
            except websocket.WebSocketTimeoutException:
                continue

        print(f'  控制台错误: {len(console_errors)}')
        for e in console_errors[:5]:
            print(f'    - {e[:200]}')
        print(f'  控制台警告: {len(console_warnings)}')
        for w in console_warnings[:3]:
            print(f'    - {w[:200]}')

        # 截图
        screenshot_path = f'/tmp/cdp_screenshot_{int(time.time())}.png'
        result = session.call('Page.captureScreenshot', {'format': 'png'})
        if 'result' in result and 'data' in result['result']:
            import base64
            with open(screenshot_path, 'wb') as f:
                f.write(base64.b64decode(result['result']['data']))
            print(f'  截图保存: {screenshot_path}')

        return len(console_errors) == 0

    finally:
        session.close()


# 测试首页和 practice 页面
ok1 = test_page('http://localhost:3003/', '首页')
ok2 = test_page('http://localhost:3003/practice', '题目队列')

print(f'\n=== 测试总结 ===')
print(f'首页: {"PASS" if ok1 else "FAIL"}')
print(f'practice: {"PASS" if ok2 else "FAIL"}')
