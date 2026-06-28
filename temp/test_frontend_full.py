#!/usr/bin/env python3
"""前端端到端测试（通过 CDP）：验证拍照识别功能完整流程。

流程：首页 → 添加单词按钮 → 拍照识别按钮 → 上传图片 → 识别 → 验证结果
"""
import json
import requests
import time
import base64
import websocket

CDP_URL = 'http://127.0.0.1:9222'

def get_pages():
    resp = requests.get(f'{CDP_URL}/json/list')
    return resp.json()

class CDPSession:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30)
        self.msg_id = 0
        self.events = []

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
            self.events.append(resp)

    def eval(self, expression):
        resp = self.send('Runtime.evaluate', {
            'expression': expression,
            'returnByValue': True,
            'awaitPromise': True,
        })
        result = resp.get('result', {}).get('result', {})
        if result.get('type') == 'string':
            return result.get('value', '')
        return result

    def close(self):
        self.ws.close()

def main():
    print('=== 前端端到端测试 ===\n')

    # 找到 localhost:3003 页面
    pages = get_pages()
    target = None
    for p in pages:
        if p['type'] == 'page' and 'localhost:3003' in p['url']:
            target = p
            break

    if not target:
        print('✗ 未找到 localhost:3003 页面')
        return 1

    session = CDPSession(target['webSocketDebuggerUrl'])
    session.send('Page.enable')
    session.send('Runtime.enable')

    # 导航到首页
    print('[1] 导航到首页')
    session.send('Page.navigate', {'url': 'http://localhost:3003/'})
    time.sleep(5)

    # 等待页面加载完成
    for _ in range(10):
        ready = session.eval('document.readyState')
        if ready == 'complete':
            break
        time.sleep(1)
    print(f'  页面状态: {ready}')

    title = session.eval('document.title')
    print(f'  标题: {title}')

    # 检查是否已登录
    body_text = session.eval('document.body.innerText.substring(0, 1000)')
    print(f'  页面文本: {body_text[:200]}...')

    # 查找"添加"或"新增"按钮
    add_buttons = session.eval('''
        (() => {
            const all = Array.from(document.querySelectorAll('button, [role="button"], a'));
            const result = [];
            for (const el of all) {
                const text = (el.innerText || el.textContent || '').trim();
                if (text.includes('添加') || text.includes('新增') || text.includes('单词') ||
                    text.includes('拍照') || text.includes('识别')) {
                    result.push({text: text.substring(0, 50), tag: el.tagName});
                }
            }
            return JSON.stringify(result);
        })()
    ''')
    print(f'  相关按钮: {add_buttons}')

    # 查找"拍照识别单词"按钮
    photo_btn = session.eval('''
        (() => {
            const all = Array.from(document.querySelectorAll('button, [role="button"]'));
            for (const el of all) {
                const text = (el.innerText || el.textContent || '').trim();
                if (text.includes('拍照识别')) {
                    el.click();
                    return 'clicked: ' + text;
                }
            }
            return 'not found';
        })()
    ''')
    print(f'\n[2] 拍照识别按钮: {photo_btn}')

    if 'not found' in photo_btn:
        # 可能需要先打开添加单词的 modal
        print('  尝试先打开添加单词 modal...')
        modal_btn = session.eval('''
            (() => {
                const all = Array.from(document.querySelectorAll('button, [role="button"], a, [class*="add"], [class*="Add"]'));
                for (const el of all) {
                    const text = (el.innerText || el.textContent || '').trim();
                    if (text.includes('添加') || text.includes('新增')) {
                        el.click();
                        return 'clicked: ' + text;
                    }
                }
                return 'not found';
            })()
        ''')
        print(f'  添加按钮: {modal_btn}')
        time.sleep(2)

        # 再次查找拍照识别按钮
        photo_btn = session.eval('''
            (() => {
                const all = Array.from(document.querySelectorAll('button, [role="button"]'));
                for (const el of all) {
                    const text = (el.innerText || el.textContent || '').trim();
                    if (text.includes('拍照识别')) {
                        el.click();
                        return 'clicked: ' + text;
                    }
                }
                return 'not found';
            })()
        ''')
        print(f'  拍照识别按钮: {photo_btn}')

    time.sleep(2)

    # 检查拍照识别 modal 是否打开
    modal_text = session.eval('''
        (() => {
            const modal = document.querySelector('[class*="fixed"][class*="bg-black"]');
            if (modal) return modal.innerText.substring(0, 300);
            return 'no modal found';
        })()
    ''')
    print(f'\n[3] Modal 内容: {modal_text[:200]}')

    # 检查文件上传 input
    file_input = session.eval('''
        (() => {
            const input = document.querySelector('input[type="file"]');
            return input ? 'found' : 'not found';
        })()
    ''')
    print(f'  文件上传 input: {file_input}')

    # 如果找到文件上传 input，设置图片
    if 'found' in file_input:
        print('\n[4] 上传测试图片...')
        # 读取测试图片
        with open('/home/kevin/kevin/git/gxwtf_english/temp/tests/yellow-highlight-3.jpg', 'rb') as f:
            img_data = f.read()

        # 通过 CDP 设置文件 input 的文件
        # 找到 input 元素的 objectId
        resp = session.send('Runtime.evaluate', {
            'expression': 'document.querySelector("input[type=file]")',
            'returnByValue': False,
        })
        object_id = resp.get('result', {}).get('result', {}).get('objectId', '')
        if object_id:
            # 设置文件
            session.send('DOM.setFileInputFiles', {
                'files': ['/home/kevin/kevin/git/gxwtf_english/temp/tests/yellow-highlight-3.jpg'],
                'nodeId': None,  # 需要 DOM.describeNode
            })
            # 用另一种方式：通过 DOM 域
            print('  尝试通过 DOM 域设置文件...')

        # 用 JS 方式设置文件（通过 DataTransfer）
        img_b64 = base64.b64encode(img_data).decode()
        result = session.eval(f'''
            (async () => {{
                const input = document.querySelector('input[type=file]');
                if (!input) return 'no input';
                const resp = await fetch('data:application/octet-stream;base64,{img_b64}');
                const blob = await resp.blob();
                const file = new File([blob], 'test.jpg', {{type: 'image/jpeg'}});
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', {{bubbles: true}}));
                return 'file set';
            }})()
        ''')
        print(f'  上传结果: {result}')
        time.sleep(2)

        # 检查预览是否显示
        preview = session.eval('''
            (() => {
                const img = document.querySelector('img[src^="data:"]');
                return img ? 'preview shown' : 'no preview';
            })()
        ''')
        print(f'  图片预览: {preview}')

        # 查找并点击"开始识别"按钮（精确匹配，避免点到"拍照识别单词"）
        recognize_btn = session.eval('''
            (() => {
                const all = Array.from(document.querySelectorAll('button'));
                for (const el of all) {
                    const text = (el.innerText || el.textContent || '').trim();
                    if (text === '开始识别' || text.startsWith('开始识别')) {
                        el.click();
                        return 'clicked: ' + text;
                    }
                }
                return 'not found';
            })()
        ''')
        print(f'\n[5] 识别按钮: {recognize_btn}')

        # 等待识别完成（最多 30 秒）
        print('  等待识别完成...')
        for i in range(30):
            time.sleep(1)
            state = session.eval('''
                (() => {
                    const body = document.body.innerText;
                    if (body.includes('识别结果')) return 'results shown';
                    if (body.includes('识别中')) return 'recognizing';
                    if (body.includes('识别失败') || body.includes('错误')) return 'error';
                    return 'waiting';
                })()
            ''')
            if state != 'waiting' and state != 'recognizing':
                break
            if i % 5 == 0:
                print(f'  ({i}s) 状态: {state}')

        print(f'  最终状态: {state}')

        # 获取识别结果
        results = session.eval('''
            (() => {
                const body = document.body.innerText;
                const idx = body.indexOf('识别结果');
                if (idx >= 0) return body.substring(idx, idx + 500);
                return body.substring(0, 500);
            })()
        ''')
        print(f'\n[6] 识别结果:\n{results[:500]}')

    # 检查控制台错误
    console_errors = session.eval('''
        (() => {
            const errors = window.__console_errors || [];
            return JSON.stringify(errors.slice(-5));
        })()
    ''')
    print(f'\n控制台错误: {console_errors}')

    session.close()
    print('\n=== 测试完成 ===')
    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())
