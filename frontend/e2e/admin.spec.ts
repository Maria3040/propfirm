import { expect, test } from '@playwright/test';

test.describe('Admin panel e2e', () => {
  test('admin can sign in and use paginated traders + payout comment UI', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('admin@propfirm.local');
    await page.getByLabel(/^password$/i).fill('Admin1!');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
    await expect(page.getByText('PropFirm Control')).toBeVisible();
    await expect(page.getByRole('heading', { name: /admin panel/i })).toBeVisible();

    await page.getByRole('tab', { name: /traders/i }).click();
    await expect(page.getByRole('heading', { name: /^traders$/i })).toBeVisible();
    await expect(page.getByText(/Page \d+ of \d+/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/trader@propfirm\.local|admin@propfirm\.local/i).first()).toBeVisible();

    await page.getByRole('tab', { name: /payouts/i }).click();
    await expect(page.getByRole('heading', { name: /payout queue/i })).toBeVisible();
    const comment = page.getByRole('button', { name: /^comment$/i }).first();
    if (await comment.isVisible().catch(() => false)) {
      await comment.click();
      await expect(page.getByRole('dialog', { name: /email trader/i })).toBeVisible();
      await page.getByLabel(/^message$/i).fill('E2E comment about your payout.');
      await page.getByRole('button', { name: /send email/i }).click();
      await expect(page.getByText(/email queued/i)).toBeVisible({ timeout: 15000 });
    }

    await page.getByRole('tab', { name: /catalog/i }).click();
    await expect(page.getByRole('heading', { name: /catalog products/i })).toBeVisible();
  });

  test('trader is redirected away from admin', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('trader@propfirm.local');
    await page.getByLabel(/^password$/i).fill('Trader1!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/accounts|dashboard/);

    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
