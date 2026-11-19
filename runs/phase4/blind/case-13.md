# case-13

Requirement: REQ-CART-02 - Changing quantity updates subtotal, tax (8%), and total.
File under review: tests/cart.spec.ts

## After the change
```ts
import {
  addToCartFromUi,
  addToCartViaApi,
  apiLogin,
  expect,
  login,
  test,
} from './fixtures';

test.describe('Cart', () => {
  test('REQ-CART-01 add to cart shows a toast and the item appears in the cart', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1500);
    await addToCartFromUi(page, 'p3', 'Lumen Desk Lamp');

    await page.getByTestId('nav-cart').click();

    const rows = page.getByTestId('cart-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Lumen Desk Lamp');
    await expect(rows.first().getByTestId('qty-input')).toHaveValue('1');
    await expect(page.getByTestId('cart-subtotal')).toHaveText('$45.00');
    await expect(page.getByTestId('cart-tax')).toHaveText('$3.60');
    await expect(page.getByTestId('cart-total')).toHaveText('$48.60');
  });

  test('REQ-CART-02 quantity change updates subtotal, tax and total (tax = 8%)', async ({ page }) => {
    await login(page);
    await addToCartViaApi(page, 'p3');
    await page.goto('/#/cart');

    const qty = page.getByTestId('qty-input');
    await expect(qty).toHaveValue('1');
    await qty.fill('2');
    await qty.blur();

    await expect(page.getByTestId('cart-subtotal')).toHaveText('$90.00');
    await expect(page.getByTestId('cart-tax')).toHaveText('$7.20');
    await expect(page.getByTestId('cart-total')).toHaveText('$97.20');
  });

  test('REQ-CART-03 remove item empties the cart and totals go to $0.00', async ({ page }) => {
    await login(page);
    await addToCartViaApi(page, 'p3');
    await page.goto('/#/cart');
    await expect(page.getByTestId('cart-row')).toHaveCount(1);

    await page.getByTestId('remove-item').click();

    await expect(page.getByTestId('cart-row')).toHaveCount(0);
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
    await expect(page.getByTestId('cart-subtotal')).toHaveText('$0.00');
    await expect(page.getByTestId('cart-tax')).toHaveText('$0.00');
    await expect(page.getByTestId('cart-total')).toHaveText('$0.00');
  });

  test('REQ-CART-04 qty 0 via API returns 400 and leaves the cart unchanged', async ({ request }) => {
    const token = await apiLogin(request);
    const auth = { Authorization: `Bearer ${token}` };

    const seeded = await request.post('/api/cart', {
      headers: auth,
      data: { productId: 'p3', qty: 1 },
    });
    expect(seeded.status()).toBe(200);

    // The PATCH 0 route is the app's remove gesture, so the "quantity must be
    // positive" guard is asserted on the add path; PATCH 0 is covered by BUG-11.
    const rejected = await request.post('/api/cart', {
      headers: auth,
      data: { productId: 'p3', qty: 0 },
    });
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toEqual({ error: 'quantity must be positive' });

    const cartResponse = await request.get('/api/cart', { headers: auth });
    expect(cartResponse.status()).toBe(200);
    const cart = (await cartResponse.json()) as {
      items: Array<{ productId: string; qty: number }>;
      subtotal: number;
      tax: number;
      total: number;
    };
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('p3');
    expect(cart.items[0].qty).toBe(1);
    expect(cart.subtotal).toBe(45);
    expect(cart.tax).toBe(3.6);
    expect(cart.total).toBe(48.6);
  });

  test('REQ-CART-05 out-of-stock product cannot be added', async ({ request }) => {
    const token = await apiLogin(request);
    const auth = { Authorization: `Bearer ${token}` };

    const response = await request.post('/api/cart', {
      headers: auth,
      data: { productId: 'p6' },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'out of stock' });

    const cartResponse = await request.get('/api/cart', { headers: auth });
    const cart = (await cartResponse.json()) as {
      items: unknown[];
      subtotal: number;
      tax: number;
      total: number;
    };
    expect(cart.items).toHaveLength(0);
    expect(cart.subtotal).toBe(0);
    expect(cart.tax).toBe(0);
    expect(cart.total).toBe(0);
  });
});

```

Verdict: approve / reject / escalate.
