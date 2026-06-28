#!/usr/bin/env python3
"""在浏览器中显示 01.jpg 和裁剪区域，让用户确认 divorce 位置"""
import json, requests, websocket, time, base64, cv2

# 读取 01.jpg 并转 base64
img = cv2.imread('temp/tests/01.jpg')
_, buffer = cv2.imencode('.jpg', img)
img_b64 = base64.b64encode(buffer).decode()

# 裁剪间隙区域
gap = img[1400:1650, :]
_, gap_buffer = cv2.imencode('.jpg', gap)
gap_b64 = base64.b64encode(gap_buffer).decode()

# 连接浏览器
resp = requests.get('http://127.0.0.1:9222/json/list', proxies={'http': None})
pages = resp.json()
target = [p for p in pages if 'localhost:3003' in p.get('url', '')][0]
ws = websocket.create_connection(target['webSocketDebuggerUrl'], timeout=60)

# 在浏览器中显示原图和裁剪区域
html = f"""
(() => {{
    document.body.innerHTML = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>01.jpg 原图 (1080x1920)</h2>
            <img src="data:image/jpeg;base64,{img_b64}" style="max-width: 500px; border: 2px solid blue;" />
            <h2>间隙区域 y=1400-1650 (可能有 divorce)</h2>
            <img src="data:image/jpeg;base64,{gap_b64}" style="max-width: 500px; border: 2px solid red;" />
            <p>如果图片中有 "divorce" 这个词，请告诉我它在哪个区域。</p>
        </div>
    `;
    return 'done';
}})()
"""

ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': html}}))
result = json.loads(ws.recv())
print(f"浏览器显示结果: {result.get('result', {}).get('result', {}).get('value', '')}")

# 截图
time.sleep(2)
ws.send(json.dumps({'id': 2, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}))
result = json.loads(ws.recv())
if 'result' in result:
    img_data = base64.b64decode(result['result']['data'])
    with open('/tmp/01_browser_view.png', 'wb') as f:
        f.write(img_data)
    print("截图已保存: /tmp/01_browser_view.png")

ws.close()
