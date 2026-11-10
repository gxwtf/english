// E2E regression for 「点击查看例句」 word-card option (word card: 释义优先 / 例句点击查看).
//
// Covers:
//  1. AI 复习 dialog: new checkbox exists, default OFF, disabled while 「AI 生成例句」 is off
//  2. generate word cards with 「AI 生成例句」+「点击查看例句」on -> questionContent.sentencesCollapsed === true
//  3. card back first shows meanings only (no example sentences on screen), 「查看例句」 exists
//  4. clicking 「查看例句」 shows sentences only (meanings hidden), 「返回释义」 exists
//  5. generate again with the option OFF -> back shows meanings + sentences together (old behavior)
//
// Usage (repo root): node scripts/e2e/wordcard.mjs
// Credentials: GX_IDENT / GX_PASSWORD or scripts/e2e/creds.json.
import { chromium } from 'playwright';
import pg from 'pg';
import dotenv from 'dotenv';
import { BASE, creds, loginViaSso, newContextWithCookies, attachLogging } from './lib.mjs';

dotenv.config({ path: '.env' });

const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params);

let failures = 0;
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}
const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();

const { identifier, password } = creds();
const { userId, cookies } = await loginViaSso({ identifier, password });
console.log(`[e2e] user=${identifier} userId=${userId}`);

// pick a wordbook of the test user that has >= 2 words
const bookRow = await q(
  `SELECT b.id, b.name, count(ww.id)::int AS words
     FROM "Wordbook" b JOIN "WordbookWord" ww ON ww."wordbookId" = b.id
    WHERE b."userId"=$1
    GROUP BY b.id, b.name HAVING count(ww.id) >= 2
    ORDER BY b.id DESC LIMIT 1`,
  [userId]
);
if (bookRow.rows.length === 0) throw new Error('no wordbook with >=2 words for test account');
const bookId = bookRow.rows[0].id;
console.log(`[e2e] using wordbook ${bookId} "${bookRow.rows[0].name}" (${bookRow.rows[0].words} words)`);

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await newContextWithCookies(browser, cookies);
const page = await ctx.newPage();
attachLogging(page);

async function openSelector() {
  await page.goto(`${BASE}/wordbooks/${bookId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4500);
  const btn = page.getByRole('button', { name: /AI 复习/ }).first();
  await btn.waitFor({ timeout: 30000 });
  await btn.click();
  await page.waitForTimeout(1200);
  const dialog = page.locator('[role="dialog"]').filter({ hasText: 'AI 复习' }).first();
  await dialog.waitFor({ timeout: 20000 });
  return dialog;
}

// click 单词卡片 type button, set n=1, return dialog
async function selectWordCard(dialog, cardCount = 1) {
  // 题型卡片的可访问名形如「单词卡片 生成单词卡片，点击翻转查看释义」
  await dialog.getByRole('button', { name: /单词卡片\s+生成单词卡片/ }).first().click();
  await page.waitForTimeout(800);
  const inputs = dialog.locator('input[inputmode="numeric"]');
  const count = await inputs.count();
  console.log(`[e2e] word-card numeric inputs: ${count}`);
  const nInput = inputs.first();
  await nInput.click();
  await nInput.fill(String(cardCount));
  await page.waitForTimeout(300);
}

async function generateAndWait(dialog) {
  // NOTE: 不能用 /生成单词卡片/，它会同时匹配题型卡片（描述里含"生成单词卡片"）
  const gen = dialog.getByRole('button', { name: /^生成单词卡片（\d+ 张）$/ });
  const label = await gen.innerText();
  console.log(`[e2e] generate button: ${label}`);
  await gen.click();
  // QuestionQueue.id 是 cuid 字符串（不是数字）
  await page.waitForURL(/\/practice\/[A-Za-z0-9]+$/, { timeout: 90000 });
  const qid = page.url().match(/\/practice\/([A-Za-z0-9]+)$/)[1];
  console.log(`[e2e] question id = ${qid}`);
  return qid;
}

async function waitQuestionStatus(qid, timeoutMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await q(
      `SELECT ("questionContent"->>'aiSentencesStatus') AS status,
              ("questionContent"->>'sentencesCollapsed') AS collapsed
         FROM "QuestionQueue" WHERE id=$1`,
      [qid]
    );
    const row = r.rows[0] || {};
    if (row.status === 'done' || row.status === 'failed') return row;
    await page.waitForTimeout(3000);
  }
  return await (async () => {
    const r = await q(
      `SELECT ("questionContent"->>'aiSentencesStatus') AS status,
              ("questionContent"->>'sentencesCollapsed') AS collapsed
         FROM "QuestionQueue" WHERE id=$1`,
      [qid]
    );
    return r.rows[0] || {};
  })();
}

async function questionContent(qid) {
  const r = await q('SELECT "questionContent" AS c FROM "QuestionQueue" WHERE id=$1', [qid]);
  return r.rows[0].c;
}

// the flipped back face is the only element with backface-visibility:hidden + rotateY(180deg)
function backFace() {
  return page.locator('div[style*="backface-visibility: hidden"][style*="rotateY(180deg)"]').first();
}

async function flipCard() {
  await page.getByText('点击翻转查看释义').first().waitFor({ timeout: 60000 });
  await page.getByText('点击翻转查看释义').first().click();
  await page.waitForTimeout(900); // flip animation 500ms
}

let whiteListScreenshotDone = false;
try {
  // ---------- PART 1: option UI ----------
  let dialog = await openSelector();
  await selectWordCard(dialog, 1);
  const aiCb = dialog.locator('#word-card-ai-sentences');
  const colCb = dialog.locator('#word-card-collapsed-sentences');
  check((await aiCb.count()) === 1, '「AI 生成例句」checkbox present');
  check((await colCb.count()) === 1, '「点击查看例句」checkbox present');
  const aiState = await aiCb.getAttribute('data-state').catch(() => null);
  const colState = await colCb.getAttribute('data-state').catch(() => null);
  check(aiState === 'checked', '「AI 生成例句」defaults to ON', `state=${aiState}`);
  check(colState !== 'checked', '「点击查看例句」defaults to OFF', `state=${colState}`);
  // disabled while AI sentences off
  await aiCb.click();
  await page.waitForTimeout(300);
  check(await colCb.isDisabled(), '「点击查看例句」disabled while「AI 生成例句」is off');
  await aiCb.click();
  await page.waitForTimeout(300);
  check(!(await colCb.isDisabled()), '「点击查看例句」enabled after re-checking「AI 生成例句」');
  await page.screenshot({ path: '/tmp/e2e-wordcard-selector.png', fullPage: false });

  // ---------- PART 2: collapsed mode (ON) ----------
  await colCb.click();
  await page.waitForTimeout(300);
  const qid1 = await generateAndWait(dialog);
  const row1 = await waitQuestionStatus(qid1);
  console.log(`[e2e] q${qid1} aiSentencesStatus=${row1.status} sentencesCollapsed=${row1.collapsed}`);
  const c1 = await questionContent(qid1);
  check(c1.sentencesCollapsed === true, 'questionContent.sentencesCollapsed === true (DB)', `got=${c1.sentencesCollapsed}`);
  check(row1.status === 'done', 'AI sentences finished (done)', `status=${row1.status}`);
  const card1 = c1.cards[0];
  const meanings1 = (card1.meanings || []).filter((m) => (m.content || '').trim());
  const withSentence = meanings1.filter((m) => (m.sentence || '').trim());
  console.log(`[e2e] card="${card1.word}" meanings=${meanings1.length} withSentence=${withSentence.length}`);
  check(withSentence.length > 0, 'at least one meaning has an AI sentence');

  await flipCard();
  const back = backFace();
  await back.waitFor({ timeout: 20000 });
  const backMeaningsText = norm(await back.innerText());
  console.log('--- back (释义视图) ---');
  console.log(backMeaningsText.slice(0, 500));
  const firstMeaning = norm(meanings1[0].content);
  check(backMeaningsText.includes(firstMeaning), '释义视图 shows meaning', `expect="${firstMeaning}"`);
  const leaked1 = withSentence.filter((m) => backMeaningsText.includes(norm(m.sentence)));
  check(leaked1.length === 0, '释义视图 does NOT show any example sentence', leaked1.length ? `leaked=${leaked1.length}` : '');
  check((await page.getByRole('button', { name: '查看例句' }).count()) === 1, '「查看例句」button present in 释义视图');
  check((await page.getByRole('button', { name: '返回释义' }).count()) === 0, '「返回释义」button absent in 释义视图');
  await page.screenshot({ path: '/tmp/e2e-wordcard-meanings.png', fullPage: false });
  whiteListScreenshotDone = true;

  // click 查看例句
  await page.getByRole('button', { name: '查看例句' }).click();
  await page.waitForTimeout(700);
  const backSentencesText = norm(await back.innerText());
  console.log('--- back (例句视图) ---');
  console.log(backSentencesText.slice(0, 500));
  const missing = withSentence.filter((m) => !backSentencesText.includes(norm(m.sentence)));
  check(missing.length === 0, '例句视图 shows every example sentence', missing.length ? `missing=${missing.length}/${withSentence.length}` : '');
  check(!backSentencesText.includes(firstMeaning), '例句视图 hides meanings', `hidden="${firstMeaning}"`);
  check((await page.getByRole('button', { name: '返回释义' }).count()) === 1, '「返回释义」button present in 例句视图');
  await page.screenshot({ path: '/tmp/e2e-wordcard-sentences.png', fullPage: false });

  // back to meanings
  await page.getByRole('button', { name: '返回释义' }).click();
  await page.waitForTimeout(700);
  const backAgain = norm(await back.innerText());
  check(backAgain.includes(firstMeaning), '「返回释义」switches back to meanings');
  check(!backAgain.includes(norm(withSentence[0].sentence)), 'meanings view again hides sentences after toggling back');

  // ---------- PART 3: old mode (OFF) ----------
  dialog = await openSelector();
  await selectWordCard(dialog, 1);
  const colCb2 = dialog.locator('#word-card-collapsed-sentences');
  const st = await colCb2.getAttribute('data-state').catch(() => null);
  console.log(`[e2e] persisted「点击查看例句」state on reopen: ${st}`);
  if (st === 'checked') {
    await colCb2.click();
    await page.waitForTimeout(300);
  }
  check((await colCb2.getAttribute('data-state')) !== 'checked', '「点击查看例句」is OFF for old-mode run');
  const qid2 = await generateAndWait(dialog);
  const row2 = await waitQuestionStatus(qid2);
  const c2 = await questionContent(qid2);
  console.log(`[e2e] q${qid2} aiSentencesStatus=${row2.status} sentencesCollapsed=${c2.sentencesCollapsed}`);
  check(!c2.sentencesCollapsed, 'old mode: questionContent.sentencesCollapsed is falsy', `got=${c2.sentencesCollapsed}`);
  check(row2.status === 'done', 'old mode: AI sentences finished (done)', `status=${row2.status}`);
  const card2 = c2.cards[0];
  const meanings2 = (card2.meanings || []).filter((m) => (m.content || '').trim());
  const sentences2 = meanings2.filter((m) => (m.sentence || '').trim());
  check(sentences2.length > 0, 'old mode: card has AI sentences');

  await flipCard();
  const back2 = backFace();
  await back2.waitFor({ timeout: 20000 });
  const oldText = norm(await back2.innerText());
  console.log('--- old-mode back ---');
  console.log(oldText.slice(0, 500));
  check(oldText.includes(norm(meanings2[0].content)), 'old mode: meaning visible on back');
  check(
    sentences2.every((m) => oldText.includes(norm(m.sentence))),
    'old mode: sentences visible together with meanings (unchanged behavior)'
  );
  check((await page.getByRole('button', { name: /查看例句|返回释义/ }).count()) === 0, 'old mode: no「查看例句/返回释义」toggle button');
  await page.screenshot({ path: '/tmp/e2e-wordcard-oldmode.png', fullPage: false });
} catch (e) {
  failures++;
  console.log('ERROR during e2e:', e.message);
  try {
    await page.screenshot({ path: '/tmp/e2e-error.png', fullPage: true });
    console.log('--- url at failure ---');
    console.log(page.url());
    console.log('--- body at failure ---');
    console.log((await page.locator('body').innerText()).slice(0, 1500));
  } catch {}
} finally {
  await browser.close();
  await pool.end();
}

console.log(`\n[e2e] screenshots: /tmp/e2e-wordcard-selector.png /tmp/e2e-wordcard-meanings.png /tmp/e2e-wordcard-sentences.png /tmp/e2e-wordcard-oldmode.png`);
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
