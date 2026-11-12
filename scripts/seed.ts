/**
 * Seeds roles, settings, the demo catalogue, coupons, shipping methods,
 * demo reviews (flagged is_demo) and a month of demo orders for the dashboard.
 * Safe to re-run: it clears catalogue/order data first. Dev/demo use only.
 */
import pg from 'pg';
import { loadEnv } from './env';
import { hashPassword, hashToken, newToken } from '../src/lib/password';
import { DEFAULT_SETTINGS } from '../src/lib/settings';
import { PERMISSIONS } from '../src/lib/permissions';

loadEnv();

const C = {
  Camel: '#B8895A',
  Charcoal: '#3A3A3C',
  Loden: '#4A5139',
  Ecru: '#E9E2D0',
  Bone: '#EDE8DC',
  Ink: '#1B1B1D',
  White: '#FAFAF7',
  'Pale blue': '#BFD0E0',
  'Blue stripe': '#9FB6D1',
  Indigo: '#1F2A44',
  'Mid blue': '#6F8FB3',
  Brown: '#5A3E2B',
  Ochre: '#B98A2E',
  Stone: '#CFC4AE',
} as const;
type ColorName = keyof typeof C;

const APPAREL = ['XS', 'S', 'M', 'L', 'XL'];
const WAIST = ['28', '30', '32', '34', '36'];
const SHOES = ['39', '40', '41', '42', '43', '44', '45'];
const ONE = ['One size'];

const categories = [
  // departments
  { slug: 'women', name: 'Women', kind: 'department', description: 'Coats, shirting, trousers and denim cut for women.', image: null, featured: false },
  { slug: 'men', name: 'Men', kind: 'department', description: 'Outerwear, shirts, trousers and denim cut for men.', image: null, featured: false },
  { slug: 'unisex', name: 'Unisex', kind: 'department', description: 'Pieces graded to fit everyone.', image: null, featured: false },
  // product types
  { slug: 't-shirts', name: 'T-shirts', kind: 'type', description: 'Heavyweight jersey tees.', image: null, featured: false },
  { slug: 'shirts', name: 'Shirts', kind: 'type', description: 'Oxford and poplin shirting.', image: null, featured: false },
  { slug: 'hoodies', name: 'Hoodies', kind: 'type', description: 'Loopback cotton hoodies.', image: null, featured: false },
  { slug: 'jackets', name: 'Jackets', kind: 'type', description: 'Coats, chore jackets and liners.', image: null, featured: false },
  { slug: 'trousers', name: 'Trousers', kind: 'type', description: 'Pleated and tapered trousers.', image: null, featured: false },
  { slug: 'jeans', name: 'Jeans', kind: 'type', description: 'Selvedge and washed denim.', image: null, featured: false },
  { slug: 'shoes', name: 'Shoes', kind: 'type', description: 'Leather sneakers and boots.', image: null, featured: false },
  { slug: 'accessories', name: 'Accessories', kind: 'type', description: 'Knit hats and bags.', image: null, featured: false },
  // collections
  { slug: 'new-arrivals', name: 'New arrivals', kind: 'collection', description: 'The latest pieces off the cutting table.', image: '/images/collections/new-arrivals.jpg', featured: true },
  { slug: 'best-sellers', name: 'Best sellers', kind: 'collection', description: 'What customers come back for.', image: '/images/collections/best-sellers.jpg', featured: true },
  { slug: 'low-sun', name: 'Low Sun, autumn', kind: 'collection', description: 'Wool, twill and gabardine for shorter days.', image: '/images/collections/low-sun.jpg', featured: true },
  { slug: 'streetwear', name: 'Streetwear', kind: 'collection', description: 'Heavy jersey, wide cuts, worn hard.', image: '/images/collections/streetwear.jpg', featured: true },
  { slug: 'essentials', name: 'Essentials', kind: 'collection', description: 'The pieces everything else is built on.', image: '/images/collections/essentials.jpg', featured: true },
  { slug: 'limited-edition', name: 'Limited edition', kind: 'collection', description: 'Small runs in mill-end cloth. Not restocked.', image: '/images/collections/limited-edition.jpg', featured: true },
] as const;

type SeedProduct = {
  slug: string;
  name: string;
  description: string;
  brand?: string;
  material: string;
  materialDetails: string;
  care: string;
  fit: string;
  price: number;
  compareAt?: number;
  badge?: string;
  featured?: boolean;
  popularity: number;
  sold: number;
  daysAgo: number;
  cats: string[];
  sizes: string[];
  colors: { name: ColorName; image: string }[];
  extraImages?: string[];
  /** size → stock override, applied to every colour (e.g. to show a sold-out size) */
  stock?: Record<string, number>;
};

const products: SeedProduct[] = [
  {
    slug: 'arden-wool-overcoat', name: 'Arden wool overcoat',
    description: 'A long, single-breasted overcoat in dense Italian wool melton. Dropped shoulders and a deep back vent let it sit over a jacket or a heavy knit without pulling.',
    material: 'Wool', materialDetails: '90% recycled wool, 10% cashmere melton, 540 g/m². Fully lined in cupro. Horn buttons.',
    care: 'Dry clean only. Brush after wear and hang on a wide hanger.', fit: 'Relaxed. Take your usual size; size down for a closer fit.',
    price: 42000, badge: 'New', featured: true, popularity: 96, sold: 41, daysAgo: 6,
    cats: ['women', 'jackets', 'new-arrivals', 'low-sun'], sizes: APPAREL,
    colors: [{ name: 'Camel', image: 'arden-overcoat-camel' }, { name: 'Charcoal', image: 'arden-overcoat-charcoal' }],
    stock: { XS: 4, S: 9, M: 12, L: 6, XL: 0 },
  },
  {
    slug: 'field-chore-jacket', name: 'Field chore jacket',
    description: 'The French work jacket, redrawn. Three patch pockets, a soft collar and a boxy body in garment-dyed cotton twill that fades with every wash.',
    material: 'Cotton', materialDetails: '100% organic cotton twill, 340 g/m², garment dyed. Corozo buttons.',
    care: 'Machine wash cold, inside out. Line dry. Colour will soften over time.', fit: 'Boxy. True to size.',
    price: 24500, featured: true, popularity: 91, sold: 133, daysAgo: 48, badge: 'Best seller',
    cats: ['men', 'jackets', 'best-sellers', 'low-sun'], sizes: APPAREL,
    colors: [{ name: 'Loden', image: 'field-chore-jacket-loden' }, { name: 'Ecru', image: 'field-chore-jacket-ecru' }],
  },
  {
    slug: 'kiln-heavyweight-hoodie', name: 'Kiln heavyweight hoodie',
    description: 'A 500 gram loopback hoodie with a double-layer hood that holds its shape and no drawcord to lose. Cut wide and slightly cropped.',
    material: 'Cotton', materialDetails: '100% organic cotton loopback jersey, 500 g/m². Flatlock seams, ribbed side panels.',
    care: 'Machine wash cold. Do not tumble dry.', fit: 'Oversized. Size down for a regular fit.',
    price: 13500, featured: true, popularity: 98, sold: 212, daysAgo: 70, badge: 'Best seller',
    cats: ['unisex', 'men', 'women', 'hoodies', 'best-sellers', 'streetwear', 'essentials'], sizes: [...APPAREL, 'XXL'],
    colors: [{ name: 'Bone', image: 'kiln-hoodie-bone' }, { name: 'Ink', image: 'kiln-hoodie-ink' }],
    stock: { XS: 6, S: 14, M: 20, L: 18, XL: 3, XXL: 0 },
  },
  {
    slug: 'slate-boxy-tee', name: 'Slate boxy tee',
    description: 'A dry-handle tee with a tight ribbed collar, cut square through the body so it hangs straight from the shoulder.',
    material: 'Cotton', materialDetails: '100% organic cotton jersey, 260 g/m². Preshrunk.',
    care: 'Machine wash cold with like colours. Tumble dry low.', fit: 'Boxy. True to size.',
    price: 5800, popularity: 94, sold: 356, daysAgo: 110, featured: true,
    cats: ['unisex', 'men', 'women', 't-shirts', 'best-sellers', 'essentials', 'streetwear'], sizes: [...APPAREL, 'XXL'],
    colors: [{ name: 'White', image: 'slate-tee-white' }, { name: 'Ink', image: 'slate-tee-ink' }],
  },
  {
    slug: 'oxford-day-shirt', name: 'Oxford day shirt',
    description: 'A button-down in washed oxford cloth with a soft, unfused collar. Dressed enough for a jacket, easy enough to wear open over a tee.',
    material: 'Cotton', materialDetails: '100% cotton oxford, 150 g/m². Mother-of-pearl buttons, single-needle seams.',
    care: 'Machine wash warm. Iron while damp.', fit: 'Regular. True to size.',
    price: 11800, popularity: 72, sold: 88, daysAgo: 85,
    cats: ['men', 'shirts', 'essentials'], sizes: APPAREL,
    colors: [{ name: 'Pale blue', image: 'oxford-shirt-blue' }, { name: 'White', image: 'oxford-shirt-white' }],
  },
  {
    slug: 'poplin-studio-shirt', name: 'Poplin studio shirt',
    description: 'An oversized shirt in crisp compact poplin with a deep back yoke and a long, curved hem. Wear it tucked, half tucked or as a layer.',
    material: 'Cotton', materialDetails: '100% organic cotton poplin, 120 g/m². Shell buttons.',
    care: 'Machine wash cold. Hang to dry. Warm iron.', fit: 'Oversized. Take your usual size.',
    price: 12800, popularity: 78, sold: 74, daysAgo: 20, badge: 'New',
    cats: ['women', 'shirts', 'new-arrivals', 'essentials'], sizes: APPAREL,
    colors: [{ name: 'White', image: 'poplin-shirt-white' }, { name: 'Blue stripe', image: 'poplin-shirt-stripe' }],
  },
  {
    slug: 'pleated-wide-trouser', name: 'Pleated wide trouser',
    description: 'High on the waist with two forward pleats and a full, straight leg that breaks once on the shoe.',
    material: 'Wool', materialDetails: '70% wool, 30% recycled polyester tropical weave, 280 g/m². Half lined.',
    care: 'Dry clean. Steam to refresh between wears.', fit: 'High rise, wide leg. True to size.',
    price: 18500, popularity: 80, sold: 61, daysAgo: 33, featured: true,
    cats: ['women', 'trousers', 'low-sun', 'essentials'], sizes: APPAREL,
    colors: [{ name: 'Charcoal', image: 'pleated-trouser-charcoal' }, { name: 'Ecru', image: 'pleated-trouser-ecru' }],
  },
  {
    slug: 'tapered-work-trouser', name: 'Tapered work trouser',
    description: 'A work trouser with the bulk taken out. Room through the thigh, a clean taper below the knee and a bar-tacked double seat seam.',
    material: 'Cotton', materialDetails: '98% organic cotton, 2% elastane twill, 320 g/m².',
    care: 'Machine wash cold, inside out. Line dry.', fit: 'Mid rise, tapered. True to size.',
    price: 16500, popularity: 69, sold: 97, daysAgo: 95,
    cats: ['men', 'trousers', 'streetwear'], sizes: WAIST,
    colors: [{ name: 'Loden', image: 'work-trouser-loden' }, { name: 'Ink', image: 'work-trouser-ink' }],
  },
  {
    slug: 'selvedge-straight-jean', name: 'Selvedge straight jean',
    description: 'Fourteen-ounce Japanese selvedge, left raw. A straight leg with a mid rise that will crease and fade into something that is only yours.',
    material: 'Denim', materialDetails: '100% cotton 14 oz selvedge denim, unsanforized-look rinse. Chain-stitched hems, copper rivets.',
    care: 'Wash rarely, cold, inside out. Expect indigo transfer on light surfaces at first.', fit: 'Mid rise, straight. Take your usual waist.',
    price: 19800, popularity: 88, sold: 142, daysAgo: 130, badge: 'Best seller', featured: true,
    cats: ['men', 'jeans', 'best-sellers', 'streetwear'], sizes: WAIST,
    colors: [{ name: 'Indigo', image: 'selvedge-jean-indigo' }], extraImages: ['selvedge-jean-detail'],
    stock: { '28': 2, '30': 8, '32': 11, '34': 7, '36': 4 },
  },
  {
    slug: 'high-rise-barrel-jean', name: 'High-rise barrel jean',
    description: 'A curved leg that bows out at the knee and comes back in at the ankle, in a soft, stone-washed mid blue.',
    material: 'Denim', materialDetails: '100% organic cotton 12 oz denim, stone washed.',
    care: 'Machine wash cold, inside out. Line dry.', fit: 'High rise, barrel leg. Size down if between sizes.',
    price: 14200, compareAt: 18800, badge: 'Sale', popularity: 66, sold: 58, daysAgo: 150,
    cats: ['women', 'jeans', 'streetwear'], sizes: ['24', '26', '28', '30', '32'],
    colors: [{ name: 'Mid blue', image: 'barrel-jean-blue' }], extraImages: ['barrel-jean-back'],
  },
  {
    slug: 'court-leather-sneaker', name: 'Court leather sneaker',
    description: 'A plain court shoe in full-grain leather on a stitched cupsole. No logos, no panels that do not need to be there.',
    material: 'Leather', materialDetails: 'Full-grain leather upper from an LWG gold-rated tannery, leather lining, stitched rubber cupsole. Made in Portugal.',
    care: 'Wipe with a damp cloth. Condition the leather a few times a year.', fit: 'True to size. Half sizes, go up.',
    price: 21000, popularity: 85, sold: 119, daysAgo: 60, featured: true,
    cats: ['unisex', 'men', 'women', 'shoes', 'best-sellers', 'essentials'], sizes: SHOES,
    colors: [{ name: 'White', image: 'court-sneaker-white' }, { name: 'Ink', image: 'court-sneaker-ink' }],
    stock: { '39': 3, '40': 6, '41': 9, '42': 10, '43': 8, '44': 2, '45': 0 },
  },
  {
    slug: 'ridge-chelsea-boot', name: 'Ridge chelsea boot',
    description: 'A slim chelsea in water-repellent suede with a storm welt and a leather sole that can be replaced when it finally wears through.',
    material: 'Leather', materialDetails: 'Water-repellent calf suede, leather lining, Blake-stitched leather sole with rubber top piece. Made in Portugal.',
    care: 'Brush with a suede brush. Re-proof each season.', fit: 'Runs slightly large. Size down a half.',
    price: 29500, popularity: 62, sold: 37, daysAgo: 40,
    cats: ['men', 'shoes', 'low-sun'], sizes: SHOES,
    colors: [{ name: 'Brown', image: 'ridge-boot-brown' }], extraImages: ['ridge-boot-worn'],
  },
  {
    slug: 'merino-rib-beanie', name: 'Merino rib beanie',
    description: 'A close two-by-two rib in extra-fine merino. Warm without bulk, and it will not itch.',
    material: 'Wool', materialDetails: '100% extra-fine merino wool, mulesing free. Knitted in Scotland.',
    care: 'Hand wash cold. Dry flat.', fit: 'One size, stretches to fit.',
    price: 4800, popularity: 74, sold: 188, daysAgo: 25,
    cats: ['unisex', 'men', 'women', 'accessories', 'streetwear', 'low-sun'], sizes: ONE,
    colors: [{ name: 'Ink', image: 'merino-beanie-ink' }, { name: 'Ochre', image: 'merino-beanie-ochre' }],
    stock: { 'One size': 40 },
  },
  {
    slug: 'canvas-market-tote', name: 'Canvas market tote',
    description: 'A big, plain tote in 18-ounce canvas with long bridle-leather handles and one inside pocket. It stands up on its own.',
    material: 'Canvas', materialDetails: '100% cotton 18 oz canvas, vegetable-tanned leather handles, brass rivets.',
    care: 'Spot clean. The leather will darken with use.', fit: '40 × 36 × 16 cm. Handle drop 28 cm.',
    price: 7500, popularity: 58, sold: 92, daysAgo: 140,
    cats: ['unisex', 'men', 'women', 'accessories', 'essentials'], sizes: ONE,
    colors: [{ name: 'Ecru', image: 'market-tote-ecru' }], extraImages: ['market-tote-still'],
    stock: { 'One size': 4 },
  },
  {
    slug: 'quilted-liner-vest', name: 'Quilted liner vest',
    description: 'A collarless liner with brass snaps, quilted in a diamond pattern over recycled wadding. Made in a run of 300 from end-of-roll nylon.',
    brand: 'Halden Studio',
    material: 'Recycled nylon', materialDetails: 'Recycled nylon ripstop shell, 80 g recycled polyester wadding, cotton binding. Numbered label.',
    care: 'Machine wash cold on a gentle cycle. Do not iron.', fit: 'Regular, made to layer. True to size.',
    price: 17500, badge: 'Limited', popularity: 83, sold: 64, daysAgo: 12, featured: true,
    cats: ['unisex', 'men', 'women', 'jackets', 'limited-edition', 'new-arrivals', 'streetwear'], sizes: APPAREL,
    colors: [{ name: 'Ink', image: 'liner-vest-ink' }, { name: 'Loden', image: 'liner-vest-loden' }],
    stock: { XS: 2, S: 3, M: 5, L: 2, XL: 1 },
  },
  {
    slug: 'wrap-trench-coat', name: 'Wrap trench coat',
    description: 'A full-length trench in tightly woven gabardine with a storm flap, a deep inverted back pleat and a belt you tie rather than buckle.',
    brand: 'Halden Studio',
    material: 'Cotton', materialDetails: '100% cotton gabardine with a water-repellent finish, 260 g/m². Half lined in striped cotton.',
    care: 'Dry clean. Re-proof after cleaning.', fit: 'Oversized. Size down for a closer fit.',
    price: 36000, badge: 'Limited', popularity: 79, sold: 29, daysAgo: 9,
    cats: ['women', 'jackets', 'limited-edition', 'new-arrivals', 'low-sun'], sizes: APPAREL,
    colors: [{ name: 'Stone', image: 'wrap-trench-stone' }], extraImages: ['wrap-trench-detail'],
    stock: { XS: 1, S: 4, M: 6, L: 3, XL: 2 },
  },
];

// Demonstration reviews. They are flagged is_demo and labelled as sample content on the site.
const reviews: [slug: string, author: string, rating: number, title: string, body: string][] = [
  ['kiln-heavyweight-hoodie', 'Sample reviewer A.', 5, 'Heavier than anything else I own', 'The weight is the first thing you notice. It hangs properly instead of clinging, and the hood stands up on its own. I took a medium at 180 cm and it is roomy without looking sloppy.'],
  ['kiln-heavyweight-hoodie', 'Sample reviewer B.', 4, 'Great, runs big', 'Lovely fabric and the bone colour is exactly as pictured. I would size down next time.'],
  ['arden-wool-overcoat', 'Sample reviewer C.', 5, 'The coat I was looking for', 'Dense, warm and the shoulders are soft enough to go over a blazer. The camel is a true camel, not yellow. Worth saving for.'],
  ['field-chore-jacket', 'Sample reviewer D.', 5, 'Gets better every wash', 'I have had mine for a season and the loden has faded along the seams in the best way. Pockets are actually big enough for a paperback.'],
  ['field-chore-jacket', 'Sample reviewer E.', 4, 'Solid jacket', 'Well made, boxy as described. Sleeves are a touch long on me.'],
  ['selvedge-straight-jean', 'Sample reviewer F.', 5, 'Proper denim', 'Stiff for the first two weeks, then they start to give. Chain stitching and rivets are all where they should be. Take your normal waist.'],
  ['slate-boxy-tee', 'Sample reviewer G.', 5, 'Bought three', 'Collar has not stretched after a dozen washes and the cut is square without being short.'],
  ['slate-boxy-tee', 'Sample reviewer H.', 4, 'Good everyday tee', 'Thick jersey, slightly dry feel. The white is not see-through.'],
  ['court-leather-sneaker', 'Sample reviewer I.', 5, 'Clean and comfortable', 'No logos, good leather, and comfortable from the first day. Sizing was spot on.'],
  ['pleated-wide-trouser', 'Sample reviewer J.', 5, 'Beautiful drape', 'The pleats sit flat and the fabric moves really well. I wear them with trainers and with loafers.'],
  ['quilted-liner-vest', 'Sample reviewer K.', 4, 'Useful layer', 'Light, warm, and it fits under my overcoat. I like that it has a number on the label.'],
  ['poplin-studio-shirt', 'Sample reviewer L.', 5, 'Crisp', 'Proper poplin that holds a crease. The oversized cut is generous but the shoulders still sit right.'],
  ['merino-rib-beanie', 'Sample reviewer M.', 5, 'Does not itch', 'Soft, close fitting and warm. The ochre is a great colour.'],
  ['wrap-trench-coat', 'Sample reviewer N.', 5, 'Dramatic in a good way', 'Long, swishy and properly rainproof in a shower. The tie belt is much nicer than a buckle.'],
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force'))
    throw new Error('Refusing to seed in production without --force (it deletes catalogue and order data).');
  const db = new pg.Client({ connectionString: url, ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined });
  await db.connect();
  await db.query('begin');

  await db.query(`truncate order_items, payments, orders, cart_items, carts, wishlist_items, wishlists, reviews,
    inventory, product_variants, product_images, product_categories, products, categories, coupons,
    shipping_methods, settings, newsletter_subscribers, audit_logs restart identity cascade`);

  // Roles
  const staffPerms = ['dashboard.view', 'products.manage', 'orders.manage', 'customers.manage'];
  for (const [key, name, perms] of [
    ['customer', 'Customer', []],
    ['staff', 'Store staff', staffPerms],
    ['admin', 'Administrator', [...PERMISSIONS]],
  ] as const) {
    await db.query(
      `insert into roles (key, name, permissions) values ($1, $2, $3)
       on conflict (key) do update set name = excluded.name, permissions = excluded.permissions`,
      [key, name, perms],
    );
  }

  // Accounts
  const accounts = [
    { email: process.env.SEED_ADMIN_EMAIL || 'admin@halden.test', password: process.env.SEED_ADMIN_PASSWORD || 'change-me-admin-1', role: 'admin', first: 'Store', last: 'Admin' },
    { email: 'staff@halden.test', password: process.env.SEED_ADMIN_PASSWORD || 'change-me-admin-1', role: 'staff', first: 'Store', last: 'Staff' },
    { email: process.env.SEED_CUSTOMER_EMAIL || 'customer@halden.test', password: process.env.SEED_CUSTOMER_PASSWORD || 'change-me-customer-1', role: 'customer', first: 'Demo', last: 'Customer' },
  ];
  const userIds: Record<string, string> = {};
  for (const a of accounts) {
    const hash = await hashPassword(a.password);
    const { rows } = await db.query(
      `insert into users (email, password_hash, role_id, email_verified_at)
       values ($1, $2, (select id from roles where key = $3), now())
       on conflict (email) do update set password_hash = excluded.password_hash, role_id = excluded.role_id, status = 'active'
       returning id`,
      [a.email, hash, a.role],
    );
    userIds[a.role] = rows[0].id;
    await db.query(
      `insert into profiles (user_id, first_name, last_name) values ($1, $2, $3)
       on conflict (user_id) do update set first_name = excluded.first_name, last_name = excluded.last_name`,
      [rows[0].id, a.first, a.last],
    );
  }
  await db.query('delete from addresses where user_id = $1', [userIds.customer]);
  await db.query(
    `insert into addresses (user_id, label, first_name, last_name, line1, city, region, postal_code, country, phone, is_default)
     values ($1, 'Home', 'Demo', 'Customer', '221 Mercer Street', 'New York', 'NY', '10012', 'US', '+1 555 010 0199', true)`,
    [userIds.customer],
  );

  // Settings
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query('insert into settings (key, value) values ($1, $2)', [key, JSON.stringify(value)]);
  }

  // Shipping & coupons
  await db.query(
    `insert into shipping_methods (code, name, description, price_cents, free_over_cents, min_days, max_days, sort_order) values
     ('standard', 'Standard', 'Tracked delivery', 800, 20000, 3, 6, 1),
     ('express', 'Express', 'Priority courier, dispatched the same day before 1pm', 1800, null, 1, 2, 2)`,
  );
  await db.query(
    `insert into coupons (code, description, campaign, kind, value, min_subtotal_cents, starts_at, expires_at, usage_limit) values
     ('WELCOME10', '10% off your first order', 'Welcome', 'percent', 10, 0, null, null, null),
     ('LOWSUN25', '$25 off orders over $250', 'Low Sun', 'fixed', 2500, 25000, now() - interval '10 days', now() + interval '60 days', 500),
     ('STUDIO20', '20% off for studio members', 'Members', 'percent', 20, 10000, null, null, 50),
     ('SPRING15', '15% off, spring campaign', 'Spring', 'percent', 15, 0, now() - interval '200 days', now() - interval '120 days', null)`,
  );

  // Categories
  const catIds: Record<string, string> = {};
  let order = 0;
  for (const c of categories) {
    const { rows } = await db.query(
      `insert into categories (slug, name, kind, description, image_url, sort_order, is_featured)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [c.slug, c.name, c.kind, c.description, c.image, order++, c.featured],
    );
    catIds[c.slug] = rows[0].id;
  }

  // Products
  const rand = rng(7);
  const variantsByProduct: Record<string, { id: string; productId: string; name: string; slug: string; sku: string; size: string; color: string; price: number; image: string }[]> = {};
  for (const p of products) {
    const { rows } = await db.query(
      `insert into products (slug, name, description, brand, material, material_details, care, fit, price_cents,
                             compare_at_cents, status, badge, is_featured, popularity, sold_count, published_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',$11,$12,$13,$14, now() - ($15 || ' days')::interval, now() - ($15 || ' days')::interval)
       returning id`,
      [p.slug, p.name, p.description, p.brand ?? 'Halden', p.material, p.materialDetails, p.care, p.fit, p.price,
       p.compareAt ?? null, p.badge ?? null, !!p.featured, p.popularity, p.sold, String(p.daysAgo)],
    );
    const productId = rows[0].id as string;
    for (const slug of p.cats) {
      await db.query('insert into product_categories (product_id, category_id) values ($1, $2)', [productId, catIds[slug]]);
    }
    let sort = 0;
    for (const c of p.colors) {
      await db.query('insert into product_images (product_id, url, alt, color, sort_order) values ($1,$2,$3,$4,$5)', [
        productId, `/images/products/${c.image}.jpg`, `${p.name} in ${c.name.toLowerCase()}`, c.name, sort++,
      ]);
    }
    for (const img of p.extraImages ?? []) {
      await db.query('insert into product_images (product_id, url, alt, color, sort_order) values ($1,$2,$3,$4,$5)', [
        productId, `/images/products/${img}.jpg`, `${p.name}, detail`, p.colors.length === 1 ? p.colors[0].name : null, sort++,
      ]);
    }
    variantsByProduct[p.slug] = [];
    let vsort = 0;
    for (const c of p.colors) {
      for (const size of p.sizes) {
        const sku = `${p.slug.split('-').map((w) => w[0]).join('').toUpperCase()}-${c.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${size.replace(/\s+/g, '').toUpperCase()}`;
        const v = await db.query(
          `insert into product_variants (product_id, sku, size, color, color_hex, sort_order) values ($1,$2,$3,$4,$5,$6) returning id`,
          [productId, sku, size, c.name, C[c.name], vsort++],
        );
        const qty = p.stock?.[size] ?? Math.floor(rand() * 16) + 3;
        await db.query('insert into inventory (variant_id, quantity) values ($1, $2)', [v.rows[0].id, qty]);
        variantsByProduct[p.slug].push({
          id: v.rows[0].id, productId, name: p.name, slug: p.slug, sku, size, color: c.name, price: p.price,
          image: `/images/products/${c.image}.jpg`,
        });
      }
    }
  }

  // Demo reviews
  for (const [slug, author, rating, title, body] of reviews) {
    await db.query(
      `insert into reviews (product_id, author_name, rating, title, body, is_verified_purchase, is_demo, created_at)
       values ((select id from products where slug = $1), $2, $3, $4, $5, true, true, now() - (floor(random() * 60) || ' days')::interval)`,
      [slug, author, rating, title, body],
    );
  }

  // Demo orders across the last 30 days so the dashboard has something to chart.
  const shipStd = (await db.query(`select id from shipping_methods where code = 'standard'`)).rows[0].id;
  const allVariants = Object.values(variantsByProduct).flat();
  const guests = [
    ['Demo', 'Guest One', 'guest.one@example.com', 'Portland', 'OR', '97205'],
    ['Demo', 'Guest Two', 'guest.two@example.com', 'Austin', 'TX', '78701'],
    ['Demo', 'Guest Three', 'guest.three@example.com', 'Chicago', 'IL', '60607'],
    ['Demo', 'Guest Four', 'guest.four@example.com', 'Seattle', 'WA', '98101'],
  ];
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let i = 0; i < 26; i++) {
    const daysAgo = Math.floor(rand() * 30);
    const isCustomer = i % 4 === 0;
    const g = guests[i % guests.length];
    const lineCount = 1 + Math.floor(rand() * 3);
    const picked = Array.from({ length: lineCount }, () => allVariants[Math.floor(rand() * allVariants.length)]);
    const lines = picked.map((v) => ({ v, qty: 1 + (rand() > 0.8 ? 1 : 0) }));
    const subtotal = lines.reduce((s, l) => s + l.v.price * l.qty, 0);
    const shipping = subtotal >= 20000 ? 0 : 800;
    const tax = Math.round(subtotal * 0.08);
    const total = subtotal + shipping + tax;
    const status = daysAgo > 8 ? 'delivered' : daysAgo > 3 ? 'shipped' : daysAgo > 1 ? 'processing' : 'confirmed';
    let number = 'HD-';
    for (let k = 0; k < 8; k++) number += alphabet[Math.floor(rand() * alphabet.length)];
    const { rows } = await db.query(
      `insert into orders (number, access_key_hash, user_id, email, first_name, last_name, ship_line1, ship_city, ship_region,
                           ship_postal_code, ship_country, shipping_method_id, shipping_method_name, status, payment_status,
                           currency, subtotal_cents, shipping_cents, tax_cents, total_cents, tracking_carrier, tracking_number,
                           created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'US',$11,'Standard',$12,'paid','USD',$13,$14,$15,$16,$17,$18,
               now() - ($19 || ' days')::interval - ($20 || ' minutes')::interval, now() - ($19 || ' days')::interval)
       returning id`,
      [
        number, hashToken(newToken()), isCustomer ? userIds.customer : null,
        isCustomer ? accounts[2].email : g[2], isCustomer ? 'Demo' : g[0], isCustomer ? 'Customer' : g[1],
        isCustomer ? '221 Mercer Street' : `${100 + i} Sample Avenue`, isCustomer ? 'New York' : g[3], isCustomer ? 'NY' : g[4],
        isCustomer ? '10012' : g[5], shipStd, status, subtotal, shipping, tax, total,
        status === 'shipped' || status === 'delivered' ? 'UPS' : null,
        status === 'shipped' || status === 'delivered' ? `1ZDEMO${String(100000 + i)}` : null,
        String(daysAgo), String(Math.floor(rand() * 600)),
      ],
    );
    for (const l of lines) {
      await db.query(
        `insert into order_items (order_id, product_id, variant_id, product_name, product_slug, sku, size, color, image_url,
                                  unit_price_cents, quantity, line_total_cents)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [rows[0].id, l.v.productId, l.v.id, l.v.name, l.v.slug, l.v.sku, l.v.size, l.v.color, l.v.image, l.v.price, l.qty, l.v.price * l.qty],
      );
    }
    await db.query(
      `insert into payments (order_id, provider, provider_ref, amount_cents, currency, status, created_at)
       values ($1, 'demo', $2, $3, 'USD', 'succeeded', now() - ($4 || ' days')::interval)`,
      [rows[0].id, `demo_seed_${i}`, total, String(daysAgo)],
    );
  }

  await db.query('commit');
  console.log(`seeded ${products.length} products, ${categories.length} categories, ${reviews.length} demo reviews, 26 demo orders`);
  console.log(`admin:    ${accounts[0].email}`);
  console.log(`staff:    ${accounts[1].email}`);
  console.log(`customer: ${accounts[2].email}`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
