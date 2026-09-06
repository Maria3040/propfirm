import { expect, test } from '@playwright/test';

test.describe('PropFirm smoke (e2e)', () => {
  test('home catalog renders journey headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/journey|challenge|Buckle/i).first()).toBeVisible();
  });

  test('login page shows FundingPips-style sign-in copy', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('trader can sign in and open security login history', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('trader@propfirm.local');
    await page.getByLabel(/^password$/i).fill('Trader1!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/accounts|dashboard/);

    await page.goto('/settings/security');
    await expect(page.getByRole('heading', { name: /login history/i })).toBeVisible();
    await expect(page.getByText(/vpn|vps|residential|local|unknown|sign-ins/i).first()).toBeVisible();
  });

  test('mobile menu opens from hamburger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('trader@propfirm.local');
    await page.getByLabel(/^password$/i).fill('Trader1!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/accounts|dashboard/);

    await page.getByLabel('Open menu').click();
    await expect(page.getByRole('dialog', { name: /main navigation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Affiliate' })).toBeVisible();
  });
});

test.describe('API-backed UI flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('trader@propfirm.local');
    await page.getByLabel(/^password$/i).fill('Trader1!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/accounts|dashboard/);
  });

  test('payouts request page loads eligible equity without crash', async ({ page }) => {
    await page.goto('/payouts/request');
    await expect(page.getByRole('heading', { name: /request a reward/i })).toBeVisible();
    const empty = page.getByRole('heading', { name: /no eligible accounts/i });
    const formHint = page.getByText(/available balance/i);
    await expect(empty.or(formHint)).toBeVisible({ timeout: 15000 });
    // Must not show Next runtime overlay for toLocaleString
    await expect(page.getByText(/Cannot read properties of undefined/i)).toHaveCount(0);
  });

  test('checkout basket coupon apply updates summary', async ({ page, request }) => {
    const products = await request.get('http://127.0.0.1:6080/api/catalog/products');
    expect(products.ok()).toBeTruthy();
    const list = await products.json();
    const productId = list[0].id as string;

    await page.goto(`/checkout/${productId}`);
    // Configure minimal path into basket checkout if needed
    const continueBtn = page.getByRole('button', { name: /continue to checkout|continue|add to basket/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click().catch(() => undefined);
    }

    // Force basket-checkout hash after ensuring basket has the product via localStorage when UI path varies
    await page.evaluate((pid) => {
      const key = 'propfirm_basket';
      const payload = {
        currency: 'USD',
        items: [
          {
            key: `${pid}-mt5-0`,
            productId: pid,
            title: 'Test Challenge',
            platform: 'mt5',
            platformShort: 'MT5',
            accountSize: 5000,
            unitPrice: 100,
            swapFree: false,
            qty: 1,
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify(payload));
    }, productId);
    await page.goto(`/checkout/${productId}#basket-checkout`);
    await page.reload();

    await expect(page.locator('#basket-checkout')).toBeVisible({ timeout: 15000 });
    await page.locator('#cart-coupon').fill('WELCOME10');
    await page.getByRole('button', { name: /^apply$/i }).click();
    await expect(page.getByText(/coupon applied/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/discount \(welcome10\)/i)).toBeVisible();
  });

  test('dashboard and challenges hit authenticated APIs', async ({ page }) => {
    const me = page.waitForResponse((r) => r.url().includes('/api/users/me') && r.status() === 200);
    await page.goto('/dashboard');
    await me;
    await expect(page.locator('body')).toBeVisible();
  });
});
