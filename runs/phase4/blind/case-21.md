# case-21

Requirement: REQ-SRCH-09 - Search returns results quickly enough for users.
File under review: tests/catalog.spec.ts

## After the change
```ts
import { expect, login, test } from './fixtures';

const PRODUCT_NAMES = [
  'Aurora Laptop',
  'Trailback Backpack',
  'Lumen Desk Lamp',
  'Pebble Speaker',
  'Nomad Mug',
  'Vertex Monitor',
];

test.describe('Catalog', () => {
  test('REQ-CAT-01 product list shows all 6 products', async ({ page }) => {
    await login(page);

    const cards = page.getByTestId('product-card');
    await expect(cards).toHaveCount(6);

    for (const name of PRODUCT_NAMES) {
      await expect(cards.filter({ hasText: name })).toHaveCount(1);
    }
  });

  test('REQ-CAT-02 search "lamp" filters to one card', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.getByTestId('search-input').fill('lamp');

    const cards = page.getByTestId('product-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Lumen Desk Lamp');
  });

  test('REQ-CAT-03 search is case-insensitive ("LAPTOP" finds the laptop)', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.getByTestId('search-input').fill('LAPTOP');

    const cards = page.getByTestId('product-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Aurora Laptop');
  });

  test('REQ-CAT-05 a search with no matches shows an empty state and no error', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.getByTestId('search-input').fill('zzzz-no-such-product');

    await expect(page.getByTestId('product-card')).toHaveCount(0);
    await expect(page.getByText('No products found.')).toBeVisible();
    // The error branch renders "Could not load products: ..."; it must not be on
    // screen after a successful search that simply matched nothing.
    await expect(page.getByText(/Could not load products/)).toHaveCount(0);
  });

  test('REQ-CAT-04 unknown product id returns 404 via API', async ({ request }) => {
    const response = await request.get('/api/products/p999');

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
  });
});

```

Verdict: approve / reject / escalate.
