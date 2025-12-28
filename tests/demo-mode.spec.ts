import { test, expect } from '@playwright/test';

test.describe('Demo Mode E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  const pages = [
    { path: '/', name: 'Dashboard' },
    { path: '/transactions', name: 'Transactions' },
    { path: '/categories', name: 'Categories' },
    { path: '/recurring', name: 'Recurring' },
    { path: '/budget', name: 'Budget' },
    { path: '/rules', name: 'Rules' },
    { path: '/connections', name: 'Connections' },
  ];

  for (const page of pages) {
    test(`should load ${page.name} page in demo mode`, async ({ page: playwright }) => {
      await playwright.goto(page.path);

      // Should not redirect to login
      await expect(playwright).not.toHaveURL(/\/login/);

      // Page should load (check main content h1, not sidebar)
      await expect(playwright.locator('main h1')).toContainText(page.name);

      // Should show demo household name in sidebar (if not on mobile)
      const viewport = playwright.viewportSize();
      if (viewport && viewport.width >= 1024) {
        await expect(playwright.locator('aside')).toBeVisible();
      }
    });
  }

  test('should show demo data in transactions page', async ({ page }) => {
    await page.goto('/transactions');

    // Wait for transactions to load
    await page.waitForLoadState('networkidle');

    // Should show Hebrew transaction descriptions
    await expect(page.locator('text=שופרסל')).toBeVisible({ timeout: 10000 }).catch(() => {
      // Transaction might be in the table
      return expect(page.locator('table')).toContainText('שופרסל');
    });
  });

  test('should show demo categories', async ({ page }) => {
    await page.goto('/categories');

    // Wait for categories to load
    await page.waitForLoadState('networkidle');

    // Should show bilingual category names (English (עברית))
    const categoryTexts = ['Salary (משכורת)', 'Rent (שכר דירה)', 'Groceries (מכולת)'];
    for (const text of categoryTexts) {
      await expect(page.locator(`text=${text}`)).toBeVisible({ timeout: 10000 }).catch(() => {
        return expect(page.getByText(text)).toBeVisible();
      });
    }
  });

  test('should show demo recurring transactions', async ({ page }) => {
    await page.goto('/recurring');

    // Wait for recurring transactions to load
    await page.waitForLoadState('networkidle');

    // Should show recurring templates (check for template names or categories)
    // Look for the recurring template section with Hebrew names
    const hasRecurringData = await page.locator('table, .card').count() > 0;
    expect(hasRecurringData).toBe(true);

    // Verify at least one Hebrew recurring transaction name is visible
    const hasHebrewTemplate = await page.getByText('משכורת').first().isVisible({ timeout: 10000 });
    expect(hasHebrewTemplate).toBe(true);
  });
});
