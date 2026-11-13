// E2E regression for 单词本「选择」模式
//
// 需求：单词本详情页默认**不显示**勾选框（不能勾选），点「选择」后才进入选择模式，
// 出现勾选框、全选、区间选择；退出选择模式后勾选框消失、已选清空。
//
// Covers:
//  1. 默认进入单词本：卡片上没有勾选框；点卡片本体不会选中；批量操作不可用
//  2. 点「选择」：每张卡片出现勾选框；点勾选框 / 点卡片本体都能选中；批量操作徽标计数正确
//  3. 「全选」→ 全部勾选；再点「取消全选」→ 全部取消
//  4. 点「退出」：勾选框消失、已选清空（批量操作重新禁用）
//  5. 手机宽度（390px）下同样成立（图标按钮 + aria-label）
//
// Usage（仓库根目录）：
//   node scripts/e2e/wordbook-select.mjs                     # 默认测本地 http://localhost:3013
//   E2E_BASE=https://english.gxwtf.cn node scripts/e2e/wordbook-select.mjs
// 凭据：GX_IDENT / GX_PASSWORD 或 scripts/e2e/creds.json（SSO 失败时回退为本地签会话）。
import { chromium } from 'playwright';
import pg from 'pg';
import dotenv from 'dotenv';
import { creds, loginViaSso } from './lib.mjs';

dotenv.config({ path: '.env' });

const BASE = process.env.E2E_BASE || 'http://localhost:3013';
const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';
const SHOTS = process.env.SHOT_DIR || '/tmp';

let failures = 0;
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

const CHECKBOX = '[data-slot="checkbox"]';
const BATCH_BUTTON = '[data-batch-button]:visible';

async function countCheckboxes(page) {
  return page.locator(CHECKBOX).count();
}

async function selectedCount(page) {
  // 批量操作按钮上的徽标数字 = 已选数量；按钮 disabled 时说明没选
  const btn = page.locator(BATCH_BUTTON).first();
  const disabled = await btn.isDisabled().catch(() => true);
  if (disabled) return 0;
  const text = (await btn.innerText()).replace(/\s+/g, '');
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : -1;
}

async function cardCount(page) {
  return page.locator('h3').count();
}

/** 打开第一个真实单词本（跳过「所有单词」汇总视图） */
async function openFirstWordbook(page, preferredId) {
  let href = preferredId ? `/wordbooks/${preferredId}` : null;
  if (!href) {
    await page.goto(`${BASE}/wordbooks`, { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[href^="/wordbooks/"]').first();
    await link.waitFor({ timeout: 20000 });
    href = await link.getAttribute('href');
  }
  await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
  await page.locator('h3').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  return href;
}

async function runDesktop(browser, cookies, preferredId) {
  console.log('\n=== 桌面端 1440px ===');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, url: BASE })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 300)));

  const href = await openFirstWordbook(page, preferredId);
  const n = await cardCount(page);
  console.log(`[e2e] 单词本 ${href}，本页 ${n} 张卡片`);
  check(n > 0, '单词本有卡片可测', `n=${n}`);

  // 1) 默认：无勾选框，点卡片不选中
  check((await countCheckboxes(page)) === 0, '默认不显示勾选框', `checkboxes=${await countCheckboxes(page)}`);
  await page.locator('h3').first().click();
  await page.waitForTimeout(300);
  check((await countCheckboxes(page)) === 0, '默认点卡片不出现勾选框');
  check((await selectedCount(page)) === 0, '默认点卡片不会选中（批量操作仍禁用）');
  await page.screenshot({ path: `${SHOTS}/wordbook-select-default.png`, fullPage: false });

  // 2) 点「选择」→ 出现勾选框
  await page.getByRole('button', { name: '选择', exact: true }).click();
  await page.waitForTimeout(400);
  const after = await countCheckboxes(page);
  check(after === n, '点「选择」后每张卡片都出现勾选框', `checkboxes=${after} cards=${n}`);
  check(await page.getByRole('button', { name: '全选', exact: true }).isVisible(), '选择模式下出现「全选」按钮');
  await page.screenshot({ path: `${SHOTS}/wordbook-select-mode.png`, fullPage: false });

  // 3) 勾选：第一张点勾选框，第二张点卡片本体
  await page.locator(CHECKBOX).first().click();
  await page.waitForTimeout(300);
  check((await selectedCount(page)) === 1, '点勾选框选中 1 个', `selected=${await selectedCount(page)}`);
  await page.locator('h3').nth(1).click();
  await page.waitForTimeout(300);
  check((await selectedCount(page)) === 2, '选择模式下点卡片本体也能选中', `selected=${await selectedCount(page)}`);
  await page.screenshot({ path: `${SHOTS}/wordbook-select-2selected.png`, fullPage: false });

  // 4) 全选 / 取消全选
  await page.getByRole('button', { name: '全选', exact: true }).click();
  await page.waitForTimeout(300);
  check((await selectedCount(page)) === n, '「全选」选中本页全部', `selected=${await selectedCount(page)} n=${n}`);
  await page.getByRole('button', { name: '取消全选', exact: true }).click();
  await page.waitForTimeout(300);
  check((await selectedCount(page)) === 0, '再点一次即取消全选');

  // 5) 退出选择模式
  await page.locator(CHECKBOX).first().click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await page.waitForTimeout(400);
  check((await countCheckboxes(page)) === 0, '退出后勾选框消失', `checkboxes=${await countCheckboxes(page)}`);
  check((await selectedCount(page)) === 0, '退出后已选清空（批量操作禁用）');
  check(await page.getByRole('button', { name: '选择', exact: true }).isVisible(), '退出后回到「选择」按钮');
  await page.screenshot({ path: `${SHOTS}/wordbook-select-after-exit.png`, fullPage: false });

  await ctx.close();
}

async function runMobile(browser, cookies, preferredId) {
  console.log('\n=== 手机端 390px ===');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  });
  await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, url: BASE })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 300)));

  await openFirstWordbook(page, preferredId);
  const n = await cardCount(page);
  check(n > 0, '手机端单词本有卡片', `n=${n}`);
  check((await countCheckboxes(page)) === 0, '手机端默认不显示勾选框');

  await page.getByRole('button', { name: '选择', exact: true }).click();
  await page.waitForTimeout(400);
  check((await countCheckboxes(page)) === n, '手机端点「选择」后出现勾选框', `checkboxes=${await countCheckboxes(page)}`);
  await page.screenshot({ path: `${SHOTS}/wordbook-select-mobile-mode.png`, fullPage: false });

  await page.getByRole('button', { name: '全选', exact: true }).click();
  await page.waitForTimeout(300);
  check((await selectedCount(page)) === n, '手机端「全选」可用', `selected=${await selectedCount(page)}`);

  await page.getByRole('button', { name: /退出选择/ }).click();
  await page.waitForTimeout(400);
  check((await countCheckboxes(page)) === 0, '手机端退出后勾选框消失');
  check((await selectedCount(page)) === 0, '手机端退出后已选清空');
  await ctx.close();
}

// ---------- 登录 ----------
const { identifier, password } = creds();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function preferredWordbookId() {
  try {
    const r = await pool.query(
      `SELECT wb.id FROM "Wordbook" wb
         JOIN "User" u ON u."userId" = wb."userId"
         JOIN "WordbookWord" ww ON ww."wordbookId" = wb.id
        WHERE u."userName" = $1
        GROUP BY wb.id
        ORDER BY count(ww."wordId") DESC, wb.id DESC
        LIMIT 1`,
      [identifier],
    );
    return r.rows[0]?.id ?? null;
  } catch (e) {
    console.log('[e2e] 查询单词本失败，改为点列表第一个：', e.message.slice(0, 80));
    return null;
  }
}
let cookies;
try {
  const login = await loginViaSso({ identifier, password });
  cookies = login.cookies;
  console.log(`[e2e] user=${identifier} userId=${login.userId}（SSO 登录）`);
} catch (error) {
  console.log(`[e2e] SSO 登录失败（${error.message.slice(0, 80)}），改用本地签名会话`);
  const row = await pool.query(
    `SELECT "userId","userName",admin,email,"realName" FROM "User" WHERE "userName"=$1 LIMIT 1`,
    [identifier],
  );
  const user = row.rows[0];
  if (!user) throw new Error(`本地也没有用户 ${identifier}`);
  const secret = process.env.SECRET_COOKIE_PASSWORD;
  if (!secret) throw new Error('缺少 SECRET_COOKIE_PASSWORD，无法签名会话');
  const { sealData } = await import('iron-session');
  const sealed = await sealData(
    {
      isLoggedIn: true,
      userId: user.userId,
      userName: user.userName,
      admin: user.admin,
      email: user.email ?? undefined,
      realName: user.realName ?? undefined,
    },
    { password: secret, ttl: 7 * 24 * 60 * 60 },
  );
  cookies = [{ name: 'gxwtf_iron_auth', value: sealed, host: new URL(BASE).hostname }];
  console.log(`[e2e] user=${identifier} userId=${user.userId}（本地签名会话）`);
}

const preferredId = await preferredWordbookId();
await pool.end();
console.log(`[e2e] 使用单词本 id=${preferredId ?? '(列表第一个)'}`);

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  await runDesktop(browser, cookies, preferredId);
  await runMobile(browser, cookies, preferredId);
} finally {
  await browser.close();
}

console.log(`\n[e2e] ${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
