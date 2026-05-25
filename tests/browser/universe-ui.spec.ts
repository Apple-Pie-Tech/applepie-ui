import { expect, Page, Route, test } from '@playwright/test';

const LIVE_UNIVERSE_RESPONSE = {
  edges: [
    { source_id: 'point-mom-1', target_id: 'point-lisbon-1' },
    { source_id: 'point-mom-1', target_id: 'point-joy-1' },
    { source_id: 'point-lisbon-1', target_id: 'point-sam-1' },
  ],
  points: [
    { id: 'point-joy-1', is_central: true, is_synthetic: false, label: 'Joy' },
    { id: 'point-lisbon-1', is_central: true, is_synthetic: false, label: 'Lisbon' },
    { id: 'point-mom-1', is_central: true, is_synthetic: false, label: 'Mom' },
    { id: 'point-mom-2', is_central: false, is_synthetic: false, label: 'Mom' },
    { id: 'point-sam-1', is_central: true, is_synthetic: false, label: 'Sam' },
  ],
} as const;

const PENDING_PODCAST = {
  id: 'podcast-mom-001',
  label: 'Mom',
  status: 'pending',
  audio_url: null,
  cover_url: null,
  error: null,
  script: null,
} as const;

const RUNNING_PODCAST = {
  ...PENDING_PODCAST,
  status: 'running',
} as const;

const COMPLETED_PODCAST = {
  ...PENDING_PODCAST,
  status: 'completed',
  audio_url: 'https://example.com/mom.mp3',
} as const;

test.describe('non-microphone universe verification', () => {
  test('shows mocked live universe state and podcast create/status progression', async ({ page }) => {
    const provisionApi = await mockProvisionApi(page, {
      detailSequence: [RUNNING_PODCAST, RUNNING_PODCAST, COMPLETED_PODCAST],
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');

    await expect(page.getByText('Loading live universe…')).toBeVisible();
    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('Mocked outage. Showing preview map.')).toHaveCount(0);
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
    await clickOverlayTarget(page, 'Mom');

    await expect(page.getByText('Generate something')).toBeVisible();
    await page.getByText('Generate something').click();

    await expect(page.getByText('Podcast episode')).toBeVisible();
    await clickOverlayTarget(page, 'Podcast episode');

    await expect(page.getByText('Submitting your podcast job…')).toBeVisible();
    await expect(page.getByText('Podcast ready to revisit')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    expect(provisionApi.createCalls).toBe(1);
    expect(provisionApi.detailCalls).toBeGreaterThan(0);
  });

  test('falls back to the preview universe when /universe fails', async ({ page }) => {
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeError: { detail: 'Mocked outage' },
    });

    await page.goto('/');

    await expect(page.getByText('Loading live universe…')).toBeVisible();
    await expect(page.getByText('Mocked outage. Showing preview map.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Mom', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('76 stories')).toBeVisible();
  });
});

async function mockProvisionApi(
  page: Page,
  options: {
    detailSequence?: readonly object[];
    initialPodcasts: readonly object[];
    universeError?: { detail: string };
    universeResponse?: object;
  },
) {
  const callCounts = {
    createCalls: 0,
    detailCalls: 0,
  };
  let detailIndex = 0;

  await page.route('**/universe', async (route) => {
    await pause(250);

    if (options.universeError) {
      await fulfillJson(route, 503, options.universeError);
      return;
    }

    await fulfillJson(route, 200, options.universeResponse ?? LIVE_UNIVERSE_RESPONSE);
  });

  await page.route('**/podcasts', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await fulfillJson(route, 200, options.initialPodcasts);
      return;
    }

    if (method === 'POST') {
      callCounts.createCalls += 1;
      await fulfillJson(route, 200, PENDING_PODCAST);
      return;
    }

    await route.fallback();
  });

  await page.route('**/podcasts/*', async (route) => {
    callCounts.detailCalls += 1;
    await pause(900);
    const next = options.detailSequence?.[Math.min(detailIndex, (options.detailSequence?.length ?? 1) - 1)] ?? PENDING_PODCAST;
    detailIndex += 1;
    await fulfillJson(route, 200, next);
  });

  return callCounts;
}

async function clickOverlayTarget(page: Page, label: string) {
  const labelMatch = page.getByText(label, { exact: true }).first();
  await expect(labelMatch).toBeVisible();

  const box = await labelMatch.boundingBox();
  expect(box, `Expected a bounding box for ${label}`).not.toBeNull();

  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

async function fulfillJson(route: Route, status: number, body: object) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  });
}

function pause(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
