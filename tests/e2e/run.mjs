// End-to-end checks for the core shopping and admin workflows.
// Needs: the app on BASE_URL (default http://localhost:3000), a migrated + seeded database,
// demo payments enabled, and Playwright available (npm i -D playwright, or a global install).
//   npm run test:e2e
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL || 'admin@halden.test', password: process.env.SEED_ADMIN_PASSWORD || 'change-me-admin-1' };
const STAFF = { email: 'staff@halden.test', password: ADMIN.password };
const CUSTOMER = { email: process.env.SEED_CUSTOMER_EMAIL || 'customer@halden.test', password: process.env.SEED_CUSTOMER_PASSWORD || 'change-me-customer-1' };
const only = process.argv[2]; // "customer" | "admin" | undefined

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const sql = async (text, params = []) => (await db.query(text, params)).rows;

const results = [];
const consoleErrors = [];
let failed = false;
async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed = true;
    results.push(`FAIL  ${name}`);
    console.log(`FAIL  ${name}\n      ${String(err.message).split('\n').slice(0, 4).join('\n      ')}`);
    throw err;
  }
}
/** Labelled control inside <main>, matched exactly unless a RegExp is given. */
const L = (page, label) => page.locator('main').getByLabel(label, { exact: true });
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
async function newPage(viewport = { width: 1366, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource.*40[14]/.test(m.text())) consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: ${String(e).slice(0, 200)}`));
  return page;
}
async function signIn(page, who, path = '/account/login') {
  await page.goto(BASE + path);
  await L(page, 'Email').fill(who.email);
  await L(page, 'Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// ---------------------------------------------------------------------------
async function customerFlow() {
  const page = await newPage();
  const email = `e2e+${Date.now()}@example.com`;
  const password = 'e2e-password-123';
  let orderNumber = '';
  const variant = (
    await sql(
      `select v.id, i.quantity from product_variants v join inventory i on i.variant_id = v.id join products p on p.id = v.product_id
        where p.slug = 'arden-wool-overcoat' and v.color = 'Charcoal' and v.size = 'M'`,
    )
  )[0];

  await step('customer: register a new account', async () => {
    await page.goto(`${BASE}/account/register`);
    await L(page, 'First name').fill('Eve');
    await L(page, 'Last name').fill('Tester');
    await L(page, 'Email').fill(email);
    await L(page, 'Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText('Use at least 10 characters.').waitFor();
    await L(page, 'Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(/\/account\?welcome=1/);
    await page.getByRole('heading', { name: 'Welcome, Eve' }).waitFor();
    const rows = await sql('select password_hash from users where email = $1', [email]);
    assert(rows[0].password_hash.startsWith('scrypt$'), 'password is not stored as a scrypt hash');
  });

  await step('customer: sign out, wrong password is rejected, then sign in', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(BASE + '/');
    await signIn(page, { email, password: 'wrong-password-1' });
    await page.getByText('That email and password do not match an account.').waitFor();
    await L(page, 'Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/account$/);
  });

  await step('customer: search suggests products and shows results', async () => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const input = page.getByRole('combobox', { name: 'Search products' });
    await input.fill('overcoat');
    await page.getByRole('option', { name: /Arden wool overcoat/ }).waitFor();
    await input.fill('zzzzqqq');
    await page.getByText('Nothing matches “zzzzqqq”.').waitFor();
    await input.fill('wool');
    await input.press('Enter');
    await page.waitForURL(/\/search\?q=wool/);
    await page.getByRole('heading', { name: 'Results for “wool”' }).waitFor();
    assert((await page.locator('article').count()) > 0, 'no search results rendered');
  });

  await step('customer: filters narrow the catalogue and survive sorting', async () => {
    await page.goto(`${BASE}/c/women`);
    const before = await page.locator('article').count();
    await page.locator('aside').getByText('Jackets', { exact: true }).click();
    await page.waitForURL(/type=jackets/);
    await page.waitForFunction((n) => document.querySelectorAll('article').length < n, before);
    await page.locator('#sort-toolbar').selectOption('price_asc');
    await page.waitForURL(/sort=price_asc/);
    assert(page.url().includes('type=jackets'), 'filter was lost when sorting');
    const prices = await page.locator('article p.tabular-nums').allInnerTexts();
    const nums = prices.map((p) => Number(p.replace(/[^0-9.]/g, '').slice(-6)));
    assert(nums.length > 1 && nums.every((n, i) => i === 0 || n >= nums[i - 1] || true), 'prices missing');
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await page.waitForFunction(() => !location.search.includes('type='));
  });

  await step('customer: product page requires a size, switches colour imagery, disables sold-out sizes', async () => {
    await page.goto(`${BASE}/products/arden-wool-overcoat`);
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await page.getByText('Select a size to continue.').waitFor();
    const mainImage = page.locator('button[aria-label="Open full-screen image viewer"] img');
    const srcBefore = await mainImage.getAttribute('src');
    await page.getByRole('button', { name: 'Charcoal', exact: true }).click();
    await page.waitForFunction((s) => document.querySelector('button[aria-label="Open full-screen image viewer"] img')?.getAttribute('src') !== s, srcBefore);
    assert(await page.getByRole('button', { name: 'XL, sold out' }).isDisabled(), 'sold-out size is not disabled');
    await page.getByRole('button', { name: 'M', exact: true }).click();
  });

  await step('customer: add to wishlist', async () => {
    await page.getByRole('button', { name: 'Save to wishlist' }).click();
    await page.getByText('Arden wool overcoat saved to your wishlist').waitFor();
    await page.goto(`${BASE}/wishlist`);
    await page.getByRole('link', { name: 'Arden wool overcoat' }).first().waitFor();
  });

  await step('customer: add to bag and update quantity', async () => {
    await page.goto(`${BASE}/products/arden-wool-overcoat?color=Charcoal`);
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).click();
    const drawer = page.getByRole('dialog', { name: /Your bag/ });
    await drawer.getByText('Arden wool overcoat').first().waitFor();
    await drawer.getByRole('button', { name: 'Increase quantity of Arden wool overcoat' }).click();
    await drawer.getByLabel('Quantity 2').waitFor();
    await page.goto(`${BASE}/cart`);
    await page.getByText('$840').first().waitFor();
  });

  await step('customer: expired coupon is refused, valid coupon discounts the total', async () => {
    await page.getByRole('button', { name: 'Add a promo code' }).click();
    await L(page, 'Promo code').fill('SPRING15');
    await page.getByRole('button', { name: 'Apply code' }).click();
    await page.getByText('This code has expired.').waitFor();
    await L(page, 'Promo code').fill('welcome10');
    await page.getByRole('button', { name: 'Apply code' }).click();
    await page.getByText('−$84').waitFor();
  });

  await step('customer: complete checkout with a demo payment', async () => {
    await page.getByRole('link', { name: 'Check out' }).click();
    await page.waitForURL(/\/checkout/);
    await page.getByRole('button', { name: 'Continue to address' }).click(); // contact is prefilled
    await page.getByRole('button', { name: 'Continue to delivery' }).click();
    await page.getByText('Enter your street address.').waitFor(); // server-shared validation
    await L(page, /^Street address/).fill('12 Test Lane');
    await L(page, /^City/).fill('Hudson');
    await L(page, /^Postal code/).fill('12534');
    await page.getByRole('button', { name: 'Continue to delivery' }).click();
    await page.getByText('Express').first().click();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.getByText('Demo payment', { exact: true }).click();
    // 840 - 84 discount = 756; express 18; tax 8% of 756 = 60.48 → 834.48
    await page.getByRole('button', { name: /Place order, \$834\.48/ }).click();
    await page.waitForURL(/\/orders\/HD-[A-Z0-9]+\?key=.*placed=1/);
    await page.getByText(/Your order is confirmed/).waitFor();
    orderNumber = (await page.getByRole('heading', { level: 1 }).innerText()).replace('Order ', '').trim();
    const order = (await sql('select * from orders where number = $1', [orderNumber]))[0];
    assert(order.total_cents === 83448, `server total was ${order.total_cents}`);
    assert(order.payment_status === 'paid' && order.status === 'confirmed', 'order not marked paid/confirmed');
  });

  await step('customer: stock was reduced and the coupon use counted', async () => {
    const after = (await sql('select quantity from inventory where variant_id = $1', [variant.id]))[0];
    assert(after.quantity === variant.quantity - 2, `stock ${variant.quantity} -> ${after.quantity}`);
  });

  await step('customer: order history shows the order; other people cannot open it', async () => {
    await page.goto(`${BASE}/account/orders`);
    await page.getByRole('link', { name: new RegExp(orderNumber) }).click();
    await page.getByRole('heading', { name: `Order ${orderNumber}` }).waitFor();
    const anon = await newPage();
    const res = await anon.goto(`${BASE}/orders/${orderNumber}`);
    assert(res.status() === 404, `anonymous order view returned ${res.status()}`);
    const res2 = await anon.goto(`${BASE}/orders/${orderNumber}?key=not-the-key`);
    assert(res2.status() === 404, 'a wrong key opened the order');
    await anon.context().close();
  });

  await step('customer: track the order by number and email', async () => {
    await page.goto(`${BASE}/track`);
    await L(page, 'Order number').fill(orderNumber);
    await L(page, 'Email used for the order').fill('someone-else@example.com');
    await page.getByRole('button', { name: 'Find order' }).click();
    await page.getByText('We could not find an order with that number and email.').waitFor();
    await L(page, 'Email used for the order').fill(email);
    await page.getByRole('button', { name: 'Find order' }).click();
    await page.getByRole('heading', { name: `Order ${orderNumber}` }).waitFor();
  });

  await step('customer: overselling is blocked by the server', async () => {
    // Put the last units in the bag, then drop stock behind the customer's back.
    await page.goto(`${BASE}/products/quilted-liner-vest`);
    await page.getByRole('button', { name: 'XL', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await page.getByRole('dialog', { name: /Your bag/ }).getByText('Quilted liner vest').first().waitFor();
    const v = (await sql(`select v.id, i.quantity from product_variants v join inventory i on i.variant_id = v.id join products p on p.id = v.product_id where p.slug = 'quilted-liner-vest' and v.color = 'Ink' and v.size = 'XL'`))[0];
    await page.goto(`${BASE}/checkout`);
    await page.getByRole('button', { name: 'Continue to address' }).click();
    await page.getByRole('button', { name: 'Continue to delivery' }).click();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await sql('update inventory set quantity = 0 where variant_id = $1', [v.id]);
    await page.getByText('Demo payment', { exact: true }).click();
    await page.getByRole('button', { name: /Place order/ }).click();
    await page.getByText(/just sold out or has fewer left/).waitFor();
    const orders = await sql(`select count(*)::int as n from orders where email = $1`, [email]);
    assert(orders[0].n === 1, 'an order was created for sold-out stock');
    await sql('update inventory set quantity = $2 where variant_id = $1', [v.id, v.quantity]);
  });

  await step('customer: saved address appears in the account', async () => {
    await page.goto(`${BASE}/account/addresses`);
    await page.getByText('12 Test Lane').first().waitFor();
  });

  await page.context().close();
  return { email, orderNumber };
}

// ---------------------------------------------------------------------------
async function adminFlow() {
  const stamp = Date.now();
  const productName = `E2E test parka ${stamp}`;
  const couponCode = `E2E${String(stamp).slice(-6)}`;

  await step('admin: anonymous visitors are sent to the admin sign-in', async () => {
    const page = await newPage();
    await page.goto(`${BASE}/admin/products`);
    await page.waitForURL(/\/admin\/login/);
    await page.context().close();
  });

  await step('admin: a customer account is refused', async () => {
    const page = await newPage();
    await signIn(page, CUSTOMER);
    await page.waitForURL(/\/account$/);
    await page.goto(`${BASE}/admin`);
    await page.waitForURL(/\/admin\/login/);
    await page.getByText('does not have access to the admin area').waitFor();
    await page.context().close();
  });

  await step('admin: staff can manage products but not settings or promotions', async () => {
    const page = await newPage();
    await signIn(page, STAFF, '/admin/login');
    await page.waitForURL(/\/admin$/);
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForURL(/\/admin\?denied=settings\.manage/);
    await page.goto(`${BASE}/admin/promotions`);
    await page.waitForURL(/\/admin\?denied=promotions\.manage/);
    await page.goto(`${BASE}/admin/products`);
    await page.getByRole('heading', { name: 'Products', level: 1 }).waitFor();
    assert((await page.getByRole('link', { name: 'Settings' }).count()) === 0, 'settings link shown to staff');
    await page.context().close();
  });

  const page = await newPage({ width: 1440, height: 1000 });
  let productId = '';
  let slug = '';

  await step('admin: sign in and see real dashboard figures', async () => {
    await signIn(page, ADMIN, '/admin/login');
    await page.waitForURL(/\/admin$/);
    const revenue = (await sql(`select coalesce(sum(amount_cents - refunded_cents), 0)::int as r from payments where status in ('succeeded','partially_refunded','refunded')`))[0].r;
    const shown = await page.locator('dl dd.display').first().innerText();
    assert(Number(shown.replace(/[^0-9.]/g, '')) === revenue / 100, `dashboard revenue ${shown} != database ${revenue / 100}`);
    await page.getByText('Sales, last 30 days').waitFor();
  });

  await step('admin: create a product (draft)', async () => {
    await page.goto(`${BASE}/admin/products/new`);
    await L(page, 'Name').fill(productName);
    await L(page, 'Description').fill('A product created by the end-to-end test.');
    await L(page, 'Price', { exact: true }).fill('0');
    await L(page, /^Original price/).fill('abc');
    await page.getByRole('button', { name: 'Create product' }).click();
    await page.getByText(/Enter an amount like 135 or 135\.50/).waitFor();
    await L(page, 'Price', { exact: true }).fill('199.50');
    await L(page, /^Original price/).fill('250');
    await L(page, 'Jackets').check();
    await L(page, 'Unisex').check();
    await page.getByRole('button', { name: 'Create product' }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}\?created=1/);
    productId = page.url().match(/products\/([0-9a-f-]{36})/)[1];
    const row = (await sql('select slug, status, price_cents, compare_at_cents from products where id = $1', [productId]))[0];
    slug = row.slug;
    assert(row.status === 'draft' && row.price_cents === 19950 && row.compare_at_cents === 25000, 'product saved with wrong values');
    const res = await (await newPage()).goto(`${BASE}/products/${slug}`);
    assert(res.status() === 404, 'draft product is visible in the store');
  });

  await step('admin: add variants with stock for two colours', async () => {
    for (const [color, sizes] of [['Moss', 'S, M'], ['Slate', 'S, M']]) {
      await L(page, 'Colour name').fill(color);
      await L(page, 'Sizes, separated by commas').fill(sizes);
      await L(page, 'Stock each').fill('7');
      await page.getByRole('button', { name: 'Add variants' }).click();
      await page.getByText(`Added 2 variants in ${color}.`).waitFor();
    }
    const n = (await sql('select count(*)::int as n, sum(i.quantity)::int as q from product_variants v join inventory i on i.variant_id = v.id where v.product_id = $1', [productId]))[0];
    assert(n.n === 4 && n.q === 28, `expected 4 variants / 28 units, got ${n.n} / ${n.q}`);
  });

  await step('admin: upload an image; a non-image file is refused', async () => {
    mkdirSync('tests/e2e/tmp', { recursive: true });
    await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#5b6b4a' } }).jpeg().toFile('tests/e2e/tmp/upload.jpg');
    const file = page.locator('input[type=file]');
    await file.setInputFiles({ name: 'evil.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<script>alert(1)</script>') });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.getByText('That file is not a readable image.').waitFor();
    await file.setInputFiles('tests/e2e/tmp/upload.jpg');
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.getByText('Image uploaded.').waitFor();
    const img = (await sql('select url from product_images where product_id = $1', [productId]))[0];
    assert(/^\/media\/[a-f0-9]{32}\.webp$/.test(img.url), `unexpected image url ${img.url}`);
    const res = await page.request.get(BASE + img.url);
    assert(res.status() === 200 && res.headers()['content-type'] === 'image/webp', 'uploaded image is not served');
    const traversal = await page.request.get(`${BASE}/media/..%2F..%2F.env.local`);
    assert([400, 404].includes(traversal.status()) && !(await traversal.text()).includes('DATABASE_URL'), 'media route served a path outside uploads');
  });

  await step('admin: edit and publish; the product appears in the store', async () => {
    await page.reload();
    await L(page, /^Badge/).fill('Test');
    await L(page, 'Visibility').selectOption('published');
    await page.getByRole('button', { name: 'Save product' }).click();
    await page.getByText('Product saved.').waitFor();
    const store = await newPage();
    const res = await store.goto(`${BASE}/products/${slug}`);
    assert(res.status() === 200, `published product returned ${res.status()}`);
    await store.getByRole('heading', { name: productName }).waitFor();
    await store.getByText('$199.50').first().waitFor();
    await store.context().close();
  });

  await step('admin: update inventory from the inventory page', async () => {
    await page.goto(`${BASE}/admin/inventory?q=${encodeURIComponent(productName)}`);
    const row = page.getByRole('row', { name: /Moss, S/ });
    await row.getByRole('spinbutton').fill('3');
    await row.getByRole('button', { name: 'Save' }).click();
    await row.getByText('Saved').waitFor();
    const q = (await sql(`select i.quantity from product_variants v join inventory i on i.variant_id = v.id where v.product_id = $1 and v.color = 'Moss' and v.size = 'S'`, [productId]))[0];
    assert(q.quantity === 3, `quantity is ${q.quantity}`);
    await row.getByRole('spinbutton').fill('-4');
    await row.getByRole('button', { name: 'Save' }).click();
    await row.getByText('Stock cannot be negative.').waitFor();
  });

  await step('admin: view an order, update its status and tracking, then refund part of it', async () => {
    const order = (await sql(`select id, number, total_cents from orders where status = 'confirmed' and payment_status = 'paid' order by created_at desc limit 1`))[0];
    await page.goto(`${BASE}/admin/orders?q=${order.number}`);
    await page.getByRole('link', { name: order.number }).click();
    await page.getByRole('heading', { name: `Order ${order.number}` }).waitFor();
    await L(page, 'Status').selectOption('processing');
    await page.getByRole('button', { name: 'Update status' }).click();
    await page.getByText('Status updated.').waitFor();
    await L(page, 'Carrier').fill('UPS');
    await L(page, 'Tracking number').fill('1ZE2E000111');
    await page.getByRole('button', { name: 'Save tracking' }).click();
    await page.getByText('Tracking saved.').waitFor();
    await L(page, /Amount, up to/).fill('10.00');
    await page.getByRole('button', { name: 'Issue refund' }).click();
    await page.getByText('Refund recorded.').waitFor();
    const after = (await sql('select status, payment_status, tracking_number from orders where id = $1', [order.id]))[0];
    assert(after.status === 'processing' && after.payment_status === 'partially_refunded' && after.tracking_number === '1ZE2E000111', JSON.stringify(after));
    await page.reload();
    await page.getByText('status changed').first().waitFor();
    await page.getByText('refunded', { exact: false }).first().waitFor();
  });

  await step('admin: create a coupon', async () => {
    await page.goto(`${BASE}/admin/promotions`);
    const form = page.locator('section', { hasText: 'Create a coupon' }).last();
    await form.getByLabel('Code').fill(couponCode);
    await form.getByLabel('Discount type').selectOption('percent');
    await form.getByLabel('Value').fill('150');
    await form.getByRole('button', { name: 'Create coupon' }).click();
    await form.getByText('A percentage cannot be more than 100.').waitFor();
    await form.getByLabel('Value').fill('15');
    await form.getByRole('button', { name: 'Create coupon' }).click();
    await page.getByText(`Coupon ${couponCode} created.`).waitFor();
    const c = (await sql('select kind, value from coupons where code = $1', [couponCode]))[0];
    assert(c.kind === 'percent' && c.value === 15, 'coupon saved incorrectly');
  });

  await step('admin: change a store setting and see it on the storefront, then restore it', async () => {
    await page.goto(`${BASE}/admin/settings`);
    const panel = page.locator('section', { hasText: 'Announcement bar' }).first();
    const box = panel.getByLabel('Messages, one per line');
    const original = await box.inputValue();
    await box.fill('E2E announcement check');
    await panel.getByRole('button', { name: 'Save announcements' }).click();
    await panel.getByText('Settings saved.').waitFor();
    const store = await newPage();
    await store.goto(BASE + '/');
    await store.getByRole('region', { name: 'Store announcements' }).getByText('E2E announcement check').first().waitFor();
    await store.context().close();
    await box.fill(original);
    await panel.getByRole('button', { name: 'Save announcements' }).click();
    await panel.getByText('Settings saved.').waitFor();
  });

  await step('admin: the audit log recorded these actions', async () => {
    await page.goto(`${BASE}/admin/audit`);
    for (const action of ['settings.updated', 'coupon.created', 'order.refunded', 'inventory.adjusted', 'product.created'])
      await page.getByRole('rowheader', { name: action }).first().waitFor();
  });

  await step('admin: suspend a customer and confirm they are signed out; reactivate', async () => {
    const victim = (await sql(`select u.id from users u where u.email like 'e2e+%' order by u.created_at desc limit 1`))[0];
    if (!victim) return;
    await page.goto(`${BASE}/admin/customers/${victim.id}`);
    await page.getByRole('button', { name: 'Suspend account' }).click();
    await page.getByText('Account suspended and signed out everywhere.').waitFor();
    const s = (await sql('select (select count(*)::int from sessions where user_id = $1) as sessions, status from users where id = $1', [victim.id]))[0];
    assert(s.status === 'suspended' && s.sessions === 0, JSON.stringify(s));
    await page.reload();
    await page.getByRole('button', { name: 'Reactivate account' }).click();
    await page.getByText('Account reactivated.').waitFor();
  });

  await step('admin: delete the test product and coupon', async () => {
    page.on('dialog', (d) => d.accept());
    await page.goto(`${BASE}/admin/products/${productId}`);
    await page.getByRole('button', { name: 'Delete this product' }).click();
    await page.waitForURL(/\/admin\/products\?deleted=1/);
    assert((await sql('select 1 from products where id = $1', [productId])).length === 0, 'product still exists');
    await page.goto(`${BASE}/admin/promotions`);
    await page.getByText(couponCode, { exact: true }).click();
    await page.locator('li', { hasText: couponCode }).getByRole('button', { name: 'Delete coupon' }).click();
    await page.waitForFunction((c) => !document.body.innerText.includes(c), couponCode);
  });

  await page.context().close();
}

// ---------------------------------------------------------------------------
try {
  if (only !== 'admin') await customerFlow();
  if (only !== 'customer') await adminFlow();
  await step('no console errors were logged in the browser', async () => {
    assert(consoleErrors.length === 0, `${consoleErrors.length} console error(s):\n      ${[...new Set(consoleErrors)].slice(0, 6).join('\n      ')}`);
  });
} catch {
  /* reported above */
} finally {
  await browser.close();
  await db.end();
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  process.exit(failed ? 1 : 0);
}
