import {
  expect,
  test as base,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export { expect };

export const DEMO_USER = {
  email: 'demo@shop.test',
  password: 'demo1234',
  name: 'Demo User',
};

export const SECOND_USER = {
  email: 'second@shop.test',
  password: 'second1234',
  name: 'Second User',
};

/**
 * The app keeps every cart, session and order in one in-memory store. Every
 * test starts with POST /api/__reset, so two workers running in parallel would
 * keep wiping each other's state. This small cross-process lock serialises the
 * tests that share the server while still letting Playwright start workers.
 */
const LOCK_DIR = join(tmpdir(), 'agentic-qa-phase0-state.lock');
const LOCK_STALE_MS = 5 * 60_000;
const LOCK_WAIT_MS = 4 * 60_000;

async function acquireStateLock(): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_MS;

  for (;;) {
    try {
      mkdirSync(LOCK_DIR);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

      try {
        const age = Date.now() - statSync(LOCK_DIR).mtimeMs;
        if (age > LOCK_STALE_MS) {
          rmSync(LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch {
        // The owner released the lock between the two checks; retry at once.
        continue;
      }

      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for the shared app state lock at ${LOCK_DIR}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 50 + Math.round(Math.random() * 100)));
    }
  }
}

function releaseStateLock(): void {
  rmSync(LOCK_DIR, { recursive: true, force: true });
}

type Fixtures = {
  stateLock: void;
  resetStateBeforeEach: void;
};

export const test = base.extend<Fixtures>({
  stateLock: [
    async ({}, use, testInfo) => {
      // Waiting for the shared lock must not eat the whole assertion budget.
      testInfo.setTimeout(120_000);
      await acquireStateLock();
      try {
        await use();
      } finally {
        releaseStateLock();
      }
    },
    { auto: true },
  ],

  /**
   * Autouse request-based fixture: every test starts from an empty server
   * (carts, sessions, orders, product call counter) and without a seeded_bugs
   * cookie, so tests cannot inherit state or bug activation from each other.
   */
  resetStateBeforeEach: [
    async ({ request, context, stateLock }, use) => {
      void stateLock;
      await context.clearCookies({ name: 'seeded_bugs' });
      await resetState(request);
      await use();
    },
    { auto: true },
  ],
});

export async function resetState(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/__reset');
  expect(response.status(), 'POST /api/__reset should succeed').toBe(200);
}

export async function apiLogin(
  request: APIRequestContext,
  email: string = DEMO_USER.email,
  password: string = DEMO_USER.password,
): Promise<string> {
  const response = await request.post('/api/login', { data: { email, password } });
  expect(response.status(), `login as ${email} should succeed`).toBe(200);
  const body = (await response.json()) as { token?: string };
  expect(body.token, 'login response should include a token').toBeTruthy();
  return body.token as string;
}

export async function login(
  page: Page,
  email: string = DEMO_USER.email,
  password: string = DEMO_USER.password,
): Promise<void> {
  await page.goto('/#/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  // The submit handler stores the token asynchronously; wait for it instead of
  // assuming the click already finished the round trip.
  await page.waitForURL('**/#/products');
}

/** Activate seeded bugs for this browser context through the contract hook. */
export async function setBugs(page: Page, ids: string | string[]): Promise<void> {
  const value = Array.isArray(ids) ? ids.join(',') : ids;
  const response = await page.request.get(`/api/__bugs?ids=${encodeURIComponent(value)}`);
  expect(response.status(), `enabling seeded bugs (${value}) should succeed`).toBe(200);
}

export async function clearBugs(page: Page): Promise<void> {
  await page.context().clearCookies({ name: 'seeded_bugs' });
}

export function productCard(page: Page, productId: string): Locator {
  return page.locator(`[data-testid="product-card"][data-product-id="${productId}"]`);
}

export async function addToCartFromUi(
  page: Page,
  productId: string,
  productName: string,
): Promise<void> {
  await productCard(page, productId).getByTestId('add-to-cart').click();
  await expect(page.getByTestId('toast')).toHaveText(`Added ${productName}`);
}

export async function uiToken(page: Page): Promise<string> {
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('token') || ''), {
      message: 'the signed-in page should hold a token',
    })
    .toBeTruthy();
  return page.evaluate(() => localStorage.getItem('token') || '');
}

export async function addToCartViaApi(
  page: Page,
  productId: string,
  qty = 1,
): Promise<void> {
  const token = await uiToken(page);
  const response = await page.request.post('/api/cart', {
    headers: { Authorization: `Bearer ${token}` },
    data: { productId, qty },
  });
  expect(response.status(), `adding ${productId} x${qty} should succeed`).toBe(200);
}

export type SeedCartItem = { productId: string; qty?: number };

/**
 * Sign in through the API and put items in that token's cart. Returns the
 * token so the caller can check out or read the cart without signing in again.
 * The browser is not signed in by this helper; use login(page) for that.
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
