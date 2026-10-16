// End-to-end test for 「批量添加单词」 on the live site.
//
// Verifies that words entered in the batch-add dialog are actually linked into the
// wordbook that is currently open (not merely created in the user's global word list).
//
// Usage: node scripts/e2e/batchadd.mjs <word1,word2,word3>
//
// Credentials come from GX_IDENT / GX_PASSWORD, or from scripts/e2e/creds.json.
// Browser: /usr/bin/microsoft-edge by default, override with BROWSER_PATH.
// Must be run from the repo root (reads DATABASE_URL from .env).
import { chromium } from 'playwright';
import pg from 'pg';
import dotenv from 'dotenv';
import { BASE, creds, loginViaSso, newContextWithCookies, attachLogging } from './lib.mjs';

dotenv.config({ path: '.env' });

const args = process.argv.slice(2);
const WORDS = (args[0] || 'apple,banana,orange').split(',').map((w) => w.trim()).filter(Boolean);
const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';
const BOOK_NAME = 'E2E-BatchAdd-' + Date.now();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params);

let failures = 0;
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

const { identifier, password } = creds();
const { userId, cookies } = await loginViaSso({ identifier, password });
console.log(`[e2e] user=${identifier} userId=${userId} words=[${WORDS.join(', ')}]`);

const before = await q('SELECT count(*)::int AS n FROM "WordbookWord" ww JOIN "Wordbook" b ON b.id=ww."wordbookId" WHERE b."userId"=$1', [userId]);
console.log('[e2e] wordbook links for this user before:', before.rows[0].n);

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await newContextWithCookies(browser, cookies);
const page = await ctx.newPage();
attachLogging(page);

let bookId = null;
try {
  // ---- create a fresh wordbook ----
  await page.goto(BASE + '/wordbooks', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: '新建单词本' }).click();
  await page.waitForTimeout(1200);
  await page.locator('input[placeholder="请输入单词本名称"]').fill(BOOK_NAME);
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.waitForTimeout(3500);
  await page.getByText(BOOK_NAME, { exact: false }).first().click();
  await page.waitForTimeout(4500);
  const m = page.url().match(/\/wordbooks\/(\d+)/);
  bookId = m ? Number(m[1]) : null;
  console.log(`[e2e] created wordbook "${BOOK_NAME}" id=${bookId}  url=${page.url()}`);
  if (!bookId) throw new Error('could not determine wordbook id');

  // ---- open batch add dialog ----
  await page.getByRole('button', { name: '添加单词' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '批量添加单词' }).click();
  await page.waitForTimeout(1500);

  const dlg = page.locator('[role="dialog"]').filter({ has: page.locator('h2', { hasText: '批量添加单词' }) });
  check((await dlg.count()) > 0, 'batch-add dialog opened');
  await dlg.locator('#batch-word-input').fill(WORDS.join('\n'));
  await page.waitForTimeout(500);
  const counter = (await dlg.innerText()).match(/共\s*(\d+)\s*个单词/);
  check(counter && Number(counter[1]) === WORDS.length, 'input parsed word count', `shown=${counter ? counter[1] : '?'} expected=${WORDS.length}`);

  // ---- run the batch add ----
  await dlg.getByRole('button', { name: '添加', exact: true }).click();
  console.log('[e2e] clicked 添加, waiting for processing to finish...');
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('全部添加成功') || t.includes('部分单词未添加成功');
    },
    { timeout: 90000 }
  );
  await page.waitForTimeout(1500);
  const summary = await dlg.innerText();
  console.log('--- batch result panel ---');
  console.log(summary.split('\n').filter((l) => /成功|失败|跳过|完成|添加/.test(l)).join('\n'));
  const okMatch = summary.match(/成功\s*(\d+)/);
  check(okMatch && Number(okMatch[1]) === WORDS.length, 'all words reported as saved', `reported=${okMatch ? okMatch[1] : '?'}`);
  await page.screenshot({ path: '/tmp/e2e-batch-result.png', fullPage: true });

  // ---- close dialogs ----
  await dlg.getByRole('button', { name: '完成', exact: true }).click().catch(() => {});
  await page.waitForTimeout(1200);
  const wordModal = page.locator('[role="dialog"]').filter({ has: page.locator('h2', { hasText: '添加单词' }) });
  if (await wordModal.count()) await wordModal.last().getByRole('button', { name: '取消', exact: true }).click().catch(() => {});
  await page.waitForTimeout(2500);

  // ---- verify in the database ----
  const linked = await q(
    `SELECT w.text FROM "WordbookWord" ww JOIN "Word" w ON w.id = ww."wordId"
     WHERE ww."wordbookId" = $1 AND w."userId" = $2 ORDER BY w.text`,
    [bookId, userId]
  );
  const linkedTexts = linked.rows.map((r) => r.text);
  console.log('[e2e] words linked into the wordbook (DB):', JSON.stringify(linkedTexts));
  check(
    WORDS.every((w) => linkedTexts.includes(w)),
    'every batch word is linked into the wordbook (DB)',
    `linked=${linkedTexts.length}/${WORDS.length}`
  );

  const created = await q('SELECT w.text FROM "Word" w WHERE w."userId"=$1 AND w.text = ANY($2) ORDER BY w.text', [userId, WORDS]);
  check(created.rows.length === WORDS.length, 'words exist in the user word list', `found=${created.rows.length}/${WORDS.length}`);

  // ---- verify in the UI ----
  await page.goto(`${BASE}/wordbooks/${bookId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const pageText = await page.locator('body').innerText();
  const missingInUi = WORDS.filter((w) => !pageText.includes(w));
  check(missingInUi.length === 0, 'words visible on the wordbook page (UI)', missingInUi.length ? `missing=${missingInUi}` : '');
  await page.screenshot({ path: '/tmp/e2e-wordbook-final.png', fullPage: true });
} catch (e) {
  failures++;
  console.log('ERROR during e2e:', e.message);
  try {
    await page.screenshot({ path: '/tmp/e2e-error.png', fullPage: true });
    console.log('--- body at failure ---');
    console.log((await page.locator('body').innerText()).slice(0, 1200));
  } catch {}
} finally {
  await browser.close();
  const after = await q('SELECT count(*)::int AS n FROM "WordbookWord" ww JOIN "Wordbook" b ON b.id=ww."wordbookId" WHERE b."userId"=$1', [userId]);
  console.log('[e2e] wordbook links for this user after:', after.rows[0].n);
  await pool.end();
}

console.log(`\n[e2e] wordbookId=${bookId} name=${BOOK_NAME}`);
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
