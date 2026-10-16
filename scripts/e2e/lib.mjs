// Shared helpers: obtain a real app session via the gx account SSO, then hand it to Playwright.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const BASE = 'https://english.gxwtf.cn';
const ACCOUNT = 'https://account.gxwtf.cn';

// Credentials come from env, or from creds.json next to this file.
export function creds() {
  if (process.env.GX_IDENT && process.env.GX_PASSWORD) {
    return { identifier: process.env.GX_IDENT, password: process.env.GX_PASSWORD };
  }
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(here, 'creds.json'), 'utf8'));
}

function makeJar() {
  const jar = new Map(); // "host|name" -> value
  return {
    header(host) {
      const out = [];
      for (const [k, v] of jar) {
        const [h, name] = k.split('|');
        if (host === h || host.endsWith('.' + h)) out.push(`${name}=${v}`);
      }
      return out.join('; ');
    },
    store(res) {
      const host = new URL(res.url).hostname;
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const c of raw) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        if (i <= 0) continue;
        const name = pair.slice(0, i).trim();
        const value = pair.slice(i + 1).trim();
        if (value) jar.set(`${host}|${name}`, value);
        else jar.delete(`${host}|${name}`);
      }
    },
    all() {
      return [...jar.entries()].map(([k, v]) => {
        const [host, name] = k.split('|');
        return { host, name, value: v };
      });
    },
  };
}

export async function loginViaSso({ identifier, password, system = 'english.gxwtf.cn', back = '/' }) {
  const jar = makeJar();
  const go = async (url, opts = {}) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) e2e',
      Accept: 'text/html,application/json,*/*',
      ...(opts.headers || {}),
    };
    const ck = jar.header(new URL(url).hostname);
    if (ck) headers.Cookie = ck;
    let lastErr;
    for (let a = 1; a <= 4; a++) {
      try {
        const res = await fetch(url, { ...opts, headers, redirect: 'manual' });
        jar.store(res);
        return res;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1000 * a));
      }
    }
    throw lastErr;
  };

  // 1) authenticate
  let r = await go(`${ACCOUNT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const txt = await r.text();
  if (r.status !== 200 || !txt.includes('userId')) throw new Error(`login failed: ${r.status} ${txt.slice(0, 200)}`);
  const userId = JSON.parse(txt).userId;
  console.log('[sso] logged in userId=', userId);

  // 2) request handoff page
  r = await go(`${ACCOUNT}/sso/login?system=${encodeURIComponent(system)}&back=${encodeURIComponent(back)}`);
  const handoff = await r.text();
  const m = handoff.match(/(https?:\/\/[^"'\s]*\/sso\/callback\?[^"'\s]*)/);
  let callback = m ? m[1] : null;
  if (!callback) {
    const t = handoff.match(/token=([A-Za-z0-9._-]+)/);
    if (t) callback = `http://${system}/sso/callback?back=${encodeURIComponent(back)}&token=${t[1]}`;
  }
  if (!callback) throw new Error('no callback token in handoff page');
  console.log('[sso] callback obtained');

  // 3) redeem on the app, following redirects to land the session cookie
  let url = callback;
  for (let i = 0; i < 10; i++) {
    r = await go(url);
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      url = new URL(r.headers.get('location'), url).href;
      if (url.startsWith('http://')) url = 'https://' + url.slice(7);
      continue;
    }
    break;
  }
  const appCookies = jar.all().filter((c) => c.host === system);
  console.log('[sso] app cookies:', appCookies.map((c) => c.name).join(', ') || '(none)');
  if (appCookies.length === 0) throw new Error('no app session cookie obtained');
  return { userId, cookies: appCookies };
}

export async function newContextWithCookies(browser, cookies) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await ctx.addCookies(
    cookies.map((c) => ({ name: c.name, value: c.value, domain: c.host, path: '/', httpOnly: true, secure: true }))
  );
  return ctx;
}

export function attachLogging(page, tag = '') {
  page.on('console', (m) => {
    const t = m.text();
    if (/batch|Batch|saveWord|action|error|Error/i.test(t)) console.log(`  [console${tag}]`, m.type(), t.slice(0, 300));
  });
  page.on('pageerror', (e) => console.log(`  [pageerror${tag}]`, e.message.slice(0, 300)));
  page.on('requestfailed', (r) => console.log(`  [reqfail${tag}]`, r.url().slice(0, 120), r.failure()?.errorText));
}

export async function dump(page, label) {
  const text = await page.locator('body').innerText().catch(() => '(no body)');
  console.log(`--- ${label} text ---`);
  console.log(text.slice(0, 1500));
  const shot = `/tmp/e2e-${label}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`--- screenshot ${shot} ---`);
}
