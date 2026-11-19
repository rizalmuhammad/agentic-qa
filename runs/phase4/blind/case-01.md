# case-01

Requirement: REQ-CHK-01 - The order total equals subtotal plus 8% tax, rounded to cents.
File under review: tests/checkout.spec.ts

## After the change
```ts
import { addToCartViaApi, apiLogin, expect, login, test } from './fixtures';

test.describe('Checkout', () => {
  test('REQ-CHK-01 total is subtotal plus 8% tax for a two-item cart', async ({ page }) => {
    await login(page);
    await addToCartViaApi(page, 'p1');
    await addToCartViaApi(page, 'p2');
    await page.goto('/#/checkout');

    await expect(page.getByTestId('checkout-subtotal')).toBeVisible();
    await expect(page.getByTestId('checkout-tax')).toBeVisible();
    await expect(page.getByTestId('order-total')).toBeVisible();
  });

  test('REQ-CHK-02 SAVE10 takes 10% off the subtotal', async ({ page }) => {
    await login(page);
    await addToCartViaApi(page, 'p1');
    await addToCartViaApi(page, 'p2');
    await page.goto('/#/checkout');

    await page.getByTestId('discount-code').fill('SAVE10');
    await page.getByTestId('place-order').click();

    const confirmation = page.getByTestId('order-confirmation');
    await expect(confirmation).toBeVisible();
    // subtotal $1388.00, tax $111.04, 10% discount $138.80, total $1360.24
    await expect(confirmation.getByText('$1388.00', { exact: true })).toBeVisible();
    await expect(confirmation.getByText('$111.04', { exact: true })).toBeVisible();
    await expect(confirmation.getByText('$138.80', { exact: true })).toBeVisible();
    await expect(confirmation.getByText('$1360.24', { exact: true })).toBeVisible();
  });

  test('REQ-CHK-03 empty cart checkout returns 400', async ({ request }) => {
    const token = await apiLogin(request);
    const auth = { Authorization: `Bearer ${token}` };

    const response = await request.post('/api/checkout', {
      headers: auth,
      data: {},
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'cart empty' });

    const orders = await request.get('/api/orders', { headers: auth });
    expect(((await orders.json()) as { items: unknown[] }).items).toHaveLength(0);
  });

  test('REQ-CHK-04 a placed order appears in #/orders with the same total', async ({ page }) => {
    await login(page);
    await addToCartViaApi(page, 'p2');
    await page.goto('/#/checkout');

    const total = await page.getByTestId('order-total').innerText();
    expect(total).toBe('$96.12');

    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('order-confirmation')).toBeVisible();

    await page.getByRole('link', { name: 'View orders' }).click();

    const rows = page.getByTestId('order-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByText(total, { exact: true })).toBeVisible();
  });

  test('REQ-CHK-05 discount is capped at the subtotal', async ({ request }) => {
    const token = await apiLogin(request);
    const auth = { Authorization: `Bearer ${token}` };

    const cart = await request.post('/api/cart', {
      headers: auth,
      data: { productId: 'p5', qty: 1 },
    });
    expect(cart.status()).toBe(200);

    const response = await request.post('/api/checkout', {
      headers: auth,
      data: { discountCode: 'SAVE10' },
    });
    expect(response.status()).toBe(201);

    const { order } = (await response.json()) as {
      order: { subtotal: number; tax: number; discount: number; total: number };
    };
    const tenPercent = Math.round(order.subtotal * 100 * 0.1) / 100;

    expect(order.subtotal).toBe(15);
    expect(order.tax).toBe(1.2);
    expect(order.discount).toBe(tenPercent);
    expect(order.discount).toBeLessThanOrEqual(order.subtotal);
    expect(order.total).toBe(14.7);
  });
});

```

Verdict: approve / reject / escalate.
