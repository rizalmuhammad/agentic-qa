import { expect, login, seedCart, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Seed the cart through the API and place one order for that token. */
async function placeOrder(
  request: APIRequestContext,
  token: string,
  productId: string,
): Promise<string> {
  const added = await request.post('/api/cart', {
    headers: auth(token),
    data: { productId, qty: 1 },
  });
  expect(added.status(), `adding ${productId} should succeed`).toBe(200);

  const response = await request.post('/api/checkout', {
    headers: auth(token),
    data: {},
  });
  expect(response.status(), 'checkout should succeed').toBe(201);

  const { order } = (await response.json()) as { order: { id: string } };
  return order.id;
}

async function ordersPage(page: Page, token: string): Promise<void> {
  // The UI reads the token from localStorage; the API token has to be written
  // there for the order list to belong to the same user.
  await page.addInitScript((value) => {
    window.localStorage.setItem('token', value);
  }, token);
  await page.goto('/#/orders');
}

test.describe('Orders', () => {
  test('REQ-ORD-01 order history lists the newest order first', async ({ page, request }) => {
    // First order: the cart is seeded through the API helper, then checked out.
    const token = await seedCart(request, [{ productId: 'p3' }]);
    const first = await request.post('/api/checkout', {
      headers: auth(token),
      data: {},
    });
    expect(first.status()).toBe(201);
    const olderOrderId = ((await first.json()) as { order: { id: string } }).order.id;

    // Second order, placed after it: this one must come first in the history.
    const newerOrderId = await placeOrder(request, token, 'p4');

    await ordersPage(page, token);

    const rows = page.getByTestId('order-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(newerOrderId);
    await expect(rows.nth(1)).toContainText(olderOrderId);
  });
});
