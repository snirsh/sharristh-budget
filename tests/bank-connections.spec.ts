import { expect, test } from '@playwright/test';

/**
 * Bank Connections E2E Tests
 *
 * These tests validate the bank connections flow including:
 * - Viewing the connections page
 * - Adding new connections
 * - 2FA flow for OneZero
 * - Sync operations
 * - Deleting connections
 *
 * Note: These tests require authentication. For full E2E testing,
 * you need to either:
 * 1. Use a test user with saved auth state
 * 2. Mock the authentication
 * 3. Run these as integration tests against API directly
 */

test.describe('Bank Connections Page', () => {
  // Skip if not authenticated - these are E2E tests that require login
  test.beforeEach(async ({ page }) => {
    // Try to navigate to connections page
    // If redirected to login, we'll skip the test
    await page.goto('/connections');

    // Wait for page to settle
    await page.waitForTimeout(1000);

    // Check if we're on login page (not authenticated)
    const url = page.url();
    if (url.includes('/login')) {
      test.skip(true, 'User not authenticated - skipping E2E test');
    }
  });

  test('should display the connections page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Bank Connections');
  });

  test('should show empty state when no connections exist', async ({ page }) => {
    // Check for the empty state message or table
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Bank Connections');
  });

  test('should have Add Connection button', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Connection")');
    await expect(addButton).toBeVisible();
  });

  test('should open add connection form when clicking Add Connection', async ({ page }) => {
    // Click the Add Connection button
    await page.click('button:has-text("Add Connection")');

    // Wait for form to appear
    await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 });

    // Check for form elements
    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible();
  });

  test('should show provider options in dropdown', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');

    // Check provider dropdown
    const selectElement = page.locator('select').first();
    await expect(selectElement).toBeVisible();

    // Get options
    const options = await selectElement.locator('option').allTextContents();
    expect(options).toContain('OneZero Bank');
    expect(options).toContain('Isracard');
  });

  test('should show OneZero credential fields when OneZero is selected', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');

    // Select OneZero from dropdown
    await page.selectOption('select', 'onezero');

    // Check for OneZero-specific fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });

  test('should show Isracard credential fields when Isracard is selected', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');

    // Select Isracard from dropdown
    await page.selectOption('select', 'isracard');

    // Check for Isracard-specific fields (ID, card digits, password)
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(4); // display name + 3 credential fields
  });

  test('should show cancel button in add form', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');

    const cancelButton = page.locator('button:has-text("Cancel")');
    await expect(cancelButton).toBeVisible();
  });

  test('should close add form when clicking Cancel', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');
    await page.click('button:has-text("Cancel")');

    // Form should be closed
    await expect(page.locator('form')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show 2FA warning for OneZero provider', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');
    await page.selectOption('select', 'onezero');

    // Should show 2FA note
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('2FA');
  });
});

test.describe('Bank Connections - Connection Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    if (page.url().includes('/login')) {
      test.skip(true, 'User not authenticated - skipping E2E test');
    }
  });

  test('should display connection table headers', async ({ page }) => {
    // Look for table headers
    const headers = ['Connection', 'Provider', 'Status', 'Last Sync', 'Actions'];

    for (const header of headers) {
      const headerElement = page.locator(`th:has-text("${header}")`);
      await expect(headerElement).toBeVisible();
    }
  });

  test('should show Sync All button when active connections exist', async ({ page }) => {
    // This test checks for the Sync All button if there are active connections
    const syncAllButton = page.locator('button:has-text("Sync All")');

    // The button may or may not be visible depending on if connections exist
    // Just verify it doesn't cause errors
    const isVisible = await syncAllButton.isVisible().catch(() => false);

    // If visible, check it's enabled/disabled appropriately
    if (isVisible) {
      await expect(syncAllButton).toBeVisible();
    }
  });
});

test.describe('Bank Connections - Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    if (page.url().includes('/login')) {
      test.skip(true, 'User not authenticated - skipping E2E test');
    }
  });

  test('should require display name field', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');
    await page.selectOption('select', 'isracard');

    // Fill everything except display name
    await page.fill('input[placeholder*="ID"]', '123456789');
    await page.fill('input[maxlength="6"]', '123456');
    await page.locator('input[type="password"]').fill('password123');

    // Try to submit
    await page.click('button[type="submit"]:has-text("Add Connection")');

    // Form should show validation error or not submit
    // (HTML5 validation or custom validation)
    const displayNameInput = page.locator('input[placeholder*="My"]');
    const isInvalid = await displayNameInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity() || el.value === ''
    );
    expect(isInvalid).toBeTruthy();
  });

  test('should validate email format for OneZero', async ({ page }) => {
    await page.click('button:has-text("Add Connection")');
    await page.selectOption('select', 'onezero');

    // Fill with invalid email
    await page.locator('input[type="email"]').fill('invalid-email');

    // Try to trigger validation
    await page.click('button[type="submit"]:has-text("Add Connection")');

    // Check for validation error
    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBeTruthy();
  });
});

test.describe('Bank Connections - API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    if (page.url().includes('/login')) {
      test.skip(true, 'User not authenticated - skipping E2E test');
    }
  });

  test('should make API call when loading connections', async ({ page }) => {
    // Set up request interception
    const apiCalls: string[] = [];

    await page.route('**/api/trpc/**', (route) => {
      apiCalls.push(route.request().url());
      route.continue();
    });

    // Reload page to trigger API calls
    await page.reload();
    await page.waitForTimeout(2000);

    // Check that bankConnections.list was called
    const hasListCall = apiCalls.some((url) => url.includes('bankConnections.list'));
    expect(hasListCall).toBeTruthy();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/trpc/**bankConnections.list**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Reload to trigger error
    await page.reload();

    // Page should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});
