# Project architecture

## Starting point

The repository previously held unrelated files (Windows installers, a committed `node_modules`, a Python poster script, Java exercises and an unfinished Vite stub with a Supabase client). None of it was a working store, so it was removed and the project was started fresh, as requested.

## Stack and why

| Concern | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript | Server components keep data access and secrets on the server; server actions give typed mutations with built-in CSRF protection (same-origin checks). |
| Database | PostgreSQL via `pg` | Relational data with real constraints. Works with any host, including Supabase. Plain parameterised SQL keeps queries visible and injection-safe. |
| Validation | zod | Every server action and route validates its input; shared schemas give the checkout the same rules on both sides. |
| Styling | Tailwind CSS 4 with CSS custom properties | Tokens live in one file and power both themes. |
| Motion | CSS for UI transitions, Framer Motion for sheets, GSAP for one hero parallax, react-three-fiber for one cloth study | Each library is used where it fits, and loaded only when needed. |
| Payments | Stripe Checkout + webhook, optional demo provider | No card data on our servers; payment state changes only from verified webhooks. |
| Email | Resend over HTTP, file outbox fallback | No SDK, testable locally. |

## Request flow

- **Reads** happen in server components through `src/lib/*` modules (`catalog.ts`, `cart.ts`, `orders.ts`, `admin.ts`).
- **Writes** happen in server actions (`src/app/actions/*`, `src/app/admin/actions.ts`). Each action rate-limits where useful, checks the session and permission, validates with zod, writes inside a transaction when several rows change, writes an audit entry for sensitive changes, then revalidates.
- **Client components** hold only UI state. The bag, wishlist and toasts live in `StoreProvider`; every change round-trips to the server, which returns the recomputed bag.

## Trust boundaries

- Prices, discounts, shipping, tax and totals are always computed on the server from database rows (`src/lib/totals.ts`). The checkout UI asks the server for a quote and displays it.
- Stock is decremented inside the order transaction with `update … where quantity >= $n`, so concurrent checkouts can never oversell. Cancellation restocks exactly once (`stock_released` flag).
- Coupon usage is claimed with a guarded update, so usage limits hold under concurrency.
- Admin pages call `requireAdmin(permission)`; admin actions call `assertPermission(permission)`. Navigation hides what a role cannot use, but the server is the gate.
- Orders are visible to their owner, or to anyone with the random access key from the confirmation link (stored hashed). Unknown and forbidden orders both return 404.

## Folders

See the layout in the README.
