# Database schema

Defined in `db/migrations/001_init.sql`. Money is integer cents; timestamps are `timestamptz`; ids are UUIDs except `roles` and `audit_logs`.

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `roles` | customer, staff, admin with a `permissions text[]` | unique `key` |
| `users` | accounts | unique case-insensitive `email` (citext), FK `role_id`, status check |
| `profiles` | names, phone, marketing consent | PK = FK `user_id` |
| `sessions` | sign-in sessions (token stored as SHA-256 hash) | unique `token_hash`, index on expiry |
| `auth_tokens` | email verification and password reset (hashed, single use, expiring) | unique `token_hash`, kind check |
| `addresses` | saved addresses | one default per user (partial unique index) |
| `categories` | departments, product types, collections | unique slug with format check, kind check |
| `products` | catalogue | unique slug, price ≥ 0, compare-at > price, status check |
| `product_images` | gallery, optionally tied to a colour | FK cascade, index by sort order |
| `product_categories` | many-to-many | composite PK |
| `product_variants` | size × colour, SKU | unique SKU, unique (product, size, colour), hex check |
| `inventory` | stock per variant | `quantity >= 0` check (last line of defence against overselling) |
| `carts`, `cart_items` | bags for users or hashed visitor cookies | one cart per user/visitor, quantity 1–10, unique (cart, variant) |
| `wishlists`, `wishlist_items` | saved products | composite PK |
| `coupons` | promo codes | unique citext code, percent ≤ 100, usage limit > 0 |
| `shipping_methods` | delivery options | unique code |
| `orders` | snapshot of customer, address, totals | unique `number`, status and payment-status checks, indexes on user, email, status, date |
| `order_items` | line snapshot (name, SKU, size, colour, price) | FKs `on delete set null` so history survives product deletion |
| `payments` | provider payments and refunds | refunded ≤ amount, unique (provider, ref) |
| `reviews` | product reviews, `is_demo` flag for seed content | rating 1–5, one per user per product |
| `settings` | JSON store settings by section | PK `key` |
| `newsletter_subscribers` | email list | unique citext email |
| `audit_logs` | append-only record of sensitive actions | indexes by entity and date |

`schema_migrations` tracks applied files. Seed data: `scripts/seed.ts`.

The brief's `users`/`profiles`/`roles` model is implemented in the application rather than in Supabase Auth, so the app runs on any PostgreSQL. All database access is server-side with a single connection string; there is no browser-to-database access, so row-level security policies are not needed. If you move to Supabase with client-side access, add RLS policies for `carts`, `wishlists`, `addresses` and `orders` keyed on the user.
