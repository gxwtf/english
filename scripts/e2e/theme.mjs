#!/usr/bin/env node
/**
 * 深色模式视觉验收（Playwright + 系统 Edge + 真实 SSO 会话）
 *
 * 用法（仓库根目录）：
 *   node scripts/e2e/theme.mjs                          # 默认页面 × {浅色,深色} × {桌面,手机}
 *   node scripts/e2e/theme.mjs --base=http://127.0.0.1:3103   # 打本地预览（构建产物）
 *   node scripts/e2e/theme.mjs --pages=/,/settings      # 只跑指定页面
 *   node scripts/e2e/theme.mjs --only=dark              # 只跑深色
 *   node scripts/e2e/theme.mjs --anon                   # 不登录（只看公开页）
 *
 * 断言（失败会让退出码为 1）：
 *   1. 深色用例里 <html> 必须带 .dark；浅色用例必须不带
 *   2. 深色页面不得出现「大面积近白块」（可见面积 > 视口 5% 且亮度 > 0.9 的不透明背景）
 *   3. 深色页面的正文文字与自身底色对比度 ≥ 4.5（抽出最差的几处）
 *   4. 「跟随系统」：系统深色 + 未设置 localStorage 时必须变暗；显式选浅色时必须压过系统
 * 截图输出：~/dark-audit/<站点>/<页面>-<主题>-<视口>.png
 *
 * 说明：本脚本与 CLAUDE.md 里的 Chrome MCP 人工验证等价（本机无 Chrome MCP，
 * 用系统 Edge 的 Playwright 无头模式替代，视觉结果以截图为据）。
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright';

import { BASE as LIB_BASE, creds, loginViaSso } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt = '') => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const BASE = arg('base', process.env.E2E_BASE || LIB_BASE);
const SITE =
  arg('site') ||
  (/writing|:31\d\d$/.test(BASE) && existsSync('src/lib/writing-pdf.ts') ? 'writing' : /writing/.test(BASE) ? 'writing' : 'english');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const DEFAULT_PAGES =
  SITE === 'writing'
    ? [
        { path: '/', name: 'home' },
        { path: '/books/all', name: 'entries' },
        { path: '/settings', name: 'settings' },
      ]
    : [
        { path: '/', name: 'home' },
        { path: '/wordbooks', name: 'wordbooks' },
        { path: '/practice', name: 'practice' },
        { path: '/settings', name: 'settings' },
      ];
const PAGES = arg('pages')
  ? arg('pages')
      .split(',')
      .filter(Boolean)
      .map((p) => ({ path: p, name: p.replace(/\//g, '-').replace(/^-/, '') || 'root' }))
  : DEFAULT_PAGES;
const ONLY = arg('only');
const THEMES = ONLY ? [ONLY] : ['light', 'dark'];
const OUT = join(homedir(), 'dark-audit', SITE);

const results = [];
const fail = (msg) => results.push({ ok: false, msg });
const pass = (msg) => results.push({ ok: true, msg });

/** 在页面里跑：找大面积近白块 + 文字对比度不足 */
const AUDIT_FN = () => {
  const parseColor = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => {
    // fg 叠在 bg 上（处理半透明）
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  };
  const effBg = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.95) return c;
      node = node.parentElement;
    }
    const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
    return bodyBg && bodyBg.a > 0.95 ? bodyBg : { r: 255, g: 255, b: 255, a: 1 };
  };
  const vw = innerWidth * innerHeight;
  const whiteBlocks = [];
  const lowContrast = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height < 4) continue;
    // 1) 大面积近白块
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0.9) {
      const l = lum(bg);
      if (l > 0.9 && rect.width * rect.height > vw * 0.05) {
        whiteBlocks.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && String(el.className).slice(0, 90)) || '',
          l: Number(l.toFixed(3)),
          area: Math.round((rect.width * rect.height) / vw * 100),
        });
      }
    }
    // 2) 文字对比度（只看直接含文字的元素）
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    if (rect.bottom < 0 || rect.top > innerHeight * 3) continue;
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bgc = effBg(el);
    const blended = fg.a < 1 ? over(fg, bgc) : fg;
    const l1 = lum(blended);
    const l2 = lum(bgc);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) {
      lowContrast.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 90)) || '',
        text: (el.textContent || '').trim().slice(0, 28),
        ratio: Number(ratio.toFixed(2)),
        fg: cs.color,
        bg: `rgb(${Math.round(bgc.r)},${Math.round(bgc.g)},${Math.round(bgc.b)})`,
      });
    }
  }
  return {
    whiteBlocks: whiteBlocks.slice(0, 8),
    lowContrast: lowContrast.sort((a, b) => a.ratio - b.ratio).slice(0, 8),
    lowContrastCount: lowContrast.length,
  };
};

async function openPage(browser, cookies, pagePath, { theme, colorScheme, viewport }) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme,
    locale: 'zh-CN',
  });
  if (cookies.length) {
    await ctx.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.host,
        path: '/',
        httpOnly: true,
        secure: BASE.startsWith('https'),
      })),
    );
  }
  if (theme) {
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('gx-theme', t);
      } catch {}
    }, theme);
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 等首屏稳定：网络空闲（会话接口 / 列表数据 / dev 首编译）+ 客户端水合
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // 客户端渲染的页面常先出「加载中…」，等到它消失再截图（最多再等 15s）
  await page
    .waitForFunction(
      () => !/^加载中[.…\s]*$/.test(document.querySelector('main')?.textContent?.trim() || ''),
      undefined,
      { timeout: 15000 },
    )
    .catch(() => {});
  return { ctx, page };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let cookies = [];
  if (!has('anon')) {
    const c = creds();
    console.log(`[sso] 登录 ${new URL(BASE).host} …`);
    const session = await loginViaSso({ identifier: c.identifier, password: c.password, system: new URL(BASE).host });
    cookies = session.cookies;
    console.log(`[sso] 会话 cookie: ${cookies.map((x) => x.name).join(', ')}`);
  }

  const browser = await chromium.launch({ executablePath: '/usr/bin/microsoft-edge', headless: true });

  for (const spec of PAGES) {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const label = `${spec.name}-${theme}-${viewport.name}`;
        const { ctx, page } = await openPage(browser, cookies, spec.path, {
          theme,
          colorScheme: theme,
          viewport,
        });
        const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        const file = join(OUT, `${label}.png`);
        await page.screenshot({ path: file, fullPage: true });

        if (theme === 'dark') {
          if (!isDark) fail(`${label}: 深色用例里 <html> 没有 .dark`);
          const audit = await page.evaluate(AUDIT_FN);
          if (audit.whiteBlocks.length) {
            fail(`${label}: 出现大面积近白块 ${JSON.stringify(audit.whiteBlocks.slice(0, 3))}`);
          } else pass(`${label}: 无大面积近白块`);
          if (audit.lowContrast.length) {
            fail(`${label}: 文字对比度不足 ${JSON.stringify(audit.lowContrast.slice(0, 4))}`);
          } else pass(`${label}: 文字对比度合格`);
        } else if (isDark) {
          fail(`${label}: 浅色用例里却带 .dark`);
        } else {
          pass(`${label}: 浅色渲染正常`);
        }
        await ctx.close();
        console.log(`  ✓ ${label} → ${file}`);
      }
    }
  }

  // 「跟随系统」与「显式选择压过系统」两条语义
  const vp = VIEWPORTS[1];
  {
    const { ctx, page } = await openPage(browser, cookies, PAGES[0].path, {
      theme: null,
      colorScheme: 'dark',
      viewport: vp,
    });
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    isDark ? pass('system+系统深色 → 自动变暗') : fail('system+系统深色 → 没有变暗（默认跟随系统失效）');
    await page.screenshot({ path: join(OUT, `system-dark-${vp.name}.png`), fullPage: true });
    await ctx.close();
  }
  {
    const { ctx, page } = await openPage(browser, cookies, PAGES[0].path, {
      theme: 'light',
      colorScheme: 'dark',
      viewport: vp,
    });
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    !isDark ? pass('显式浅色 + 系统深色 → 保持浅色') : fail('显式浅色被系统深色覆盖（localStorage 未生效）');
    await ctx.close();
  }

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log('');
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.msg}`);
  console.log(`\n— ${results.length - bad.length}/${results.length} 项通过，截图在 ${OUT} —`);
  if (bad.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
