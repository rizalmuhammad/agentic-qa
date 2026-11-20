# Phase 0 Contract — Shop App + Playwright Suite

Everyone building Phase 0 codes against this file. Do not invent routes, test ids, or behaviour that is not here.

## Stack
- App: Node 22 + Express, plain CommonJS JS (no build step). Static UI, one HTML page, client-side hash routing.
- Tests: Playwright + TypeScript.
- Port: 3100 (`PORT` env overrides).

## Repo layout (Phase 0)
```
app/server.js            Express server, seeded-bug hooks
app/public/index.html    all UI, inline CSS + JS
tests/*.spec.ts          Playwright specs
tests/fixtures.ts        shared helpers
playwright.config.ts
package.json
.github/workflows/ci.yml
docs/                    plan, risk policy, progress, failure guide, seeded bug list
```

## Auth
- Demo user: `demo@shop.test` / `demo1234` (name: Demo User).
- `POST /api/login {email,password}` → 200 `{token,user:{name,email}}` or 401 `{error}`.
- Every other `/api/*` except `/api/products` and `/api/__*` needs `Authorization: Bearer <token>`.
- Invalid/expired token → 401 `{error:"unauthorized"}`.

## Products
- 6 products seeded in memory. Fields: `id,name,price,category,stock`.
- Seeded catalogue (price is the unit price in dollars):

| id | name | price | category | stock |
|---|---|---|---|---|
| p1 | Aurora Laptop | 1299.00 | laptops | 5 |
| p2 | Trailback Backpack | 89.00 | accessories | 12 |
| p3 | Lumen Desk Lamp | 45.00 | home | 20 |
| p4 | Pebble Speaker | 19.99 | audio | 8 |
| p5 | Nomad Mug | 15.00 | home | 40 |
| p6 | Vertex Monitor | 349.50 | monitors | 0 |

- `GET /api/products?q=` → `{items:[...]}`. `q` matches name, case-insensitive by default.
- `GET /api/products/:id` → product or 404.

## Cart (per token, in memory)
- `GET /api/cart` → `{items:[{productId,name,price,qty}], subtotal, tax, total}`. Empty cart: `items:[], subtotal:0, tax:0, total:0`.
- `POST /api/cart {productId,qty=1}` → updated cart (200).
- `PATCH /api/cart/:productId {qty}` → updated cart. `qty <= 0` → 400 `{error}` and cart unchanged.
- `DELETE /api/cart/:productId` → updated cart.
- Money: integer cents internally, returned as numbers with 2 decimals.

## Checkout
- `POST /api/checkout {discountCode?}` → 201 `{order:{id,items,subtotal,tax,discount,total,createdAt}}`.
- Tax = 8% of subtotal, rounded to cents.
- Discount code `SAVE10` = 10% of subtotal, capped at the subtotal.
- Empty cart → 400 `{error:"cart empty"}`.
- `GET /api/orders` → `{items:[...]}` for the logged-in user only, newest first.
- In `#/checkout`, `checkout-subtotal`, `checkout-tax` and `order-total` show the cart before the discount is applied (`order-total` is subtotal + tax). The code in `discount-code` is applied when `place-order` is clicked, which replaces the page with `order-confirmation`; the discount and final total must be asserted there.

## UI (hash routes) and required `data-testid` hooks
| Route | Element | test id |
|---|---|---|
| `#/login` | email input / password input / submit button / error box | `login-email` / `login-password` / `login-submit` / `login-error` |
| `#/products` | search input / product card / add button / cart link | `search-input` / `product-card` / `add-to-cart` (one per card, with `data-product-id`) / `nav-cart` |
| `#/cart` | row / qty input / remove button / subtotal / tax / total / checkout button | `cart-row` / `qty-input` / `remove-item` / `cart-subtotal` / `cart-tax` / `cart-total` / `checkout-button` |
| `#/checkout` | total / place order button / confirmation | `order-total` / `place-order` / `order-confirmation` |
| `#/checkout` | subtotal / tax / discount code input / error box | `checkout-subtotal` / `checkout-tax` / `discount-code` / `checkout-error` |
| `#/orders` | order row | `order-row` |

Visible text is acceptable for assertions; test ids are for selectors. Money renders as `$12.34`.
Login redirects to `#/products`; add-to-cart shows a toast (`[data-testid=toast]`).

## Seeded bugs
Inactive by default. Activated by `?bugs=BUG-01,BUG-02` on any page (sets a `seeded_bugs` cookie) or `SEEDED_BUGS=all` env for the server. When active, the server exposes the active ids at `GET /api/__bugs` and the UI reads them for client-side bugs.
The authoritative list (id, flow, severity, expected symptom) is the private seeded-bug list and must not be given to future agents at run time.

## Definition of green
`npm test` passes against the app with no bugs enabled. Each spec title names the requirement it covers.
