import { expect, Page, Route, TestInfo, test } from '@playwright/test';

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

const DESKTOP_VIEWPORT = { height: 900, label: 'desktop', width: 1280 } as const;
const SHORT_MOBILE_VIEWPORT = { height: 380, label: 'short-mobile', width: 390 } as const;

const NO_BROWSER_DIAGNOSTICS = 'No browser console/runtime errors captured.';
const FAILED_RESOURCE_PATTERN = /\[console\.error\] Failed to load resource:/i;
const PODCAST_COLLECTION_REQUEST_PATTERN = /\[requestfailed\] GET .*\/podcasts\b/i;
const PODCAST_DETAIL_REQUEST_PATTERN = /\[requestfailed\] GET .*\/podcasts\/[^\s]+/i;
const UNIVERSE_REQUEST_PATTERN = /\[requestfailed\] GET .*\/universe\b/i;
const INGEST_REQUEST_PATTERN = /\[requestfailed\] POST .*\/ingest\b/i;
const OUTAGE_503_PATTERN = /\[console\.error\] Failed to load resource: the server responded with a status of 503/i;
const UNMATCHED_404_PATTERN = /\[console\.error\] Failed to load resource: the server responded with a status of 404/i;

type MockRouteStep =
  | { abort: 'failed' }
  | {
      body: object;
      status: number;
    };

type MockSupabaseAuthHandle = {
  otpCalls: number;
};

test.describe('root shell static-web safety', () => {
  test('hydration / route stays safe for a direct dark-mode load', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('tab', { name: 'Universe' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Record' })).toBeVisible();
    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('hydration /record route stays safe on direct load without eager recording errors', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');

    await expect(page).toHaveURL(/\/record$/);
    await expect(page.getByRole('tab', { name: 'Universe' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Record' })).toBeVisible();
    await expect(page.getByLabel('Start recording')).toBeVisible();
    await expect(page.getByText('Recording unavailable')).toHaveCount(0);
    await expect(page.getByText('Microphone blocked')).toHaveCount(0);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('tab shell keeps navigation usable across universe and record routes', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');

    const universeTab = page.getByRole('tab', { name: 'Universe' });
    const recordTab = page.getByRole('tab', { name: 'Record' });

    await expect(universeTab).toBeVisible();
    await expect(recordTab).toBeVisible();
    await recordTab.click();

    await expect(page).toHaveURL(/\/record$/);
    await expect(page.getByLabel('Start recording')).toBeVisible();

    await universeTab.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });
});

test.describe('browser navigation parity', () => {
  test('route parity / and /record direct loads keep the selected tab and route UI aligned', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');
    await expectUniverseRoute(page);

    await page.goto('/record');
    await expectRecordRoute(page);

    await page.getByRole('tab', { name: 'Universe' }).click();
    await expectUniverseRoute(page);

    await page.getByRole('tab', { name: 'Record' }).click();
    await expectRecordRoute(page);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('history parity browser back and forward keep / and /record in sync with the shared shell', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');
    await expectUniverseRoute(page);

    await page.getByRole('tab', { name: 'Record' }).click();
    await expectRecordRoute(page);

    await page.goBack();
    await expectUniverseRoute(page);

    await page.goForward();
    await expectRecordRoute(page);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('refresh parity reloading either route preserves the URL and route-specific shell state', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');
    await expectRecordRoute(page);

    await page.reload();
    await expectRecordRoute(page);

    await page.getByRole('tab', { name: 'Universe' }).click();
    await expectUniverseRoute(page);

    await page.reload();
    await expectUniverseRoute(page);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });
});

test.describe('non-microphone universe verification', () => {
  test('web parity baseline / route shows mocked live universe state and podcast create/status progression', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await primeSignedInSession(page, '/', { entitled: true });
    const provisionApi = await mockProvisionApi(page, {
      detailSequence: [RUNNING_PODCAST, RUNNING_PODCAST, COMPLETED_PODCAST],
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('Mocked outage. Showing preview map.')).toHaveCount(0);
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
    await page.getByRole('button', { name: 'Open topic Mom from search' }).click();

    await expect(page.getByText('Generate something')).toBeVisible();
    await page.getByText('Generate something').click();

    await expect(page.getByText('Podcast episode')).toBeVisible();
    await clickGenerationAction(page, 'Podcast episode');

    await expect(page.getByText('Submitting your podcast job…')).toBeVisible();
    await expect(page.getByText('Podcast ready to revisit')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    expect(provisionApi.createCalls).toBe(1);
    expect(provisionApi.detailCalls).toBeGreaterThan(0);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('provision outage / route shows the preview universe when live /universe data fails', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeError: { detail: 'Mocked outage' },
    });

    await page.goto('/');

    await expect(page.getByText('Loading live universe…')).toBeVisible();
    await expect(page.getByText('Mocked outage. Showing preview map.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Mom', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('76 stories')).toBeVisible();

    await finalizeDiagnostics({
      allowedDiagnostics: [OUTAGE_503_PATTERN],
      requiredDiagnostics: [OUTAGE_503_PATTERN],
    });
  });

  test('provision network / route shows explicit browser-safe fallback and keeps navigation usable', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);

    await page.route('**/universe', async (route) => {
      await pause(250);
      await route.abort('failed');
    });
    await page.route('**/podcasts', async (route) => {
      await pause(250);
      await route.abort('failed');
    });

    await page.goto('/');

    await expect(page.getByText('Loading live universe…')).toBeVisible();
    await expect(page.getByText(/Provision API is unreachable from this browser\..*Showing preview map\./)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(/Provision API is unreachable from this browser\..*Existing podcast jobs will not restore until refresh\./),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Record' }).click();
    await expect(page).toHaveURL(/\/record$/);
    await expect(page.getByLabel('Start recording')).toBeVisible();

    await finalizeDiagnostics({
      allowedDiagnostics: [FAILED_RESOURCE_PATTERN, PODCAST_COLLECTION_REQUEST_PATTERN, UNIVERSE_REQUEST_PATTERN],
      requiredDiagnostics: [PODCAST_COLLECTION_REQUEST_PATTERN, UNIVERSE_REQUEST_PATTERN],
    });
  });

  test('web parity fallback /universe route shows the unmatched-route state', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);

    await page.goto('/universe');

    await expect(page).toHaveURL(/\/universe$/);
    await expect(page.locator('body')).toContainText(/Unmatched Route|Page could not be found/i);
    await expect(page.getByText('Tap a glow to enter a topic')).toHaveCount(0);

    await finalizeDiagnostics({
      allowedDiagnostics: [UNMATCHED_404_PATTERN],
      requiredDiagnostics: [UNMATCHED_404_PATTERN],
    });
  });
});

test.describe('universe interaction parity', () => {
  test('topic parity / search results and topic labels stay browser-safe on web', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');

    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
    await page.getByRole('button', { name: 'Open topic Mom from search' }).click();
    await expect(page.getByText('Generate something')).toBeVisible();

    await page.getByLabel('Close details').click();
    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Lis');
    await page.getByRole('button', { name: 'Open topic Lisbon from search' }).click();

    await expect(page.getByText('Generate something')).toBeVisible();
    await expect(page.getByLabel('Close details')).toBeVisible();

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('generation parity / podcast flow reaches ready state from the web action menu', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await primeSignedInSession(page, '/', { entitled: true });
    const provisionApi = await mockProvisionApi(page, {
      detailSequence: [RUNNING_PODCAST, COMPLETED_PODCAST],
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
    await page.getByRole('button', { name: 'Open topic Mom from search' }).click();

    await page.getByText('Generate something').click();
    await clickGenerationAction(page, 'Podcast episode');

    await expect(page.getByText('Submitting your podcast job…')).toBeVisible();
    await expect(page.getByText('Podcast ready to revisit')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    expect(provisionApi.createCalls).toBe(1);
    expect(provisionApi.detailCalls).toBeGreaterThan(0);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('generation parity / podcast refresh failures stay explicit and recover on web', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await primeSignedInSession(page, '/', { entitled: true });
    await mockProvisionApi(page, {
      detailSequence: [{ abort: 'failed' }, COMPLETED_PODCAST],
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
    await page.getByRole('button', { name: 'Open topic Mom from search' }).click();

    await page.getByText('Generate something').click();
    await clickGenerationAction(page, 'Podcast episode');

    await expect(page.getByText(/Provision API is unreachable from this browser\./)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Podcast ready to revisit')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();

    await finalizeDiagnostics({
      allowedDiagnostics: [FAILED_RESOURCE_PATTERN, PODCAST_DETAIL_REQUEST_PATTERN],
      requiredDiagnostics: [PODCAST_DETAIL_REQUEST_PATTERN],
    });
  });
});

test.describe('universe layout viewport parity', () => {
  test('universe layout / keeps the topic sheet composed across desktop and mobile browser viewports', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    for (const viewport of [DESKTOP_VIEWPORT, SHORT_MOBILE_VIEWPORT]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
      await page.getByLabel('Search memories').click();
      await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
      await page.getByRole('button', { name: 'Open topic Mom from search' }).click();

      const generateButton = page.getByText('Generate something');
      await expect(generateButton).toBeVisible();

      const generateBox = await generateButton.boundingBox();
      const recordTabBox = await page.getByRole('tab', { name: 'Record' }).boundingBox();
      expect(generateBox, `Expected generate button box for ${viewport.label}`).not.toBeNull();
      expect(recordTabBox, `Expected record tab box for ${viewport.label}`).not.toBeNull();
      expect(generateBox!.y + generateBox!.height).toBeLessThan(recordTabBox!.y - 12);

      if (viewport.width >= 1024) {
        const closeBox = await page.getByLabel('Close details').boundingBox();
        expect(closeBox, 'Expected close-details button box on desktop').not.toBeNull();
        expect(viewport.width - (closeBox!.x + closeBox!.width)).toBeGreaterThan(120);
      }
    }

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('universe layout /record keeps the shared recording node clear of the floating dock across browser viewports', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    for (const viewport of [DESKTOP_VIEWPORT, SHORT_MOBILE_VIEWPORT]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const universeResponse = page.waitForResponse(
        (response) => response.request().method() === 'GET' && /\/universe(?:\?|$)/.test(response.url()),
      );
      await page.goto('/record');

      const startRecording = page.getByLabel('Start recording');
      await expect(startRecording).toBeVisible();
      await universeResponse;

      const startBox = await startRecording.boundingBox();
      const recordTabBox = await page.getByRole('tab', { name: 'Record' }).boundingBox();
      expect(startBox, `Expected start-recording box for ${viewport.label}`).not.toBeNull();
      expect(recordTabBox, `Expected record tab box for ${viewport.label}`).not.toBeNull();
      expect(startBox!.x).toBeGreaterThanOrEqual(0);
      expect(startBox!.x + startBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(startBox!.y + startBox!.height).toBeLessThan(recordTabBox!.y - (viewport.height <= 400 ? 72 : 48));
    }

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });
});

test.describe('recording capability verification', () => {
  test('recording capability /record route stays safe when browser recording support is available', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');

    await expect(page).toHaveURL(/\/record$/);
    await expect(page.getByLabel('Start recording')).toBeVisible();
    await expect(page.getByText('Recording unavailable')).toHaveCount(0);
    await expect(page.getByText('Microphone blocked')).toHaveCount(0);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('recording capability /record route shows an explicit unsupported-browser state', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: undefined,
      });
    });
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');
    await page.getByLabel('Start recording').click();

    await expect(page.getByText('Recording unavailable').first()).toBeVisible({ timeout: 10_000 });

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('recording capability /record route shows an explicit permission-denied state', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await page.addInitScript(() => {
      const mediaDevices = navigator.mediaDevices ?? {};
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          ...mediaDevices,
          getUserMedia: async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
          },
        },
      });
    });
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');
    await page.getByLabel('Start recording').click();

    await expect(page.getByText('Microphone blocked').first()).toBeVisible({ timeout: 10_000 });

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('ingest network /record route shows explicit retry-ready upload errors without breaking navigation', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockBrowserRecording(page);
    await primeSignedInSession(page, '/record');
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });
    await page.route('**/ingest', async (route) => {
      await pause(250);
      await route.abort('failed');
    });

    await page.getByLabel('Start recording').click();
    await expect(page.getByLabel('Send recording')).toBeEnabled({ timeout: 10_000 });

    await page.getByLabel('Send recording').click();

    await expect(page.getByText('Retry ready').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Upload could not reach the ingest service from this browser\./),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Retry send')).toBeEnabled();

    await page.getByLabel('Cancel recording').click();
    await expect(page.getByLabel('Send recording')).toBeDisabled();
    await expect(page.getByText(/Upload could not reach the ingest service from this browser\./)).toHaveCount(0);

    await finalizeDiagnostics({
      allowedDiagnostics: [FAILED_RESOURCE_PATTERN, INGEST_REQUEST_PATTERN],
      requiredDiagnostics: [INGEST_REQUEST_PATTERN],
    });
  });
});

test.describe('browser-safe record route parity', () => {
  test('record route parity /record supported browser flow keeps pause resume send and navigation usable', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockBrowserRecording(page);
    await primeSignedInSession(page, '/record');
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });
    await mockIngestApi(page);

    await expect(page).toHaveURL(/\/record$/);
    await page.getByLabel('Start recording').click();

    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Send recording')).toBeEnabled();

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Send recording').click();

    await expect(page.getByText('Saved').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: 'Universe' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: 'Universe' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('recording parity /record unsupported browser state stays explicit while tab navigation remains usable', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: undefined,
      });
    });
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');
    await page.getByLabel('Start recording').click();

    await expect(page.getByText('Recording unavailable').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('This browser does not expose microphone recording APIs.').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: 'Universe' })).toBeVisible();

    await page.getByRole('tab', { name: 'Universe' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('recording parity /record permission denied state stays explicit while tab navigation remains usable', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await page.addInitScript(() => {
      const mediaDevices = navigator.mediaDevices ?? {};
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          ...mediaDevices,
          getUserMedia: async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
          },
        },
      });
    });
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/record');
    await page.getByLabel('Start recording').click();

    await expect(page.getByText('Microphone blocked').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Microphone access was denied.').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: 'Universe' })).toBeVisible();

    await page.getByRole('tab', { name: 'Universe' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('recording parity /record upload failure stays retry ready without stranding the route', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    await mockBrowserRecording(page);
    await primeSignedInSession(page, '/record');
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });
    await page.route('**/ingest', async (route) => {
      await pause(250);
      await route.abort('failed');
    });

    await page.getByLabel('Start recording').click();
    await expect(page.getByLabel('Send recording')).toBeEnabled({ timeout: 10_000 });

    await page.getByLabel('Send recording').click();

    await expect(page.getByText('Retry ready').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Upload could not reach the ingest service from this browser\./),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Retry send')).toBeEnabled();

    await page.getByLabel('Cancel recording').click();
    await expect(page.getByRole('tab', { name: 'Universe' })).toBeVisible({ timeout: 10_000 });

    await finalizeDiagnostics({
      allowedDiagnostics: [FAILED_RESOURCE_PATTERN, INGEST_REQUEST_PATTERN],
      requiredDiagnostics: [INGEST_REQUEST_PATTERN],
    });
  });

  test('podcast generation stays blocked while signed out and recovery returns to the generation menu', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    const auth = await mockSupabaseAuth(page);
    const provisionApi = await mockProvisionApi(page, {
      detailSequence: [RUNNING_PODCAST, COMPLETED_PODCAST],
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });

    await page.goto('/');

    await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
    await page.getByLabel('Search memories').click();
    await page.getByPlaceholder('Search places, people, feelings').fill('Mom');
    await page.getByRole('button', { name: 'Open topic Mom from search' }).click();
    await page.getByText('Generate something').click();

    await clickGenerationAction(page, 'Podcast episode');

    await expect(page).toHaveURL(/\/auth\?/);
    await expect(page.getByText('Sign in to generate this podcast')).toBeVisible();
    expect(provisionApi.createCalls).toBe(0);
    const returnTo = readReturnToFromUrl(page.url());

    await page.getByLabel('Email address').fill('mom@example.com');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByText('Check your inbox for a sign-in link')).toBeVisible();
    expect(auth.otpCalls).toBe(1);

    await primeSignedInSession(page, returnTo, { entitled: true });

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Podcast episode')).toBeVisible();
    await clickGenerationAction(page, 'Podcast episode');

    await expect(page.getByText('Submitting your podcast job…')).toBeVisible();
    await expect(page.getByText('Podcast ready to revisit')).toBeVisible({ timeout: 10_000 });
    expect(provisionApi.createCalls).toBe(1);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });

  test('record send stays blocked while signed out and recovery returns to /record before upload', async ({ page }, testInfo) => {
    const finalizeDiagnostics = captureBrowserDiagnostics(page, testInfo);
    const auth = await mockSupabaseAuth(page);
    await mockBrowserRecording(page);
    await mockProvisionApi(page, {
      initialPodcasts: [],
      universeResponse: LIVE_UNIVERSE_RESPONSE,
    });
    const ingest = await mockIngestApi(page);

    await page.goto('/record');
    await page.getByLabel('Start recording').click();
    await expect(page.getByLabel('Send recording')).toBeEnabled({ timeout: 10_000 });

    await page.getByLabel('Send recording').click();

    await expect(page).toHaveURL(/\/auth\?/);
    await expect(page.getByText('Sign in to send this recording')).toBeVisible();
    expect(ingest.calls).toBe(0);
    const returnTo = readReturnToFromUrl(page.url());

    await page.getByLabel('Email address').fill('record@example.com');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByText('Check your inbox for a sign-in link')).toBeVisible();
    expect(auth.otpCalls).toBe(1);

    await primeSignedInSession(page, returnTo);

    await expect(page).toHaveURL(/\/record$/);
    await expect(page.getByLabel('Start recording')).toBeVisible();
    expect(ingest.calls).toBe(0);

    await finalizeDiagnostics({ failOnDiagnostics: true });
  });
});

async function mockBrowserRecording(page: Page) {
  await page.addInitScript(() => {
    class FakeTrack {
      enabled = true;
      kind = 'audio';
      label = 'Mock microphone';
      muted = false;
      readyState: MediaStreamTrackState = 'live';

      stop() {}

      getSettings() {
        return { deviceId: 'mock-audio-input' };
      }

      addEventListener() {}

      removeEventListener() {}

      dispatchEvent() {
        return true;
      }
    }

    const createMockStream = () => {
      const track = new FakeTrack() as unknown as MediaStreamTrack;

      return {
        active: true,
        addEventListener() {},
        addTrack() {},
        clone: createMockStream,
        dispatchEvent() {
          return true;
        },
        getAudioTracks: () => [track],
        getTracks: () => [track],
        getVideoTracks: () => [],
        id: 'mock-stream',
        removeEventListener() {},
        removeTrack() {},
      } as unknown as MediaStream;
    };

    const listeners = new Map<string, Set<(event: Event) => void>>();
    const mediaDevices = {
      addEventListener(type: string, listener: (event: Event) => void) {
        const bucket = listeners.get(type) ?? new Set();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      async enumerateDevices() {
        return [
          {
            deviceId: 'mock-audio-input',
            groupId: 'mock-group',
            kind: 'audioinput',
            label: 'Mock microphone',
            toJSON() {
              return this;
            },
          },
        ] satisfies Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'kind' | 'label' | 'toJSON'>[];
      },
      async getUserMedia() {
        return createMockStream();
      },
      removeEventListener(type: string, listener: (event: Event) => void) {
        listeners.get(type)?.delete(listener);
      },
    } satisfies Partial<MediaDevices>;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      readonly listeners = new Map<string, Set<(event: Event | { data: Blob }) => void>>();
      state: RecordingState = 'inactive';

      constructor(readonly stream: MediaStream, readonly options?: MediaRecorderOptions) {}

      addEventListener(type: string, listener: (event: Event | { data: Blob }) => void) {
        const bucket = this.listeners.get(type) ?? new Set();
        bucket.add(listener);
        this.listeners.set(type, bucket);
      }

      removeEventListener(type: string, listener: (event: Event | { data: Blob }) => void) {
        this.listeners.get(type)?.delete(listener);
      }

      pause() {
        this.state = 'paused';
        this.emit('pause', new Event('pause'));
      }

      resume() {
        this.state = 'recording';
        this.emit('resume', new Event('resume'));
      }

      start() {
        this.state = 'recording';
        this.emit('start', new Event('start'));
      }

      stop() {
        this.state = 'inactive';
        this.emit('dataavailable', { data: new Blob(['mock-audio'], { type: 'audio/webm' }) });
        this.emit('stop', new Event('stop'));
      }

      private emit(type: string, event: Event | { data: Blob }) {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }
    }

    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });
  });
}

async function mockIngestApi(page: Page) {
  const calls = { calls: 0 };

  await page.route('**/ingest', async (route) => {
    calls.calls += 1;
    await pause(250);
    await fulfillJson(route, 200, {
      audio_url: 'https://example.com/audio.webm',
      chunks: 3,
      input_id: 'recording-123',
      status: 'processed',
    });
  });

  return calls;
}

async function mockSupabaseAuth(page: Page): Promise<MockSupabaseAuthHandle> {
  const calls: MockSupabaseAuthHandle = {
    otpCalls: 0,
  };

  await page.route('**/auth/v1/otp**', async (route) => {
    calls.otpCalls += 1;
    await fulfillJson(route, 200, {
      session: null,
      user: null,
    });
  });

  return calls;
}

async function primeSignedInSession(page: Page, returnTo: string, options?: { entitled?: boolean }) {
  await page.addInitScript(({ entitlements, session }) => {
    window.localStorage.setItem('applepie.test.activeEntitlements', JSON.stringify(entitlements));
    window.localStorage.setItem('sb-example-auth-token', JSON.stringify(session));
  }, {
    entitlements: options?.entitled ? ['podcast_generation'] : [],
    session: buildSupabaseSession(),
  });

  await page.goto(returnTo);
}

function readReturnToFromUrl(url: string) {
  const value = new URL(url).searchParams.get('returnTo');

  if (!value) {
    throw new Error(`Missing returnTo query param in ${url}`);
  }

  return value;
}

function buildSupabaseSession() {
  const user = {
    app_metadata: { provider: 'email', providers: ['email'] },
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
    user_metadata: {},
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

function captureBrowserDiagnostics(page: Page, testInfo: TestInfo) {
  const diagnostics: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.push(`[console.${message.type()}] ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.push(`[pageerror] ${error.stack ?? error.message}`);
  });

  page.on('requestfailed', (request) => {
    diagnostics.push(
      `[requestfailed] ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown error'}`,
    );
  });

  return async ({
    allowedDiagnostics,
    failOnDiagnostics = false,
    requiredDiagnostics,
  }: {
    allowedDiagnostics?: RegExp[];
    failOnDiagnostics?: boolean;
    requiredDiagnostics?: RegExp[];
  } = {}) => {
    const body = diagnostics.length > 0 ? diagnostics.join('\n\n') : NO_BROWSER_DIAGNOSTICS;
    await testInfo.attach('browser-console-runtime', {
      body,
      contentType: 'text/plain',
    });

    if (failOnDiagnostics) {
      expect(
        diagnostics,
        diagnostics.length > 0
          ? `Unexpected browser console/runtime errors:\n${diagnostics.join('\n\n')}`
          : 'Expected no browser console/runtime errors.',
      ).toEqual([]);
    }

    if (allowedDiagnostics || requiredDiagnostics) {
      const unexpectedDiagnostics = diagnostics.filter(
        (entry) => !(allowedDiagnostics ?? []).some((pattern) => pattern.test(entry)),
      );
      const missingDiagnostics = (requiredDiagnostics ?? []).filter(
        (pattern) => !diagnostics.some((entry) => pattern.test(entry)),
      );

      expect(
        unexpectedDiagnostics,
        unexpectedDiagnostics.length > 0
          ? `Captured unexpected browser diagnostics:\n${unexpectedDiagnostics.join('\n\n')}`
          : 'Expected no unexpected browser diagnostics.',
      ).toEqual([]);
      expect(
        missingDiagnostics.map((pattern) => pattern.toString()),
        missingDiagnostics.length > 0
          ? `Missing expected browser diagnostics. Captured diagnostics:\n${body}`
          : 'Expected all required browser diagnostics to be captured.',
      ).toEqual([]);
    }
  };
}

async function expectUniverseRoute(page: Page) {
  const universeTab = page.getByRole('tab', { name: 'Universe' });
  const recordTab = page.getByRole('tab', { name: 'Record' });

  await expect(page).toHaveURL(/\/$/);
  await expect(universeTab).toBeVisible();
  await expect(recordTab).toBeVisible();
  await expect(universeTab).toHaveAttribute('aria-selected', 'true');
  await expect(recordTab).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('Tap a glow to enter a topic')).toBeVisible();
  await expect(page.getByLabel('Search memories')).toBeVisible();
}

async function expectRecordRoute(page: Page) {
  const universeTab = page.getByRole('tab', { name: 'Universe' });
  const recordTab = page.getByRole('tab', { name: 'Record' });

  await expect(page).toHaveURL(/\/record$/);
  await expect(universeTab).toBeVisible();
  await expect(recordTab).toBeVisible();
  await expect(universeTab).toHaveAttribute('aria-selected', 'false');
  await expect(recordTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Start recording')).toBeVisible();
  await expect(page.getByText('Loading live universe…')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Search memories')).toBeHidden();
}

async function mockProvisionApi(
  page: Page,
  options: {
    createSequence?: readonly (object | MockRouteStep)[];
    detailSequence?: readonly (object | MockRouteStep)[];
    initialPodcasts: readonly object[];
    universeError?: { detail: string };
    universeResponse?: object;
  },
) {
  const callCounts = {
    createCalls: 0,
    detailCalls: 0,
  };
  let createIndex = 0;
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
      const next = toMockRouteStep(options.createSequence?.[Math.min(createIndex, (options.createSequence?.length ?? 1) - 1)]);
      createIndex += 1;
      await fulfillMockRoute(route, next ?? { body: PENDING_PODCAST, status: 200 });
      return;
    }

    await route.fallback();
  });

  await page.route('**/podcasts/*', async (route) => {
    callCounts.detailCalls += 1;
    await pause(900);
    const next = toMockRouteStep(
      options.detailSequence?.[Math.min(detailIndex, (options.detailSequence?.length ?? 1) - 1)],
    );
    detailIndex += 1;
    await fulfillMockRoute(route, next ?? { body: PENDING_PODCAST, status: 200 });
  });

  return callCounts;
}

function toMockRouteStep(step: object | MockRouteStep | undefined): MockRouteStep | null {
  if (!step) {
    return null;
  }

  if ('abort' in step) {
    return step;
  }

  if ('body' in step && 'status' in step) {
    return step as MockRouteStep;
  }

  return { body: step, status: 200 };
}

async function fulfillMockRoute(route: Route, step: MockRouteStep) {
  if ('abort' in step) {
    await route.abort(step.abort);
    return;
  }

  await fulfillJson(route, step.status, step.body);
}

async function clickGenerationAction(page: Page, label: string) {
  const actionTitle = page.getByText(label, { exact: true }).first();

  await expect(actionTitle).toBeVisible();
  await actionTitle.click();
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
