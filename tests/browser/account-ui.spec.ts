import { expect, test } from '@playwright/test';

import { primeSignedInSession, primeSignedInSessionForReload } from './helpers/auth';

test.describe('account display-name editing', () => {
  test('saved display name survives a browser reload on /account', async ({ page }) => {
    await page.route('**/auth/v1/user**', async (route) => {
      const requestBody = route.request().postDataJSON();
      const nextDisplayName = requestBody?.data?.display_name ?? 'Unknown';
      const storedSession = await page.evaluate(() => window.localStorage.getItem('sb-example-auth-token'));

      if (!storedSession) {
        throw new Error('Expected a seeded Supabase session before saving the display name.');
      }

      const session = JSON.parse(storedSession);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            ...session.user,
            updated_at: '2026-05-29T00:00:00.000Z',
            user_metadata: {
              ...session.user.user_metadata,
              display_name: nextDisplayName,
            },
          },
        }),
      });
    });

    await primeSignedInSessionForReload(page, '/account');

    const displayNameInput = page.getByPlaceholder('Add your display name');
    await expect(displayNameInput).toHaveValue('Playwright User');
    await expect(page.getByRole('button', { name: 'Restore purchases' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await displayNameInput.fill('Persisted Name');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Display name saved.')).toBeVisible();
    await expect(displayNameInput).toHaveValue('Persisted Name');

    await page.reload();

    await expect(page).toHaveURL(/\/account$/);
    await expect(displayNameInput).toHaveValue('Persisted Name');
  });

  test('save failures surface a readable inline error on /account', async ({ page }) => {
    await page.route('**/auth/v1/user**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, msg: 'server blew up' }),
      });
    });

    await primeSignedInSessionForReload(page, '/account');

    await page.getByPlaceholder('Add your display name').fill('Broken Name');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('server blew up')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore purchases' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('account-save auth route preserves returnTo and lands back on /account after sign-in', async ({ page }) => {
    await page.goto('/auth?reason=account-save&returnTo=%2Faccount');

    await expect(page).toHaveURL(/\/auth\?/);
    await expect(page.getByText('Sign in to save account changes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByText('After sign-in, you’ll land back on Account.')).toBeVisible();

    const returnTo = readReturnToFromUrl(page.url());
    await primeSignedInSession(page, returnTo);

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByPlaceholder('Add your display name')).toBeVisible();
  });
});

function readReturnToFromUrl(url: string) {
  const value = new URL(url).searchParams.get('returnTo');

  if (!value) {
    throw new Error(`Missing returnTo query param in ${url}`);
  }

  return value;
}
