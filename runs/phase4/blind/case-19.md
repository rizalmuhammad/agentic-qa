# case-19

Requirement: REQ-AUTH-04 - Cart and order API calls without a valid token return 401.
File under review: tests/auth.spec.ts

## After the change
```ts
import { DEMO_USER, expect, login, test } from './fixtures';

// reviewed against REQ-AUTH-04
test.describe('Authentication', () => {
  test('REQ-AUTH-01 valid login redirects to products', async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL(/#\/products$/);
    await expect(page.getByTestId('search-input')).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(6);
  });

  test('REQ-AUTH-02 wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByTestId('login-email').fill(DEMO_USER.email);
    await page.getByTestId('login-password').fill('not-the-password');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toHaveText('invalid credentials');
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('REQ-AUTH-03 empty password is rejected', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByTestId('login-email').fill(DEMO_USER.email);
    await page.getByTestId('login-password').fill('');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toHaveText('invalid credentials');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('REQ-AUTH-04 protected cart route without a token returns 401', async ({ request }) => {
    const response = await request.get('/api/cart');

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });
});

```

Verdict: approve / reject / escalate.
