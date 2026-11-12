// Usage: node tests/e2e/shot.mjs <path> <outfile> [width=1440] [height=900] [full|view] [scrollY]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , path = '/', out = 'shot.png', w = '1440', h = '900', mode = 'full', scroll = '0'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
if (mode === 'full') {
  // trigger lazy images
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
} else if (+scroll) { await page.evaluate((y) => window.scrollTo(0, y), +scroll); await page.waitForTimeout(700); }
await page.screenshot({ path: out, fullPage: mode === 'full' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(JSON.stringify({ out, overflowX: overflow, errors: errors.slice(0, 5) }));
await browser.close();
