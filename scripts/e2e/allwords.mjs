// Regression check: the "所有单词" view has no wordbookId, so batch add must still
// create the words (and must not error), just without wordbook links.
//
// Usage: node scripts/e2e/allwords.mjs <word1,word2>
// Credentials from GX_IDENT / GX_PASSWORD or scripts/e2e/creds.json; run from the repo root.
import { chromium } from 'playwright';
import pg from 'pg';
import dotenv from 'dotenv';
import { BASE, creds, loginViaSso, newContextWithCookies, attachLogging } from './lib.mjs';

dotenv.config({ path: '.env' });
const WORDS = (process.argv[2] || 'melon').split(',').map((w) => w.trim()).filter(Boolean);
const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (s, p) => pool.query(s, p);
let failures = 0;
const check = (ok, label, d = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d ? '  ' + d : ''}`);
  if (!ok) failures++;
};

const { identifier, password } = creds();
const { userId, cookies } = await loginViaSso({ identifier, password });
const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await newContextWithCookies(browser, cookies);
const page = await ctx.newPage();
attachLogging(page);

try {
  await page.goto(BASE + '/wordbooks/all', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4500);
  console.log('[all] url:', page.url());
  check(page.url().includes('/wordbooks/all'), 'reached the all-words view');

  await page.getByRole('button', { name: '添加单词' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '批量添加单词' }).click();
  await page.waitForTimeout(1500);
  const dlg = page.locator('[role="dialog"]').filter({ has: page.locator('h2', { hasText: '批量添加单词' }) });
  check((await dlg.count()) > 0, 'batch dialog opened in all-words view');
  await dlg.locator('#batch-word-input').fill(WORDS.join('\n'));
  await dlg.getByRole('button', { name: '添加', exact: true }).click();
  await page.waitForFunction(
    () => /全部添加成功|部分单词未添加成功/.test(document.body.innerText),
    { timeout: 90000 }
  );
  await page.waitForTimeout(1000);
  const txt = await dlg.innerText();
  check(/全部添加成功/.test(txt), 'no errors in all-words batch add', txt.split('\n').find((l) => /成功/.test(l)) || '');

  const rows = await q('SELECT text FROM "Word" WHERE "userId"=$1 AND text = ANY($2) ORDER BY text', [userId, WORDS]);
  check(rows.rows.length === WORDS.length, 'words created in the user word list', `${rows.rows.length}/${WORDS.length}`);
} catch (e) {
  failures++;
  console.log('ERROR:', e.message);
  try {
    console.log((await page.locator('body').innerText()).slice(0, 1000));
  } catch {}
} finally {
  await browser.close();
  await pool.end();
}
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
