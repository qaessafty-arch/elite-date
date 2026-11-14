// Builds a static, script-free snapshot of the storefront for sharing as a link.
// Browsing works (every product, collection and info page); the bag, checkout,
// accounts and admin need the real server and are signposted instead.
//
// Usage: start the production server (npm run build && npm start -- -p 3100), then
//   node scripts/static-preview.mjs [outDir] [baseUrl]
import { mkdirSync, writeFileSync, rmSync, existsSync, copyFileSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';

const OUT = process.argv[2] || 'preview-dist';
const BASE = (process.argv[3] || 'http://localhost:3100').replace(/\/$/, '');
const require = createRequire(import.meta.url);

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets', 'media'), { recursive: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const products = (await db.query(`select slug from products where status = 'published' order by name`)).rows.map((r) => r.slug);
const categories = (await db.query(`select slug from categories where is_active order by kind, sort_order`)).rows.map((r) => r.slug);
await db.end();

const HELP = ['shipping', 'returns', 'size-guide', 'contact', 'privacy', 'terms'];

/** Site path → file name in the snapshot, or null when the page needs the live server. */
function fileFor(href) {
  const url = new URL(href, BASE);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const page = Number(url.searchParams.get('page') || 1);
  const paged = (name) => (page > 1 ? `${name}-${page}.html` : `${name}.html`);
  if (path === '/') return 'index.html';
  if (['/shop', '/sale', '/collections', '/about'].includes(path)) return path === '/shop' || path === '/sale' ? paged(path.slice(1)) : `${path.slice(1)}.html`;
  let m;
  if ((m = path.match(/^\/c\/([a-z0-9-]+)$/))) return categories.includes(m[1]) ? paged(`c-${m[1]}`) : null;
  if ((m = path.match(/^\/products\/([a-z0-9-]+)$/))) return products.includes(m[1]) ? `p-${m[1]}.html` : null;
  if ((m = path.match(/^\/help\/([a-z0-9-]+)$/))) return HELP.includes(m[1]) ? `help-${m[1]}.html` : null;
  return null;
}

const queue = ['/', '/shop', '/sale', '/collections', '/about', ...categories.map((c) => `/c/${c}`), ...products.map((p) => `/products/${p}`), ...HELP.map((h) => `/help/${h}`)];
const seen = new Set();
const images = new Set();
const stylesheets = new Map(); // server url → local name

const decode = (s) => s.replace(/&amp;/g, '&');

function rewriteImages(html) {
  // next/image: /_next/image?url=%2Fimages%2F…&w=…&q=… → images/…
  html = html.replace(/\s(?:srcset|srcSet|sizes|imagesrcset|imagesizes)="[^"]*"/g, '');
  html = html.replace(/src="([^"]+)"/g, (all, src) => {
    const s = decode(src);
    let path = null;
    if (s.startsWith('/_next/image')) path = decodeURIComponent(new URL(s, BASE).searchParams.get('url') || '');
    else if (s.startsWith('/images/')) path = s;
    if (!path || !path.startsWith('/images/')) return all;
    images.add(path);
    return `src="${path.slice(1)}"`;
  });
  return html;
}

function rewriteLinks(html) {
  return html.replace(/href="(\/[^"]*)"/g, (all, href) => {
    const h = decode(href);
    if (h.startsWith('/_next/static/') && h.endsWith('.css')) {
      const name = basename(h.split('?')[0]);
      stylesheets.set(h, name);
      return `href="assets/${name}"`;
    }
    if (h === '/icon.svg') return 'href="icon.svg"';
    const file = fileFor(h);
    if (file) {
      const target = new URL(h, BASE);
      const path = target.pathname + (target.searchParams.get('page') ? `?page=${target.searchParams.get('page')}` : '');
      if (!seen.has(path) && !queue.includes(path)) queue.push(path);
    }
    return `href="${file ?? 'full-site.html'}${h.includes('#') && file ? '#' + h.split('#')[1] : ''}"`;
  });
}

const BANNER = `<div id="pv-banner" style="background:var(--ink);color:var(--bone);font:500 13px/1.45 var(--font-sans);padding:9px max(16px,env(safe-area-inset-left,0px)) 9px max(16px,env(safe-area-inset-right,0px));text-align:center">Preview of the Halden store. Browse every product and page here; the bag, checkout, accounts and admin run on the <a href="full-site.html" style="color:inherit;text-decoration:underline;text-underline-offset:3px">full site</a>.</div>`;

const MENU = `<div id="pv-menu" hidden role="dialog" aria-modal="true" aria-label="Menu" style="position:fixed;inset:0;z-index:90;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(12px + env(safe-area-inset-top,0px)) max(20px,env(safe-area-inset-right,0px)) 24px max(20px,env(safe-area-inset-left,0px))">
<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px"><span class="display" style="font-size:24px">Menu</span><button type="button" id="pv-close" class="icon-btn" aria-label="Close menu" style="font-size:26px;line-height:1">&times;</button></div>
<nav aria-label="Preview"><ul style="list-style:none;margin:0;padding:0;font-size:18px;font-weight:500">
${[['index.html', 'Home'], ['c-new-arrivals.html', 'New arrivals'], ['c-women.html', 'Women'], ['c-men.html', 'Men'], ['c-unisex.html', 'Unisex'], ['collections.html', 'Collections'], ['sale.html', 'Sale'], ['shop.html', 'Shop everything'], ['about.html', 'Our story'], ['help-size-guide.html', 'Size guide'], ['help-shipping.html', 'Shipping'], ['help-returns.html', 'Returns'], ['help-contact.html', 'Contact']]
  .map(([h, l]) => `<li style="border-bottom:1px solid var(--line)"><a href="${h}" style="display:block;padding:14px 0">${l}</a></li>`)
  .join('')}
</ul></nav></div>
<div id="pv-toast" role="status" aria-live="polite" hidden style="position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:95;max-width:min(92vw,28rem);background:var(--ink);color:var(--bone);padding:12px 16px;border-radius:2px;font:500 14px/1.4 var(--font-sans);box-shadow:0 8px 24px rgba(0,0,0,.25)"></div>`;

const SCRIPT = `<script>
(function(){
  var menu=document.getElementById('pv-menu'),toast=document.getElementById('pv-toast'),t;
  function say(m){toast.textContent=m;toast.hidden=false;clearTimeout(t);t=setTimeout(function(){toast.hidden=true},3600);}
  var STATIC='This preview is static. Adding to the bag, filters, search and checkout work on the full site.';
  document.addEventListener('click',function(e){
    var el=e.target.closest('button,input[type=checkbox],input[type=radio]');
    if(!el||el.closest('#pv-banner'))return;
    if(el.id==='pv-close'){menu.hidden=true;document.body.style.overflow='';return;}
    if(el.getAttribute('aria-label')==='Open menu'){e.preventDefault();menu.hidden=false;document.body.style.overflow='hidden';document.getElementById('pv-close').focus();return;}
    var label=el.getAttribute('aria-label')||'';
    if(/^Show image /.test(label)){
      var img=el.querySelector('img'),main=document.querySelector('button[aria-label="Open full-screen image viewer"] img');
      if(img&&main){main.src=img.src;document.querySelectorAll('[aria-label^="Show image "]').forEach(function(b){b.removeAttribute('aria-current');b.style.opacity='.7';b.style.outline='none'});el.setAttribute('aria-current','true');el.style.opacity='1';el.style.outline='1px solid var(--ink)';el.style.outlineOffset='2px';}
      e.preventDefault();return;
    }
    if(label==='Open full-screen image viewer'){e.preventDefault();var i=el.querySelector('img');if(i)window.open(i.src,'_blank');return;}
    e.preventDefault();say(STATIC);
  },true);
  document.addEventListener('submit',function(e){e.preventDefault();say(STATIC);},true);
  document.addEventListener('change',function(e){if(e.target.matches('select')){say(STATIC);}},true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;document.body.style.overflow='';}});
})();
</script>`;

function transform(html, path) {
  html = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
  html = html.replace(/<link\b[^>]*rel="(?:preload|modulepreload|prefetch|dns-prefetch|preconnect)"[^>]*>/g, '');
  html = html.replace(/<html([^>]*)\sdata-theme="[^"]*"/, '<html$1');
  html = rewriteImages(html);
  html = rewriteLinks(html);
  html = html.replace(/<body([^>]*)>/, `<body$1>${BANNER}`);
  html = html.replace('</body>', `${MENU}${SCRIPT}</body>`);
  if (path === '/') {
    // The 3D cloth study needs WebGL and the app runtime; show a still frame of it instead.
    html = html.replace(
      /(<div class="relative aspect-square overflow-hidden bg-sand md:aspect-\[5\/4\]">)(<\/div>)/,
      '$1<img src="images/campaign/cloth-study.jpg" alt="Rendered swatch of camel wool melton" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>$2',
    );
    html = html.replace('Procedural illustration of the weave. Drag to rotate.', 'Procedural illustration of the weave. On the full site you can drag it to rotate.');
  }
  return html;
}

async function get(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`${path} returned ${res.status}`);
  return res.text();
}

const pages = new Map();
while (queue.length) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const file = fileFor(path);
  if (!file) continue;
  pages.set(file, transform(await get(path), path));
}

// "Full site" page: the about page's frame with its main content replaced.
const frame = pages.get('about.html');
pages.set(
  'full-site.html',
  frame
    .replace(/<title>[^<]*<\/title>/, '<title>Full site | Halden</title>')
    .replace(
      /<main id="main">[\s\S]*<\/main>/,
      `<main id="main"><div class="shell max-w-3xl py-16 md:py-24">
<h1 class="display display-lg">This part needs the full site</h1>
<p class="lede mt-4">This link is a static preview, so every product, collection and info page is here to browse. The shopping parts run on a server with a database, and they are not included.</p>
<ul class="mt-8 grid gap-3 text-[1.0625rem]">
<li class="border-t border-line pt-3"><strong class="font-semibold">Bag and checkout:</strong> add to bag, promo codes, delivery options, payment and order confirmation.</li>
<li class="border-t border-line pt-3"><strong class="font-semibold">Search and filters:</strong> live suggestions, filtering by size, colour, price and more, and sorting.</li>
<li class="border-t border-line pt-3"><strong class="font-semibold">Accounts:</strong> sign in, order history, saved addresses and the wishlist.</li>
<li class="border-t border-line pt-3"><strong class="font-semibold">Admin:</strong> the dashboard, products, stock, orders, refunds, promotions and settings.</li>
</ul>
<p class="mt-8 text-mute">All of these are built and tested in the project's code, and they run when the store is deployed with a database.</p>
<a href="index.html" class="btn btn-primary mt-8">Back to the store</a>
</div></main>`,
    ),
);

// Stylesheets and the fonts they reference.
for (const [href, name] of stylesheets) {
  let css = await get(href);
  const cssUrl = new URL(href, BASE);
  const urls = [...new Set([...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:')))];
  for (const u of urls) {
    const abs = new URL(u, cssUrl);
    const res = await fetch(abs);
    if (!res.ok) continue;
    const file = basename(abs.pathname);
    writeFileSync(join(OUT, 'assets', 'media', file), Buffer.from(await res.arrayBuffer()));
    css = css.split(u).join(`media/${file}`);
  }
  // Follow the viewer's system theme as well as an explicit data-theme choice.
  css += `
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bone:#111111;--paper:#1a1a19;--sand:#222120;--ink:#f2efe9;--mute:#a8a49b;--line:#2b2a28;--line-strong:#44423e;--brass:#b89c73;--brass-deep:#cdb38c;--loden:#1d2219;--loden-soft:#2a3024;--on-dark:#f3efe6;--danger:#e2796d;--ok:#86b890;color-scheme:dark}}
html,body{background:var(--bone)}`;
  writeFileSync(join(OUT, 'assets', name), css);
}

// Images and icon.
for (const img of images) {
  const src = join('public', img);
  const dest = join(OUT, img);
  mkdirSync(join(dest, '..'), { recursive: true });
  if (existsSync(src)) copyFileSync(src, dest);
}
copyFileSync('public/icon.svg', join(OUT, 'icon.svg'));

// Still frame of the 3D cloth study.
{
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const box = page.locator('section[aria-labelledby="cloth-heading"] .aspect-square').first();
  await box.scrollIntoViewIfNeeded();
  await page.waitForSelector('section[aria-labelledby="cloth-heading"] canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  mkdirSync(join(OUT, 'images', 'campaign'), { recursive: true });
  const png = join(OUT, 'images', 'campaign', 'cloth-study.png');
  await box.screenshot({ path: png });
  await browser.close();
  const sharp = require('sharp');
  await sharp(png).jpeg({ quality: 84 }).toFile(join(OUT, 'images', 'campaign', 'cloth-study.jpg'));
  rmSync(png);
}

// index.html is wrapped in a document skeleton by the host, so it carries only head and body contents.
const home = pages.get('index.html');
const head = home.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charSet="utf-8"\/>/i, '').replace(/<meta name="viewport"[^>]*>/i, '');
const body = home.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
pages.set('index.html', `${head}\n${body}`);

for (const [file, html] of pages) writeFileSync(join(OUT, file), html);
console.log(`wrote ${pages.size} pages, ${images.size} images, ${stylesheets.size} stylesheet(s) to ${OUT}`);
