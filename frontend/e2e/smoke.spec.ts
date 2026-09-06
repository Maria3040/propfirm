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
