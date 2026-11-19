import { expect, login, productCard, setBugs, test, DEMO_USER, SECOND_USER } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * SEEDED_BUGS gates this file: without it every case is skipped. Each test
 * then enables only its own bug through the contract's ?bugs= cookie. Keep the
 * app server itself free of SEEDED_BUGS=all while running this spec: combined
 * bugs mask each other (BUG-15 overwrites BUG-01's total), so per-bug
 * activation is what keeps every documented symptom observable.
 */
const SEEDED = String(process.env.SEEDED_BUGS || '').trim();

function bugEnabled(id: string): boolean {
  if (!SEEDED) return false;
  if (SEEDED.toLowerCase() === 'all') return true;
  return SEEDED.split(',')
    .map((value) => value.trim())
    .includes(id);
}

function skipUnlessEnabled(id: string): void {
  test.skip(!bugEnabled(id), `${id} is not enabled; run with SEEDED_BUGS=all or SEEDED_BUGS=${id}`);
}

function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function apiToken(page: Page): Promise<string> {
  const response = await page.request.post('/api/login', {
    data: { email: DEMO_USER.email, password: DEMO_USER.password },
  });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

async function addItem(
  page: Page,
  token: string,
  productId: string,
  qty = 1,
): Promise<Record<string, unknown>> {
  const response = await page.request.post('/api/cart', {
    headers: authHeader(token),
    data: { productId, qty },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

test.describe('Seeded bugs', () => {
  test('BUG-01 total is subtotal plus two times the tax', async ({ page }) => {
    skipUnlessEnabled('BUG-01');
    await setBugs(page, 'BUG-01');
    const token = await apiToken(page);
    await addItem(page, token, 'p2');

    const response = await page.request.post('/api/checkout', {
      headers: authHeader(token),
      data: {},
    });
    expect(response.status()).toBe(201);

    const { order } = (await response.json()) as {
      order: { subtotal: number; tax: number; total: number };
    };
    expect(order.subtotal).toBe(89);
    expect(order.tax).toBe(7.12);
    expect(order.total).toBe(103.24);
    expect(order.total).toBe(Number((order.subtotal + 2 * order.tax).toFixed(2)));
  });

  test('BUG-02 empty password is accepted', async ({ page }) => {
    skipUnlessEnabled('BUG-02');
    await setBugs(page, 'BUG-02');

    const response = await page.request.post('/api/login', {
      data: { email: DEMO_USER.email, password: '' },
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { token?: string };
    expect(body.token).toBeTruthy();

    const cart = await page.request.get('/api/cart', {
      headers: authHeader(body.token as string),
    });
    expect(cart.status()).toBe(200);
  });

  test('BUG-03 negative quantity is accepted', async ({ page }) => {
    skipUnlessEnabled('BUG-03');
    await setBugs(page, 'BUG-03');
    const token = await apiToken(page);

    const response = await page.request.post('/api/cart', {
      headers: authHeader(token),
      data: { productId: 'p3', qty: -1 },
    });

    expect(response.status()).toBe(200);
    const cart = (await response.json()) as {
      items: Array<{ productId: string; qty: number }>;
      subtotal: number;
      tax: number;
      total: number;
    };
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('p3');
    expect(cart.items[0].qty).toBe(-1);
    expect(cart.subtotal).toBe(-45);
    expect(cart.tax).toBe(-3.6);
    expect(cart.total).toBe(-48.6);
  });

  test('BUG-04 the third product list call returns 500', async ({ page }) => {
    skipUnlessEnabled('BUG-04');
    await setBugs(page, 'BUG-04');

    const statuses: number[] = [];
    for (let call = 0; call < 3; call += 1) {
      const response = await page.request.get('/api/products');
      statuses.push(response.status());
    }

    expect(statuses).toEqual([200, 200, 500]);
  });

  test('BUG-05 add-to-cart button is disabled right after the click', async ({ page }) => {
    skipUnlessEnabled('BUG-05');
    await setBugs(page, 'BUG-05');
    await login(page);

    const button = productCard(page, 'p3').getByTestId('add-to-cart');
    await button.click();

    await expect(button).toBeDisabled();
    await expect(page.getByTestId('toast')).toHaveText('Added Lumen Desk Lamp');
  });

  test('BUG-06 checkout button label is "Proceed to payment"', async ({ page }) => {
    skipUnlessEnabled('BUG-06');
    await setBugs(page, 'BUG-06');
    await login(page);

    const token = await page.evaluate(() => localStorage.getItem('token') || '');
    const added = await page.request.post('/api/cart', {
      headers: authHeader(token),
      data: { productId: 'p3', qty: 1 },
    });
    expect(added.status()).toBe(200);

    await page.goto('/#/cart');
    await expect(page.getByTestId('checkout-button')).toHaveText('Proceed to payment');
  });

  test('BUG-07 SAVE10 takes a flat $10', async ({ page }) => {
    skipUnlessEnabled('BUG-07');
    await setBugs(page, 'BUG-07');
    const token = await apiToken(page);
    await addItem(page, token, 'p2');

    const response = await page.request.post('/api/checkout', {
      headers: authHeader(token),
      data: { discountCode: 'SAVE10' },
    });
    expect(response.status()).toBe(201);

    const { order } = (await response.json()) as {
      order: { subtotal: number; tax: number; discount: number; total: number };
    };
    expect(order.subtotal).toBe(89);
    expect(order.tax).toBe(7.12);
    expect(order.discount).toBe(10);
    expect(order.total).toBe(86.12);
  });

  test('BUG-08 "LAPTOP" finds nothing', async ({ page }) => {
    skipUnlessEnabled('BUG-08');
    await setBugs(page, 'BUG-08');
    await login(page);
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.getByTestId('search-input').fill('LAPTOP');

    await expect(page.getByTestId('product-card')).toHaveCount(0);
    await expect(page.getByText('No products found.')).toBeVisible();
  });

  test('BUG-09 out-of-stock p6 can be added', async ({ page }) => {
    skipUnlessEnabled('BUG-09');
    await setBugs(page, 'BUG-09');
    const token = await apiToken(page);

    const response = await page.request.post('/api/cart', {
      headers: authHeader(token),
      data: { productId: 'p6', qty: 1 },
    });

    expect(response.status()).toBe(200);
    const cart = (await response.json()) as {
      items: Array<{ productId: string; qty: number }>;
    };
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('p6');
    expect(cart.items[0].qty).toBe(1);
  });

  test('BUG-10 second user sees the demo user order in #/orders', async ({ page }) => {
    skipUnlessEnabled('BUG-10');
    await setBugs(page, 'BUG-10');
    await login(page);

    const demoToken = await page.evaluate(() => localStorage.getItem('token') || '');
    const added = await page.request.post('/api/cart', {
      headers: authHeader(demoToken),
      data: { productId: 'p3', qty: 1 },
    });
    expect(added.status()).toBe(200);

    await page.goto('/#/checkout');
    await page.getByTestId('place-order').click();

    const confirmation = page.getByTestId('order-confirmation');
    await expect(confirmation).toBeVisible();
    const confirmationText = await confirmation.innerText();
    const orderId = /ORD-\d{4}/.exec(confirmationText)?.[0];
    expect(orderId, 'confirmation should show the placed order id').toBeTruthy();

    // Only the browser session is cleared; the order must stay on the server.
    await page.evaluate(() => localStorage.removeItem('token'));
    await page.context().clearCookies();
    await setBugs(page, 'BUG-10');
    await page.reload();
    await expect(page.getByTestId('login-email')).toBeVisible();

    await login(page, SECOND_USER.email, SECOND_USER.password);
    await expect(page).toHaveURL(/#\/products$/);
    await page.goto('/#/orders');

    const rows = page.getByTestId('order-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.filter({ hasText: orderId as string })).toBeVisible();
    await expect(rows.first()).toContainText('$48.60');
  });

  test('BUG-11 qty 0 leaves the old total after removing the last item', async ({ page }) => {
    skipUnlessEnabled('BUG-11');
    await setBugs(page, 'BUG-11');
    const token = await apiToken(page);
    await addItem(page, token, 'p3');

    const before = (await (
      await page.request.get('/api/cart', { headers: authHeader(token) })
    ).json()) as { total: number };
    expect(before.total).toBe(48.6);

    const response = await page.request.patch('/api/cart/p3', {
      headers: authHeader(token),
      data: { qty: 0 },
    });
    expect(response.status()).toBe(200);

    const cart = (await response.json()) as {
      items: unknown[];
      subtotal: number;
      tax: number;
      total: number;
    };
    expect(cart.items).toHaveLength(0);
    expect(cart.subtotal).toBe(0);
    expect(cart.tax).toBe(0);
    expect(cart.total).toBe(48.6);
  });

  test('BUG-12 removing the last item leaves the old total', async ({ page }) => {
    skipUnlessEnabled('BUG-12');
    await setBugs(page, 'BUG-12');
    const token = await apiToken(page);
    await addItem(page, token, 'p3');

    const before = (await (
      await page.request.get('/api/cart', { headers: authHeader(token) })
    ).json()) as { total: number };
    expect(before.total).toBe(48.6);

    const response = await page.request.delete('/api/cart/p3', {
      headers: authHeader(token),
    });
    expect(response.status()).toBe(200);

    const cart = (await response.json()) as {
      items: unknown[];
      subtotal: number;
      tax: number;
      total: number;
    };
    expect(cart.items).toHaveLength(0);
    expect(cart.subtotal).toBe(0);
    expect(cart.tax).toBe(0);
    expect(cart.total).toBe(48.6);
  });

  test('BUG-13 empty checkout returns 201', async ({ page }) => {
    skipUnlessEnabled('BUG-13');
    await setBugs(page, 'BUG-13');
    const token = await apiToken(page);

    const response = await page.request.post('/api/checkout', {
      headers: authHeader(token),
      data: {},
    });

    expect(response.status()).toBe(201);
    const { order } = (await response.json()) as {
      order: { items: unknown[]; subtotal: number; total: number };
    };
    expect(order.items).toHaveLength(0);
    expect(order.subtotal).toBe(0);
    expect(order.total).toBe(0);
  });

  test('BUG-14 login error contains "/app/server.js"', async ({ page }) => {
    skipUnlessEnabled('BUG-14');
    await setBugs(page, 'BUG-14');
    await page.goto('/#/login');

    await page.getByTestId('login-email').fill(DEMO_USER.email);
    await page.getByTestId('login-password').fill('wrong-password');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toContainText('/app/server.js');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('BUG-15 total renders three decimals', async ({ page }) => {
    skipUnlessEnabled('BUG-15');
    await setBugs(page, 'BUG-15');
    await login(page);

    const token = await page.evaluate(() => localStorage.getItem('token') || '');
    const added = await page.request.post('/api/cart', {
      headers: authHeader(token),
      data: { productId: 'p3', qty: 1 },
    });
    expect(added.status()).toBe(200);

    await page.goto('/#/cart');
    await expect(page.getByTestId('cart-total')).toHaveText('$48.600');
    await expect(page.getByTestId('cart-total')).toHaveText(/^\$\d+\.\d{3}$/);
  });
});
