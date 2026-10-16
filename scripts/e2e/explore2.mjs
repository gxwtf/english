import { chromium } from 'playwright';
import { BASE, creds, loginViaSso, newContextWithCookies, attachLogging, dump } from './lib.mjs';

const { identifier, password } = creds();
const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';

async function visibleButtons(page) {
  const els = await page.locator('button, a, [role="button"]').all();
  const out = [];
  for (const el of els) {
    if (!(await el.isVisible().catch(() => false))) continue;
    const t = (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 60);
    if (t) out.push(t);
  }
  return out;
}

const { cookies } = await loginViaSso({ identifier, password });
const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await newContextWithCookies(browser, cookies);
const page = await ctx.newPage();
attachLogging(page);

const BOOK_NAME = 'E2E-BatchAdd-' + Date.now();

await page.goto(BASE + '/wordbooks', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

console.log('### STEP 1: open create dialog');
await page.getByRole('button', { name: '新建单词本' }).click();
await page.waitForTimeout(1500);
await dump(page, 's1-create-dialog');
console.log('inputs:', await page.locator('input, textarea').count());
for (const el of await page.locator('input, textarea').all()) {
  console.log('  field:', await el.getAttribute('placeholder'), '| id=', await el.getAttribute('id'));
}
console.log('visible buttons:', JSON.stringify(await visibleButtons(page)));

console.log('### STEP 2: fill name + submit');
const nameInput = page.locator('input').filter({ hasNot: page.locator('[type=hidden]') }).first();
await nameInput.fill(BOOK_NAME);
await page.waitForTimeout(500);
await dump(page, 's2-filled');
for (const label of ['创建', '确定', '保存', '新建']) {
  const b = page.getByRole('button', { name: label, exact: true });
  if (await b.count()) {
    console.log('clicking:', label);
    await b.first().click();
    break;
  }
}
await page.waitForTimeout(4000);
await dump(page, 's3-after-create');

console.log('### STEP 3: open the wordbook');
const link = page.getByText(BOOK_NAME, { exact: false }).first();
console.log('book link count:', await page.getByText(BOOK_NAME, { exact: false }).count());
await link.click();
await page.waitForTimeout(5000);
console.log('url:', page.url());
await dump(page, 's4-wordbook-detail');

console.log('### STEP 4: open the add-word modal');
for (const label of ['添加单词', '新建单词', '添加']) {
  const b = page.getByRole('button', { name: label, exact: false });
  if (await b.count()) {
    console.log('clicking add button:', label, 'count=', await b.count());
    await b.first().click();
    break;
  }
}
await page.waitForTimeout(2500);
await dump(page, 's5-add-modal');
console.log('visible buttons:', JSON.stringify(await visibleButtons(page)));

await browser.close();
console.log('BOOK_NAME=' + BOOK_NAME);
