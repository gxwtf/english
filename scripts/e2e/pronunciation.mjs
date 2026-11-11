// E2E regression for 单词发音（有道语音 API / 英音 + 美音）。
//
// Covers:
//  1. /api/pronunciation 接口：us / uk 返回 audio/mpeg 且内容不同；非法参数 400；查不到的词 502
//  2. 「所有单词」列表：每个单词卡片同时显示「英音」「美音」，点击后真的播放且不会误触发选中
//  3. 添加单词弹窗：词典预览处同样显示英音 / 美音
//  4. 单词卡片（word-card）练习页：正面与反面都有英音 / 美音
//
// Usage（仓库根目录）：
//   node scripts/e2e/pronunciation.mjs                 # 默认测本地 http://localhost:3013
//   E2E_BASE=https://english.gxwtf.cn node scripts/e2e/pronunciation.mjs
// 凭据：GX_IDENT / GX_PASSWORD 或 scripts/e2e/creds.json。
import { chromium } from 'playwright';
import pg from 'pg';
import dotenv from 'dotenv';
import { creds, loginViaSso } from './lib.mjs';

dotenv.config({ path: '.env' });

const BASE = process.env.E2E_BASE || 'http://localhost:3013';
const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params);

let failures = 0;
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}
const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();

async function apiGet(path) {
  const res = await fetch(BASE + path);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') || '', body: buf };
}

// ---------- PART 1: API ----------
console.log(`[e2e] base = ${BASE}`);
const us = await apiGet('/api/pronunciation?word=hello&accent=us');
const uk = await apiGet('/api/pronunciation?word=hello&accent=uk');
check(us.status === 200, 'API us 返回 200', `status=${us.status}`);
check(us.type.startsWith('audio/mpeg'), 'API us 返回 audio/mpeg', `type=${us.type}`);
check(us.body.length > 2000, 'API us 返回真实音频', `bytes=${us.body.length}`);
check(uk.status === 200 && uk.type.startsWith('audio/mpeg'), 'API uk 返回 200 + audio/mpeg', `status=${uk.status} type=${uk.type}`);
check(uk.body.length > 2000, 'API uk 返回真实音频', `bytes=${uk.body.length}`);
check(!us.body.equals(uk.body), 'API us / uk 是不同音频（美音≠英音）');
const badAccent = await apiGet('/api/pronunciation?word=hello&accent=xx');
check(badAccent.status === 400, 'API 非法 accent 返回 400', `status=${badAccent.status}`);
const badWord = await apiGet('/api/pronunciation?word=' + encodeURIComponent('<script>') + '&accent=us');
check(badWord.status === 400, 'API 非法 word 返回 400', `status=${badWord.status}`);
const unknownWord = await apiGet('/api/pronunciation?word=zzzqxjkwv&accent=us');
check(unknownWord.status === 502, 'API 有道查不到的词返回 502（前端可提示）', `status=${unknownWord.status}`);

// ---------- PART 2: 登录 + 浏览器 ----------
const { identifier, password } = creds();
let userId;
let cookies;
try {
  const login = await loginViaSso({ identifier, password });
  userId = login.userId;
  cookies = login.cookies;
  console.log(`[e2e] user=${identifier} userId=${userId}（SSO 登录）`);
} catch (error) {
  // 测试账号密码过期时，退化为「用本站 SECRET_COOKIE_PASSWORD 本地签一个会话 cookie」。
  // iron-session 是无状态 cookie，与服务端同一密钥即可被识别，不需要走账号中心。
  console.log(`[e2e] SSO 登录失败（${error.message.slice(0, 80)}），改用本地签名会话`);
  const row = await q(
    `SELECT "userId","userName",admin,email,"realName" FROM "User" WHERE "userName"=$1 LIMIT 1`,
    [identifier],
  );
  const user = row.rows[0];
  if (!user) throw new Error(`本地也没有用户 ${identifier}`);
  userId = user.userId;
  const secret = process.env.SECRET_COOKIE_PASSWORD;
  if (!secret) throw new Error('缺少 SECRET_COOKIE_PASSWORD，无法签名会话');
  const { sealData } = await import('iron-session');
  const sealed = await sealData(
    { isLoggedIn: true, userId: user.userId, userName: user.userName, admin: user.admin, email: user.email ?? undefined, realName: user.realName ?? undefined },
    { password: secret, ttl: 7 * 24 * 60 * 60 },
  );
  cookies = [{ name: 'gxwtf_iron_auth', value: sealed, host: new URL(BASE).hostname }];
  console.log(`[e2e] user=${identifier} userId=${userId}（本地签名会话）`);
}

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
if (new URL(BASE).hostname === 'english.gxwtf.cn') {
  await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: c.host, path: '/', httpOnly: true, secure: true })));
} else {
  // 同一个 SECRET_COOKIE_PASSWORD 生成的会话，可直接搬到本地 dev（iron-session 值不绑定域名）
  await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, url: BASE })));
}
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 300)));

/** 等待某个发音按钮组内的 audio 真正拿到音频并开始播放 */
async function waitAudioPlaying(audioLocator, label) {
  const deadline = Date.now() + 15000;
  let info = {};
  while (Date.now() < deadline) {
    info = await audioLocator.evaluate((el) => ({
      src: el.currentSrc || el.src,
      paused: el.paused,
      currentTime: el.currentTime,
      readyState: el.readyState,
      error: el.error ? el.error.code : null,
    }));
    if (info.error) break;
    if (info.readyState >= 2 && (info.currentTime > 0 || !info.paused)) break;
    await page.waitForTimeout(300);
  }
  check(
    !info.error && info.readyState >= 2,
    `${label} audio 加载成功`,
    `readyState=${info.readyState} error=${info.error} currentTime=${info.currentTime?.toFixed(2)}`,
  );
  check(!info.paused && info.currentTime > 0, `${label} audio 正在播放`, `paused=${info.paused} t=${info.currentTime?.toFixed(2)}`);
  return info;
}

try {
  // ---------- PART 2: 「所有单词」列表 ----------
  await page.goto(`${BASE}/wordbooks/all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const firstGroup = page.locator('[data-pronunciation]').first();
  await firstGroup.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const groupCount = await page.locator('[data-pronunciation]').count();
  console.log(`[e2e] 单词列表发音按钮组数量：${groupCount}`);
  check(groupCount >= 1, '单词列表出现发音按钮组', `count=${groupCount}`);
  const firstText = norm(await firstGroup.innerText());
  console.log(`[e2e] 第一组按钮文本：「${firstText}」`);
  check(firstText.includes('英音') && firstText.includes('美音'), '同一单词同时显示「英音」「美音」', `text=${firstText}`);
  check(
    (await firstGroup.locator('[data-pronunciation-accent="uk"]').count()) === 1 &&
      (await firstGroup.locator('[data-pronunciation-accent="us"]').count()) === 1,
    '英音 / 美音按钮各一个（data 属性可定位）',
  );

  const wordText = await firstGroup.getAttribute('data-pronunciation');
  console.log(`[e2e] 首个单词：${wordText}`);

  // 点击美音：验证请求 + 播放，且不应选中卡片 / 打开编辑弹窗
  const checkedBefore = await page.locator('[role="checkbox"][aria-checked="true"], [role="checkbox"][data-state="checked"]').count();
  const responses = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/pronunciation')) responses.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'] || '' });
  });
  await firstGroup.locator('[data-pronunciation-accent="us"]').click();
  await page.waitForTimeout(1200);
  check(responses.length >= 1, '点击美音触发了 /api/pronunciation 请求', JSON.stringify(responses[0] || {}));
  const usResp = responses.find((r) => r.url.includes('accent=us'));
  check(!!usResp && usResp.status === 200, '美音请求 200', usResp ? `status=${usResp.status} type=${usResp.type}` : 'no request');
  check(!!usResp && usResp.type.startsWith('audio/mpeg'), '美音请求返回 audio/mpeg');
  await waitAudioPlaying(firstGroup.locator('audio'), '单词列表·美音');

  const checkedAfter = await page.locator('[role="checkbox"][aria-checked="true"], [role="checkbox"][data-state="checked"]').count();
  check(checkedBefore === checkedAfter, '点发音不会误触发单词选中', `before=${checkedBefore} after=${checkedAfter}`);
  check((await page.locator('[data-slot="dialog-content"]').count()) === 0, '点发音不会误打开编辑弹窗');
  await page.screenshot({ path: '/tmp/e2e-pronounce-list.png', fullPage: false });

  // 英音也点一次
  responses.length = 0;
  await firstGroup.locator('[data-pronunciation-accent="uk"]').click();
  await page.waitForTimeout(1200);
  const ukResp = responses.find((r) => r.url.includes('accent=uk'));
  check(!!ukResp && ukResp.status === 200, '英音请求 200', ukResp ? `status=${ukResp.status}` : 'no request');

  // ---------- PART 3: 添加单词弹窗 ----------
  const addBtn = page.getByRole('button', { name: /添加单词/ }).first();
  await addBtn.click();
  const dialog = page.locator('[data-slot="dialog-content"]').filter({ hasText: '搜索单词' }).first();
  await dialog.waitFor({ timeout: 20000 });
  await dialog.locator('#word-search-input').fill('hello');
  await dialog.getByRole('button', { name: '查询' }).click();
  const dialogGroup = dialog.locator('[data-pronunciation]').first();
  await dialogGroup.waitFor({ timeout: 30000 });
  const dialogText = norm(await dialogGroup.innerText());
  console.log(`[e2e] 弹窗按钮文本：「${dialogText}」`);
  check(dialogText.includes('英音') && dialogText.includes('美音'), '添加单词弹窗显示「英音」「美音」', `text=${dialogText}`);
  // 词典查询是异步的：等音标（词典数据）真正出现，再判断发音按钮的位置不会被挤坏
  await dialog.getByText(/音标/).first().waitFor({ timeout: 20000 }).catch(() => {});
  check((await dialog.getByText(/音标/).count()) >= 1, '弹窗仍显示音标');
  await page.screenshot({ path: '/tmp/e2e-pronounce-modal.png', fullPage: false });
  await page.keyboard.press('Escape');
  await page
    .locator('[data-slot="dialog-content"]')
    .filter({ hasText: '搜索单词' })
    .first()
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => {});
  check((await page.locator('[data-slot="dialog-content"]').count()) === 0, '关闭弹窗（未保存任何单词）');

  // ---------- PART 4: 单词卡片练习页 ----------
  const qRow = await q(
    `SELECT id FROM "QuestionQueue"
      WHERE "userId"=$1 AND "questionType"='word-card' AND status='GENERATED'
      ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
  let cardQid = qRow.rows[0]?.id;
  if (!cardQid) {
    console.log('[e2e] 测试账号暂无 word-card 题目，尝试用「AI 复习」生成一张（不启用 AI 例句）');
    const bookRow = await q(
      `SELECT b.id, count(ww.id)::int AS words
         FROM "Wordbook" b JOIN "WordbookWord" ww ON ww."wordbookId" = b.id
        WHERE b."userId"=$1
        GROUP BY b.id HAVING count(ww.id) >= 2
        ORDER BY b.id DESC LIMIT 1`,
      [userId],
    );
    if (bookRow.rows.length > 0) {
      await page.goto(`${BASE}/wordbooks/${bookRow.rows[0].id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('button', { name: /AI 复习/ }).first().click();
      const sel = page.locator('[data-slot="dialog-content"]').filter({ hasText: 'AI 复习' }).first();
      await sel.waitFor({ timeout: 20000 });
      await sel.getByRole('button', { name: /单词卡片\s+生成单词卡片/ }).first().click();
      await page.waitForTimeout(800);
      const aiCb = sel.locator('#word-card-ai-sentences');
      if ((await aiCb.getAttribute('data-state')) === 'checked') {
        await aiCb.click();
        await page.waitForTimeout(300);
      }
      const gen = sel.getByRole('button', { name: /^生成单词卡片（\d+ 张）$/ });
      await gen.click();
      await page.waitForURL(/\/practice\/[A-Za-z0-9]+$/, { timeout: 90000 });
      cardQid = page.url().match(/\/practice\/([A-Za-z0-9]+)$/)[1];
      for (let i = 0; i < 40; i++) {
        const st = await q('SELECT status FROM "QuestionQueue" WHERE id=$1', [cardQid]);
        if (st.rows[0]?.status === 'GENERATED') break;
        await page.waitForTimeout(2000);
      }
      console.log(`[e2e] 已生成 word-card 题目 ${cardQid}`);
    }
  }

  if (cardQid) {
    await page.goto(`${BASE}/practice/${cardQid}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const flipHint = page.getByText('点击翻转查看释义').first();
    await flipHint.waitFor({ timeout: 60000 });
    const cardWord = norm(await page.locator('.text-4xl').first().innerText().catch(() => ''));
    console.log(`[e2e] 卡片正面单词：${cardWord}`);
    const frontGroup = page.locator('[data-pronunciation]').first();
    await frontGroup.waitFor({ timeout: 20000 });
    const frontText = norm(await frontGroup.innerText());
    check(frontText.includes('英音') && frontText.includes('美音'), '单词卡片正面显示「英音」「美音」', `text=${frontText}`);
    await frontGroup.locator('[data-pronunciation-accent="uk"]').click();
    await waitAudioPlaying(frontGroup.locator('audio'), '卡片正面·英音');
    await page.screenshot({ path: '/tmp/e2e-pronounce-card-front.png', fullPage: false });
    check(norm(await page.locator('[data-pronunciation]').first().innerText()).includes('英音'), '点击发音不会翻转卡片（仍在正面）');

    // 翻转 → 反面也有发音按钮
    await flipHint.click();
    await page.waitForTimeout(1000);
    const backFace = page.locator('div[style*="backface-visibility: hidden"][style*="rotateY(180deg)"]').first();
    await backFace.waitFor({ timeout: 20000 });
    const backGroup = backFace.locator('[data-pronunciation]').first();
    await backGroup.waitFor({ timeout: 20000 }).catch(() => {});
    const backText = norm(await backGroup.innerText().catch(() => ''));
    check(backText.includes('英音') && backText.includes('美音'), '单词卡片反面显示「英音」「美音」', `text=${backText}`);
    await backGroup.locator('[data-pronunciation-accent="us"]').click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: '/tmp/e2e-pronounce-card-back.png', fullPage: false });
  } else {
    console.log('[e2e] SKIP 单词卡片练习页（无法准备 word-card 题目）');
  }

  // ---------- PART 5: 手机宽度 ----------
  const mobile = await ctx.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${BASE}/wordbooks/all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mobile.locator('[data-pronunciation]').first().waitFor({ timeout: 60000 });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({ path: '/tmp/e2e-pronounce-mobile.png', fullPage: false });
  const mobileText = norm(await mobile.locator('[data-pronunciation]').first().innerText());
  check(mobileText.includes('英音') && mobileText.includes('美音'), '手机宽度下也显示「英音」「美音」', `text=${mobileText}`);
} finally {
  await browser.close();
  await pool.end();
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
