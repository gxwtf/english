import { chromium } from 'playwright';
import { BASE, creds, loginViaSso, newContextWithCookies, attachLogging, dump } from './lib.mjs';

const { identifier, password } = creds();
const EXEC = process.env.BROWSER_PATH || '/usr/bin/microsoft-edge';

const { cookies } = await loginViaSso({ identifier, password });

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
console.log('[browser] version:', browser.version());

const ctx = await newContextWithCookies(browser, cookies);
const page = await ctx.newPage();
attachLogging(page);

await page.goto(BASE + '/wordbooks', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
console.log('url:', page.url());
await dump(page, 'wordbooks');

const els = await page.locator('button, a').all();
console.log('--- interactive elements ---');
for (let i = 0; i < Math.min(els.length, 70); i++) {
  const t = (await els[i].innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 70);
  const tag = await els[i].evaluate((e) => e.tagName.toLowerCase());
  if (t) console.log(`  [${i}] <${tag}> ${t}`);
}

await browser.close();
