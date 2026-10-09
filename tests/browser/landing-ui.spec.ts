import { expect, test } from '@playwright/test';

// Copy the auth screen uses for its only control and its titles. None of it may
// appear on the public landing page.
const AUTH_CONTROL_PATTERN = /continue with google|sign in|sign up|log in/i;

test.describe('public landing page', () => {
  test('root route states coming soon and explains the product', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Coming soon').first()).toBeVisible();
    await expect(page.getByRole('heading')).toHaveText(
      'A memory graph for the stories you tell out loud.',
    );
    await expect(
      page.getByText('Apple Pie records your voice memories so you can revisit them later.'),
    ).toBeVisible();
    await expect(page.getByText('Record', { exact: true })).toBeVisible();
    await expect(page.getByText('Generate', { exact: true })).toBeVisible();
  });

  test('root route exposes no sign-in control and no app chrome', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Coming soon').first()).toBeVisible();

    // Nothing on the page is pressable, so there is no sign-in affordance to
    // find and nothing that could navigate into the authenticated app.
    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: AUTH_CONTROL_PATTERN })).toHaveCount(0);
    await expect(page.getByRole('link', { name: AUTH_CONTROL_PATTERN })).toHaveCount(0);
    await expect(page.getByText('Continue with Google')).toHaveCount(0);

    // Nor any of the app chrome that the universe and record routes render.
    await expect(page.getByLabel('Search memories')).toHaveCount(0);
    await expect(page.getByLabel('Start recording')).toHaveCount(0);
  });
});
