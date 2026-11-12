# Halden

A complete fashion e-commerce store: an editorial storefront, a real shopping and checkout flow, customer accounts, and a role-based admin dashboard. Built with Next.js 16 (App Router), TypeScript, PostgreSQL and Tailwind CSS 4.

Halden is a fictional brand created for this project. All product photography and campaign imagery was generated with Higgsfield (see [docs/ASSET_REQUIREMENTS.md](docs/ASSET_REQUIREMENTS.md)). Customer reviews in the seed data are demonstration content and are labelled as such on the site.

## What is included

**Storefront**: homepage with campaign hero, collections, featured products, brand story, an interactive 3D cloth study, seasonal campaign, reviews and newsletter. Catalogue with URL-driven filters (category, department, size, colour, collection, material, brand, price, stock, sale), six sort orders and pagination. Search overlay with live product and category suggestions, recent searches and keyboard navigation. Product pages with gallery, hover zoom and full-screen viewer, colour-aware imagery, size validation, sold-out sizes disabled, quantity, wishlist, buy now, size guide, reviews, related and recently viewed products.

**Shopping**: persistent bag for guests and signed-in customers (merged on sign-in), variant switching in the bag, promo codes, free-shipping meter, four-step checkout (contact, address, delivery, payment) for guests and customers, Stripe Checkout or demo payments, order confirmation, order tracking by number and email.

**Accounts**: register, sign in, sign out, password reset by email, email confirmation, profile, saved addresses, order history and detail, wishlist.

**Admin** (`/admin`): dashboard with revenue, orders, products, low stock, open orders, 30-day sales chart, best sellers, recent transactions and customers. Product editor with categories, pricing and discounts, image upload and gallery, colour/size variants with per-variant stock. Inventory, categories, orders (status, tracking, payment, cancel with restock, refunds, audit trail), customers (history, suspend, roles), promotions, store settings, delivery methods, roles and permissions, and an audit log.

## Requirements

- Node.js 20 or later (developed on 22)
- PostgreSQL 14 or later (local, Supabase, Neon, RDS …)

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `DATABASE_URL`. For a local database:

```bash
createdb halden
```

Create the schema and load the demo catalogue, accounts and 30 days of demo orders:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Start the app on http://localhost:3000:

```bash
npm run dev
```

Seeded accounts (passwords come from `.env.local`; change them before deploying anywhere):

| Role | Email | Can do |
| --- | --- | --- |
| Administrator | `admin@halden.test` | Everything |
| Store staff | `staff@halden.test` | Dashboard, products, inventory, orders, customers |
| Customer | `customer@halden.test` | Storefront account only |

Demo promo codes: `WELCOME10` (10% off), `LOWSUN25` ($25 off over $250), `STUDIO20` (20% off over $100), `SPRING15` (expired, for testing).

`npm run db:reset` drops and recreates everything. It refuses to run in production.

## Payments

- **Stripe**: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Customers are sent to Stripe Checkout; the order is only marked paid by the signed webhook at `/api/webhooks/stripe` (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`). Card details never touch this server. Refunds from the admin go through the Stripe API. Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- **Demo payments**: mark an order as paid without moving money. Always available in development; in production only when `PAYMENTS_DEMO_MODE=true` (use this only for a portfolio deployment). Either method can be switched off in Admin → Settings.

If neither is available, checkout tells the customer that online payment is not set up and no order can be placed.

## Email

With `RESEND_API_KEY` set, order, verification and password-reset emails go through Resend. Without it they are written to `storage/outbox/` so the flows can be tested locally.

## Tests

Unit tests (pricing, discounts, shipping, coupon rules):

```bash
npm test
```

End-to-end tests drive a real browser through registration, search, filters, product validation, wishlist, bag, coupons, checkout, stock reduction, oversell protection, order access control, tracking, admin access control by role, product creation with variants and image upload, publishing, inventory, order status, tracking and refunds, coupons, settings, the audit log and account suspension. They need the dev server running against a seeded database, Playwright installed, and `DISABLE_RATE_LIMIT=true` in `.env.local` (ignored in production):

```bash
npm run test:e2e
```

Last run: 30 of 30 steps passed, with no browser console errors.

## Deployment

1. Provision PostgreSQL and set `DATABASE_URL` (and `DATABASE_SSL=require` for hosted databases).
2. Set `NEXT_PUBLIC_SITE_URL` to the public origin; it is used for canonical URLs, the sitemap, emails and Stripe redirects.
3. Run `npm run db:migrate` against the production database. Seed only if you want the demo catalogue (`npm run db:seed -- --force`), then change the seeded passwords.
4. Set Stripe and Resend keys, and register the Stripe webhook endpoint.
5. `npm run build` then `npm start` behind HTTPS (or deploy to any Node host, including Vercel).

Notes for production:

- **Uploads** are stored on local disk in `storage/uploads/` and served from `/media/…`. On serverless hosts with ephemeral disks, swap `uploadImageAction` and the media route for object storage (S3, R2, Supabase Storage).
- **Rate limiting** is in-memory per process. With several instances, back `src/lib/rate-limit.ts` with Redis.
- Sessions are HTTP-only, SameSite=Lax cookies holding a random token; only its SHA-256 hash is stored.

## Project layout

```
db/migrations/        SQL schema
scripts/              migrate, seed, image conversion
src/app/(store)/      storefront routes
src/app/admin/        admin routes and server actions
src/app/actions/      storefront server actions
src/app/api/          search suggestions, Stripe webhook
src/components/       UI (store/, admin/, home/)
src/lib/              database, auth, catalogue, cart, orders, payments, settings
assets-src/           image generation prompts (PNG masters are not committed)
public/images/        optimised campaign, collection and product images
tests/                unit and end-to-end tests
docs/                 architecture, design system, schema, features, assets
```

More detail: [architecture](docs/PROJECT_ARCHITECTURE.md), [design system](docs/DESIGN_SYSTEM.md), [database schema](docs/DATABASE_SCHEMA.md), [feature plan and status](docs/FEATURE_PLAN.md), [assets](docs/ASSET_REQUIREMENTS.md).
