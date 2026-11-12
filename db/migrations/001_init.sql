-- Halden store — initial schema.
-- Money is stored as integer minor units (cents). All timestamps are timestamptz.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Identity & access
-- ---------------------------------------------------------------------------
create table roles (
  id          smallint generated always as identity primary key,
  key         text not null unique,
  name        text not null,
  permissions text[] not null default '{}'
);

create table users (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  password_hash     text not null,
  role_id           smallint not null references roles(id),
  status            text not null default 'active' check (status in ('active', 'suspended')),
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now()
);
create index users_role_idx on users(role_id);
create index users_created_idx on users(created_at desc);

create table profiles (
  user_id          uuid primary key references users(id) on delete cascade,
  first_name       text not null default '',
  last_name        text not null default '',
  phone            text,
  marketing_opt_in boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expires_idx on sessions(expires_at);

create table auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_user_idx on auth_tokens(user_id, kind);

create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  label       text not null default 'Home',
  first_name  text not null,
  last_name   text not null,
  line1       text not null,
  line2       text,
  city        text not null,
  region      text,
  postal_code text not null,
  country     char(2) not null,
  phone       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index addresses_user_idx on addresses(user_id);
create unique index addresses_one_default_idx on addresses(user_id) where is_default;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  kind        text not null check (kind in ('department', 'type', 'collection')),
  description text not null default '',
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  is_featured boolean not null default false,
  created_at  timestamptz not null default now()
);
create index categories_kind_idx on categories(kind, sort_order);

create table products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null,
  description      text not null default '',
  brand            text not null default 'Halden',
  material         text not null default '',
  material_details text not null default '',
  care             text not null default '',
  fit              text not null default '',
  price_cents      integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents > price_cents),
  status           text not null default 'draft' check (status in ('draft', 'published')),
  badge            text,
  is_featured      boolean not null default false,
  popularity       integer not null default 0,
  sold_count       integer not null default 0 check (sold_count >= 0),
  video_url        text,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_status_idx on products(status, published_at desc);
create index products_price_idx on products(price_cents);
create index products_name_search_idx on products (lower(name) text_pattern_ops);

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  color      text,
  sort_order integer not null default 0
);
create index product_images_product_idx on product_images(product_id, sort_order);

create table product_categories (
  product_id  uuid not null references products(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on product_categories(category_id);

create table product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku        text not null unique,
  size       text not null,
  color      text not null,
  color_hex  text not null default '#888888' check (color_hex ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  unique (product_id, size, color)
);
create index product_variants_product_idx on product_variants(product_id);

-- Stock is tracked per variant. quantity can never go negative: order placement
-- decrements with a guarded UPDATE inside a transaction (see src/lib/orders.ts).
create table inventory (
  variant_id          uuid primary key references product_variants(id) on delete cascade,
  quantity            integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  updated_at          timestamptz not null default now()
);

create table reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references products(id) on delete cascade,
  user_id              uuid references users(id) on delete set null,
  author_name          text not null,
  rating               smallint not null check (rating between 1 and 5),
  title                text not null default '',
  body                 text not null,
  is_verified_purchase boolean not null default false,
  is_demo              boolean not null default false,
  status               text not null default 'published' check (status in ('pending', 'published', 'rejected')),
  created_at           timestamptz not null default now()
);
create index reviews_product_idx on reviews(product_id, status, created_at desc);
create unique index reviews_one_per_user_idx on reviews(product_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Cart & wishlist (guest carts are keyed by a hashed visitor cookie)
-- ---------------------------------------------------------------------------
create table coupons (
  id                 uuid primary key default gen_random_uuid(),
  code               citext not null unique,
  description        text not null default '',
  campaign           text not null default '',
  kind               text not null check (kind in ('percent', 'fixed')),
  value              integer not null check (value > 0),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents >= 0),
  starts_at          timestamptz,
  expires_at         timestamptz,
  usage_limit        integer check (usage_limit is null or usage_limit > 0),
  used_count         integer not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

create table carts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references users(id) on delete cascade,
  visitor_hash  text unique,
  coupon_id     uuid references coupons(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (user_id is not null or visitor_hash is not null)
);

create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity   integer not null check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table wishlists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references users(id) on delete cascade,
  visitor_hash text unique,
  created_at   timestamptz not null default now(),
  check (user_id is not null or visitor_hash is not null)
);

create table wishlist_items (
  wishlist_id uuid not null references wishlists(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Orders & payments
-- ---------------------------------------------------------------------------
create table shipping_methods (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text not null default '',
  price_cents     integer not null check (price_cents >= 0),
  free_over_cents integer check (free_over_cents is null or free_over_cents >= 0),
  min_days        integer not null default 2,
  max_days        integer not null default 5,
  is_active       boolean not null default true,
  sort_order      integer not null default 0
);

create table orders (
  id                   uuid primary key default gen_random_uuid(),
  number               text not null unique,
  access_key_hash      text not null,
  user_id              uuid references users(id) on delete set null,
  email                citext not null,
  first_name           text not null,
  last_name            text not null,
  phone                text,
  ship_line1           text not null,
  ship_line2           text,
  ship_city            text not null,
  ship_region          text,
  ship_postal_code     text not null,
  ship_country         char(2) not null,
  shipping_method_id   uuid references shipping_methods(id) on delete set null,
  shipping_method_name text not null,
  status               text not null default 'pending'
                       check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status       text not null default 'unpaid'
                       check (payment_status in ('unpaid', 'paid', 'failed', 'refunded', 'partially_refunded')),
  currency             char(3) not null,
  subtotal_cents       integer not null check (subtotal_cents >= 0),
  discount_cents       integer not null default 0 check (discount_cents >= 0),
  shipping_cents       integer not null default 0 check (shipping_cents >= 0),
  tax_cents            integer not null default 0 check (tax_cents >= 0),
  total_cents          integer not null check (total_cents >= 0),
  coupon_id            uuid references coupons(id) on delete set null,
  coupon_code          text,
  tracking_carrier     text,
  tracking_number      text,
  stock_released       boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index orders_user_idx on orders(user_id, created_at desc);
create index orders_email_idx on orders(email);
create index orders_status_idx on orders(status, created_at desc);
create index orders_created_idx on orders(created_at desc);

create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  product_id       uuid references products(id) on delete set null,
  variant_id       uuid references product_variants(id) on delete set null,
  product_name     text not null,
  product_slug     text not null,
  sku              text not null,
  size             text not null,
  color            text not null,
  image_url        text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);
create index order_items_order_idx on order_items(order_id);
create index order_items_product_idx on order_items(product_id);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  provider       text not null check (provider in ('stripe', 'demo')),
  provider_ref   text,
  amount_cents   integer not null check (amount_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency       char(3) not null,
  status         text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (refunded_cents <= amount_cents)
);
create index payments_order_idx on payments(order_id);
create unique index payments_provider_ref_idx on payments(provider, provider_ref) where provider_ref is not null;

-- ---------------------------------------------------------------------------
-- Store configuration, marketing, audit
-- ---------------------------------------------------------------------------
create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null unique,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references users(id) on delete set null,
  actor_email text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}',
  ip          text,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on audit_logs(created_at desc);
