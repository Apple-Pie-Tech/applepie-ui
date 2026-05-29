import type { Page } from '@playwright/test';

export async function primeSignedInSession(page: Page, returnTo: string, options?: { entitled?: boolean }) {
  await page.addInitScript(({ entitlements, session }) => {
    window.localStorage.setItem('applepie.test.activeEntitlements', JSON.stringify(entitlements));
    window.localStorage.setItem('sb-example-auth-token', JSON.stringify(session));
  }, {
    entitlements: options?.entitled ? ['podcast_generation'] : [],
    session: buildSupabaseSession(),
  });

  await page.goto(returnTo);
}

export async function primeSignedInSessionForReload(
  page: Page,
  returnTo: string,
  options?: { entitled?: boolean },
) {
  await page.goto(returnTo);
  await page.evaluate(
    ({ entitlements, session }) => {
      window.localStorage.setItem('applepie.test.activeEntitlements', JSON.stringify(entitlements));
      window.localStorage.setItem('sb-example-auth-token', JSON.stringify(session));
    },
    {
      entitlements: options?.entitled ? ['podcast_generation'] : [],
      session: buildSupabaseSession(),
    },
  );

  await page.reload();
}

function buildSupabaseSession() {
  const user = {
    app_metadata: { provider: 'google', providers: ['google'] },
    aud: 'authenticated',
    confirmation_sent_at: '2026-05-28T00:00:00.000Z',
    confirmed_at: '2026-05-28T00:00:00.000Z',
    created_at: '2026-05-28T00:00:00.000Z',
    email: 'user@example.com',
    id: 'user-123',
    identities: [],
    phone: '',
    role: 'authenticated',
    updated_at: '2026-05-28T00:00:00.000Z',
    user_metadata: {
      avatar_url: 'https://example.com/avatar.png',
      email: 'user@example.com',
      full_name: 'Playwright User',
      name: 'Playwright User',
    },
  };

  return {
    access_token: 'access-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    user,
  };
}
