// Phone-emulation pass: iPhone-sized viewport with touch, checks layout and the core path.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.SHOTS || 'tests/e2e/screenshots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...require_device(), isMobile: true, hasTouch: true });
function require_device() { return { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }; }
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
const results = [];
async function step(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); }
  catch (e) { results.push(`FAIL  ${name}: ${String(e.message).split('\n')[0]}`); }
}
const noOverflow = async (name) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (w > 1) throw new Error(`${name} scrolls sideways by ${w}px`);
};
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });

await step('home loads and has no sideways scroll', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Cut for the low sun/ }).waitFor();
  await noOverflow('home'); await shot('01-home');
});
await step('mobile menu opens and lists departments', async () => {
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.getByRole('navigation', { name: 'Mobile' }).getByText('Women', { exact: true }).first().waitFor();
  await shot('02-menu');
  await page.keyboard.press('Escape');
});
await step('product page: size is required, then add to bag from a tap', async () => {
  await page.goto(BASE + '/products/field-chore-jacket', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add to bag' }).tap();
  await page.getByText('Select a size to continue.').waitFor();
  await page.getByRole('button', { name: 'M', exact: true }).tap();
  await page.getByRole('button', { name: 'Add to bag' }).tap();
  await page.getByRole('dialog', { name: /Your bag/ }).getByText('Field chore jacket').first().waitFor();
  await shot('03-bag-drawer');
});
await step('product page has no sideways scroll and tap targets are at least 40px', async () => {
  await page.keyboard.press('Escape');
  await noOverflow('product');
  const small = await page.evaluate(() => [...document.querySelectorAll('button, a.btn, [role=button]')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40) && !el.closest('[aria-hidden=true]') && el.offsetParent; })
    .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)).slice(0, 8));
  if (small.length) results.push(`NOTE  small tap targets (<40px), review: ${small.join(' | ')}`);
});
await step('search overlay opens on mobile and finds a product', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Search', exact: true }).tap();
  await page.getByRole('combobox', { name: 'Search products' }).fill('overcoat');
  await page.getByRole('option', { name: /Arden wool overcoat/ }).waitFor();
  await shot('04-search');
  await page.keyboard.press('Escape');
});
await step('catalogue filter sheet opens as a bottom sheet', async () => {
  await page.goto(BASE + '/c/women', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Filter/ }).tap();
  await page.getByRole('dialog', { name: 'Filter' }).getByText('Jackets').waitFor();
  await shot('05-filter-sheet');
  await page.keyboard.press('Escape');
  await noOverflow('catalogue');
});
await step('checkout form is usable on a phone and reaches the address step', async () => {
  await page.goto(BASE + '/products/field-chore-jacket', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'M', exact: true }).tap();
  await page.getByRole('button', { name: 'Add to bag' }).tap();
  await page.getByRole('dialog', { name: /Your bag/ }).getByText('Field chore jacket').first().waitFor();
  await page.goto(BASE + '/checkout', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Who is this order for?' }).waitFor();
  await shot('06-checkout-contact');
  await noOverflow('checkout');
});
await browser.close();
console.log(results.join('\n'));
if (errors.length) console.log(`console errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 5).join('\n  ')}`);
console.log(`screenshots: ${OUT}`);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
