# Phase 1 AI proposals

Five proposals for review. Nothing here was executed: no test run, no trace, and no CI job backs these claims. Expected values are computed from `docs/CONTRACT.md`, the seeded product data, and the requirement text.

Case 3 is a one-line locator change. Case 5 is a diagnosis only and changes no file.

---

## Case 1 - Order history newest first

**Files touched:** `tests/orders.spec.ts` (new file)
**Requirement:** REQ-ORD-01 - Order history lists the newest order first.
**Prompt followed:** `prompts/new-test-from-requirement.md`

### 1. Test file path and full file body

`tests/orders.spec.ts`:

```ts
import { expect, login, test, uiToken } from './fixtures';

test.describe('Orders', () => {
  test('REQ-ORD-01 order history lists the newest order first', async ({ page }) => {
    await login(page);

    // Use the browser session's own token so the orders created here belong to
    // the user the UI is about to render.
    const token = await uiToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    async function placeOrder(productId: string): Promise<string> {
      const added = await page.request.post('/api/cart', {
        headers: auth,
        data: { productId, qty: 1 },
      });
      expect(added.status(), `adding ${productId} should succeed`).toBe(200);

      const response = await page.request.post('/api/checkout', {
        headers: auth,
        data: {},
      });
      expect(response.status(), 'checkout should succeed').toBe(201);

      const { order } = (await response.json()) as { order: { id: string } };
      return order.id;
    }

    // p3 and p4 produce different totals, so the two rows are easy to tell
    // apart in a failure message.
    const olderOrderId = await placeOrder('p3');

    // A real gap, not a wait for a UI condition: the two orders must have
    // different creation times for "newest" to mean anything.
    await page.waitForTimeout(1_000);

    const newerOrderId = await placeOrder('p4');

    await page.goto('/#/orders');

    const rows = page.getByTestId('order-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(newerOrderId);
    await expect(rows.nth(1)).toContainText(olderOrderId);
  });
});
```

### 2. Assertions and the clause each one proves

- `await expect(rows).toHaveCount(2)` - "Order history lists" both orders; this is the precondition that makes an order comparison possible.
- `await expect(rows.nth(0)).toContainText(newerOrderId)` - "the newest order first": the order placed second is the first row.
- `await expect(rows.nth(1)).toContainText(olderOrderId)` - "the newest order first": the order placed first is the second row.

The order ids come from the `POST /api/checkout` responses, so they are exact, not scraped from the page. Totals are deliberately not asserted here; REQ-CHK-01 and REQ-CHK-04 own those values.

### 3. What would have to break for this test to fail

- `GET /api/orders` returns insertion order instead of reverse insertion order.
- The UI renders `body.items` in reverse, or otherwise re-sorts the list oldest-first.
- One of the two checkouts is dropped from the response or the list only shows the newest order.
- `order-row` is rendered once per order but the id is placed outside its row.

### 4. Deliberately not tested, and why

- The timestamp text: `#/orders` renders only `createdAt.slice(0, 10)`, a date, so two orders on the same day are indistinguishable by timestamp. The test uses placement order and ids instead.
- Totals and item counts: those belong to REQ-CHK-01 and REQ-CHK-04.
- Multi-user isolation of `GET /api/orders`: that is a different behaviour and is covered by the seeded-bug spec for BUG-10.
- The same-total case: two orders with identical totals would still be distinguishable by id, but distinct products make a failure message easier to read.

---

## Case 2 - Empty search state

**Files touched:** `tests/catalog.spec.ts` (one added test inside `test.describe('Catalog')`; no other change)
**Requirement:** REQ-CAT-05 - A search with no matches shows an empty state and does not error.
**Prompt followed:** `prompts/new-test-from-requirement.md`

### 1. Test file path and the addition

Insert inside `test.describe('Catalog')`, after the REQ-CAT-03 case and before the REQ-CAT-04 API case. Full added body:

```ts
  test('REQ-CAT-05 a search with no matches shows an empty state and no error', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.getByTestId('search-input').fill('zzzz-no-such-product');

    await expect(page.getByTestId('product-card')).toHaveCount(0);
    await expect(page.getByText('No products found.')).toBeVisible();
    // The error branch renders "Could not load products: ..."; no such banner
    // may be on screen after a successful empty search.
    await expect(page.getByText(/Could not load products/)).toHaveCount(0);
  });
```

### 2. Assertions and the clause each one proves

- `await expect(page.getByTestId('product-card')).toHaveCount(6)` - precondition: the unfiltered list is loaded before the search, so a zero count afterwards is caused by the search.
- `await expect(page.getByTestId('product-card')).toHaveCount(0)` - "a search with no matches": no product is listed.
- `await expect(page.getByText('No products found.')).toBeVisible()` - "shows an empty state": the empty-state message is on screen.
- `await expect(page.getByText(/Could not load products/)).toHaveCount(0)` - "does not error": the load-failure banner is absent.

The empty-state and error checks are ordered after the zero-count check, so the list has finished loading before "no error" is asserted; the assertion cannot pass against the initial "Loading..." screen.

### 3. What would have to break for this test to fail

- The filter is skipped for a query that matches nothing, leaving all six cards visible.
- The empty result renders a blank grid with no empty-state message.
- The search request fails and the catch branch renders "Could not load products: ...".
- The empty state is rendered together with an error banner.

### 4. Deliberately not tested, and why

- Case sensitivity: REQ-CAT-03 owns that.
- The `0 items` counter: redundant with the zero card count and not part of the requirement text.
- The exact reason an error occurred: the requirement only says "does not error".
- A dedicated empty-state test id: the contract has none. The app renders the text `No products found.` at `app/public/index.html:168`, and the contract says visible text is acceptable for assertions (`docs/CONTRACT.md:56`). A stable test id would be better, but adding one is an app/contract change, not part of this test.

---

## Case 3 - Checkout button locator

**Files touched:** `tests/cart.spec.ts` - the one checkout-button click on the `#/cart` route.
**Call-site note:** a search of the current `tests/` tree finds no `getByRole('button', { name: 'Checkout' })` call, so I cannot confirm the call site from this checkout. If the failing test lives in another spec, apply the diff in that spec and nowhere else; the diff itself is unchanged.
**Prompt followed:** `prompts/locator-fix.md`

### 1. Old locator and new locator

```diff
- await page.getByRole('button', { name: 'Checkout' }).click();
+ await page.getByTestId('checkout-button').click();
```

Contract support: `docs/CONTRACT.md:52` maps `#/cart` to `checkout-button` for the checkout button, and `docs/CONTRACT.md:56` says test ids are for selectors. The test id is the contract-level handle for this element.

### 2. Evidence that the element still exists under the new locator

The supplied evidence is the BUG-06 behaviour: with the bug active the label becomes `Proceed to payment`. That describes the same control with different text. In `app/public/index.html`:

- line 238 creates the button as `<button data-testid="checkout-button"></button>`;
- line 289 selects it by `[data-testid=checkout-button]`;
- line 291 changes only `textContent`, to `Proceed to payment` under BUG-06 or `Checkout` otherwise;
- line 292 attaches the click handler that sets `location.hash = '#/checkout'`, independent of the label.

So the element, its test id, and its action are unchanged; only the accessible name changes. No trace file was supplied with this case, so this is code-level evidence rather than a trace line.

### 3. Why the old locator broke

A copy change: the button's visible label is conditionally different under BUG-06. This is not a structure change and not a product behaviour change - the button still routes to `#/checkout`. It only breaks under the seeded bug; with BUG-06 inactive the role-name locator would still match. The test id is stable in both states.

### 4. Assertion statement

No assertion changed. This proposal changes one locator and nothing else.

---

## Case 4 - `seedCart` helper

**Files touched:** `tests/fixtures.ts` (new exported type and helper at the end of the file; no existing helper changed)
**Prompt followed:** `prompts/test-data-setup.md`

### 1. Signature and body

```ts
export type SeedCartItem = { productId: string; qty?: number };

/**
 * Sign in through the API and put items in that token's cart. Returns the
 * token so the caller can check out or read the cart without signing in again.
 * The browser is not signed in by this helper - use login(page) for that.
 */
export async function seedCart(
  request: APIRequestContext,
  items: SeedCartItem[],
  email: string = DEMO_USER.email,
  password: string = DEMO_USER.password,
): Promise<string> {
  const token = await apiLogin(request, email, password);
  const auth = { Authorization: `Bearer ${token}` };

  for (const { productId, qty = 1 } of items) {
    const response = await request.post('/api/cart', {
      headers: auth,
      data: { productId, qty },
    });
    expect(response.status(), `seeding ${productId} x${qty} should succeed`).toBe(200);
  }

  return token;
}
```

`APIRequestContext` and `DEMO_USER` are already imported/defined at the top of the file, and `apiLogin` is already there, so this is one added export plus one type.

Example call from a test:

```ts
const token = await seedCart(request, [
  { productId: 'p1' },
  { productId: 'p3', qty: 2 },
]);
```

### 2. Why each step is the cheapest that produces the state

- `apiLogin` - one `POST /api/login`, no page load, no login selectors. It already asserts a 200 and a token, so a failed sign-in fails at the setup step with a clear message.
- One `POST /api/cart` per item - the contract's add route is the only way to put a product in the cart, and it returns the updated cart in one round trip. A `qty` above 1 uses the same call rather than a second add or a PATCH.
- Sequential `for ... of` with `await` - the server mutates one cart per token; issuing the adds concurrently would allow response interleaving for no speed benefit.
- Return the token - the caller can immediately `POST /api/checkout` or `GET /api/cart` with it. No second login, no reading `localStorage`, no hard-coded token.

### 3. What would make the setup non-deterministic, and how this avoids it

- **State left by an earlier test or run.** The autouse `resetStateBeforeEach` fixture calls `POST /api/__reset` before every test (`tests/fixtures.ts:95-103`), and the reset clears `carts`, `orders`, `sessions`, and `productListCalls` (`app/server.js:131-137`). A token obtained before the reset is invalid, so `seedCart` must be called inside the test body (or in a `beforeEach` that runs after the reset fixture), not in `beforeAll`.
- **Two workers sharing one store.** `playwright.config.ts:10-11` sets `fullyParallel: false` and `workers: 1`; the `stateLock` fixture in `tests/fixtures.ts:76-88` also serialises the file even if that config changes. Without one of those, another test's reset could wipe this cart mid-test.
- **A shared token or cart between files.** The token is a fresh server-generated UUID for this login; the contract keeps carts per token, so two helpers signed in as the same user do not share a cart. Nothing is cached at module scope.
- **Duplicate product ids.** `POST /api/cart` accumulates quantity for an id already in the cart, so `[{ p3 }, { p3 }]` produces `p3` x2, not two rows. The helper is deterministic either way, but callers should pass each id once and use `qty`; this is the one caller-side rule the helper does not enforce.
- **A guessed quantity.** `qty` defaults to the contract's documented default of 1, and every add is asserted to return 200 before the next one runs.

The helper signs in through the API only. A UI test still needs `login(page)` (or an explicit token write) because `seedCart` does not touch the browser's `localStorage`; that is intentional, since the API token and the browser session are separate concerns.

---

## Case 5 - REQ-CART-02 token race in CI

**Files touched:** none. This is a diagnosis; the proposed next action is to read an existing artifact or re-run, not to change a test.

### 1. Classification

**Test bug - high confidence** for the quoted failure.

The failure is in the test's synchronization, not in the order total, and not in the application's tax calculation. The pass/fail split across local and CI is consistent with a timing race that CI load makes more likely; it is not a second, separate failure classification. This is not "flaky" by the prompt's definition: there is one quoted failure, no mixed pass/fail history for the same code in the same environment, and there is an identified defect in the helper.

### 2. Evidence, quoted, in order of importance

1. `✘ 6 [chromium] › tests/cart.spec.ts:26:3 › Cart › REQ-CART-02 quantity change updates subtotal, tax and total (tax = 8%)` - identifies the failing test. Its first line after `login(page)` is `await addToCartViaApi(page, 'p3')` (`tests/cart.spec.ts:28`), and that helper calls `uiToken(page)` (`tests/fixtures.ts:175`).
2. `Error: the signed-in page should hold a token` - the custom message comes from `uiToken` (`tests/fixtures.ts:164` in the current file). The failure is the token check, not a subtotal, tax, or total assertion.
3. `at uiToken (tests/fixtures.ts:159:11)` - the stack pins the failure inside the helper, so the test never reached the assertions at `tests/cart.spec.ts:36-38`.
4. The current `tests/fixtures.ts` has changed since that log: line 159 is now inside `addToCartFromUi`, while `uiToken` starts at line 161 and polls with `expect.poll` at lines 162-166. `login` now ends with `await page.waitForURL('**/#/products')` at line 134. Those are exactly the two synchronization points this failure needs. The line-number mismatch is evidence that the helper file was edited after the run; it does not, by itself, prove what the old code looked like.
5. Reported context, not a line I can inspect: the same suite failed in CI that night while passing locally. No CI log for any other test, and no local run log, was supplied.

The quoted failure does not show a network response, a console message, or a storage timestamp. No trace, screenshot, or video was supplied, even though the current config retains a trace on failure (`playwright.config.ts:19`).

### 3. Smallest next action that would confirm or refute the diagnosis

Open the retained trace/artifact for that CI run and read the timeline around the failing read: the `POST /api/login` response, the `localStorage.setItem('token', ...)` call, and the read that produced the error. If the login returns 200 and the token is written only after the helper has already read storage, the race is confirmed. If login never returns 200, or the token is written before the read and then missing, the diagnosis is wrong and the failure moves to the app or the environment.

If the artifact no longer exists, re-run the same commit in CI with tracing enabled and capture the same three events. Do not change the assertion while doing this; the failure is in setup, not in the expected values.

### 4. What this diagnosis does not prove

- It does not prove the login request was slow, or that the app ever stored a token for that attempt.
- It does not prove the token arrived after a timeout rather than never being written; the log only says the helper gave up without one.
- It does not prove anything about the 8% tax behaviour: the test failed before those assertions ran.
- It does not prove that the other CI failures that night share this cause; their logs are not quoted.
- It does not prove the current fix (`waitForURL` plus the poll) is sufficient under CI load; there is no post-fix run history here.
- It does not prove the suite is generally flaky, and it does not justify a retry.
