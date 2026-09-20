// screenshot tool: node scripts/shot.mjs <path> <out.png> [user pass] [w] [h] [actions...]
import { chromium } from 'playwright-core';

const [path = '/', out = '/tmp/shot.png', user = 'admin', pass = process.env.ADMIN_PASSWORD || 'carrots', w = 1400, h = 900, ...actions] = process.argv.slice(2);

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(300);
if (user !== '-' && (await page.locator('.login-form').count())) {
  const nameInput = page.locator('.login-form label:first-child input');
  await nameInput.fill(user);
  await page.fill('.login-form input[type=password]', pass);
  if ((await nameInput.inputValue()) !== user) await nameInput.fill(user);
  await page.click('.login-form button');
  await page.waitForSelector('.stack', { timeout: 5000 });
}
if (path !== '/') await page.goto('http://localhost:3000' + path);
for (const a of actions) {
  if (a.startsWith('click:')) await page.click(a.slice(6));
  else if (a.startsWith('fill:')) { const [sel, val] = a.slice(5).split('='); await page.fill(sel, val); }
  else if (a.startsWith('wait:')) await page.waitForTimeout(+a.slice(5));
}
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log('shot →', out);
