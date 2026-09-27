/* 广学英语 PWA Service Worker
 * 策略：
 *   - 导航请求：network-first，失败回退缓存，再回退离线页
 *   - 静态资源（/_next/static、图片、字体）：stale-while-revalidate
 *   - 始终优先网络，避免开发环境缓存到过期内容
 */
const CACHE = 'gxwtf-english-v1';

const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>广学英语 · 离线</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;background:#a31f24;color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;text-align:center;padding:24px}
  .wrap{max-width:22rem}
  h1{font-size:1.4rem;margin:0 0 .75rem}
  p{font-size:.95rem;line-height:1.6;opacity:.9;margin:0 0 1.5rem}
  button{background:#fff;color:#a31f24;border:0;border-radius:999px;padding:.65rem 1.6rem;font-size:1rem;font-weight:600;cursor:pointer}
</style>
</head>
<body>
  <div class="wrap">
    <h1>当前处于离线状态</h1>
    <p>网络恢复后即可继续使用广学英语。你可以先复习已缓存的内容。</p>
    <button onclick="location.reload()">重新加载</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(new Request('/offline.html', { cache: 'reload' })).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|css|js)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 不缓存 SSO / API / Server Action 等动态请求
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/sso/') ||
    request.headers.get('next-action')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const cache = await caches.open(CACHE);
          const offline = await cache.match('/offline.html');
          return (
            offline ||
            new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          );
        })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
