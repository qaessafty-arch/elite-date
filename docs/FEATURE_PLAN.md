# Feature plan and status

Status is what was built and checked in this repository. "Tested" means exercised by `npm run test:e2e` or `npm test`.

| Area | Feature | Status |
| --- | --- | --- |
| Homepage | Dismissible rotating announcement bar | Built |
| | Sticky header, desktop mega menu, mobile drawer, keyboard support | Built |
| | Campaign hero with entrance animation and parallax | Built |
| | Six collection tiles, featured products, brand story, campaign block with live coupon, reviews (labelled demo), newsletter with validation | Built |
| | Interactive 3D cloth study (procedural, lazy-loaded) | Built |
| Catalogue | Category, department, size, colour, collection, material, brand, price, stock, sale filters in the URL | Tested |
| | Six sort orders, pagination preserving filters | Tested (sort) |
| | Search overlay with live suggestions, recent searches, no-results state, keyboard navigation, results page | Tested |
| Product | Gallery, thumbnails, hover zoom, full-screen viewer, colour-specific imagery, sold-out sizes disabled, required size validation, quantity, stock note, wishlist, buy now, size guide, delivery and returns, reviews, related, recently viewed, structured data | Tested (core) |
| Bag | Add, remove, quantity, change variant, coupons, free-shipping meter, persistent guest and account bags, merge on sign-in | Tested (core) |
| Checkout | Four steps, guest or account, server totals, Stripe or demo payment, confirmation, email | Tested (demo payment) |
| Orders | Unique number, access key, confirmation page, tracking page, oversell protection | Tested |
| Accounts | Register, sign in/out, password reset, email confirmation, profile, password change, addresses, order history, wishlist | Tested (register, sign in/out, addresses, history) |
| Admin | Dashboard from live data | Tested |
| | Products with categories, discount, images, variants and stock; publish/unpublish; delete | Tested |
| | Inventory, categories | Tested (inventory) |
| | Orders: status rules, tracking, manual payment (dev/demo only), cancel with restock, refunds, audit trail | Tested (status, tracking, refund) |
| | Customers: history, suspend/reactivate, role change | Tested (suspend) |
| | Promotions, settings, delivery methods, roles and permissions, audit log | Tested (coupon, setting, audit) |
| Platform | SEO metadata, Open Graph, product JSON-LD, sitemap, robots, canonical URLs | Built |
| | Security headers, hashed passwords and tokens, rate limiting, upload validation | Built, upload validation tested |
| | Light and dark themes | Built |

## Not done, or needs your setup

- Stripe was not exercised end to end here (no keys in this environment). The code path is written against Stripe's official SDK and webhook verification.
- Emails are written to `storage/outbox/` until `RESEND_API_KEY` is set.
- Product videos are supported by the editor and page but none were generated.
- No interactive 3D garment models are used, because no real 3D garment assets exist. The cloth study is a procedural shader and says so.
- Rate limiting is per process; uploads use local disk. See the README deployment notes.
