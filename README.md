# Apple Pie UI

Expo/React Native UI for the Apple Pie memory graph, recording flow, and generation triggers.

## Install and run

```bash
npm install
npm run web
```

For native targets you can also use:

```bash
npm run ios
npm run android
```

## Routes

`/` is the public "coming soon" landing page. It explains the product, carries no
sign-in control, and links nowhere. The app sits behind it:

- `/universe` -- the memory graph (the Universe tab)
- `/record` -- the recording flow
- `/account` -- account settings
- `/auth` -- Google sign-in

`expo export --platform web` statically renders one HTML file per route, so the
set of emitted files is the set CloudFront has to serve. The viewer-request
function in `infrastructure/aws/frontend.tf` appends `.html` to any extensionless
path, so `/universe` resolves without an infrastructure change.

Two details are load-bearing:

- `src/app/(tabs)/_layout.tsx` sets `unstable_settings.anchor` to `universe`.
  The group's anchor used to be implied by its `index` route; without the
  explicit anchor the browser back button leaves the tab group instead of
  returning to the previously focused tab.
- On native, `src/app/index.tsx` redirects to `/universe`. There is no public URL
  to guard in the installed app, so it still opens on the memory graph.

## Automated verification

Use the same commands locally that CI runs for the checked-in non-microphone path:

```bash
npm run lint
npm run typecheck
npm run export:web
```

For the browser verification, start Expo web in one shell and run Playwright in another after `http://127.0.0.1:8081` is up:

```bash
npm run web
npm run test:playwright-ui
```

## Environment variables

The app reads these Expo public env vars:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_INGEST_API_URL=http://127.0.0.1:8000
EXPO_PUBLIC_INGEST_API_KEY=
EXPO_PUBLIC_PROVISION_API_KEY=
EXPO_PUBLIC_PROVISION_API_URL=http://127.0.0.1:8002
```

See `.env.example` for the full, current contract (including the Playwright-specific
Supabase URL constraint).

Notes:
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are required for Supabase Auth.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` are required on native builds, RevenueCat stays a web no-op.
- `EXPO_PUBLIC_INGEST_API_URL` is required and points at the local `data-ingestion` API, e.g. `http://127.0.0.1:8000`.
- `EXPO_PUBLIC_INGEST_API_KEY` and `EXPO_PUBLIC_PROVISION_API_KEY` are sent as
  `x-api-key` on `POST /ingest` and `POST /podcasts` respectively -- the two
  endpoints that cost money to call. Each API skips the check when its own key is
  unset, so both can stay blank locally. Both are inlined into the client bundle
  like every `EXPO_PUBLIC_*` value, so they deter drive-by abuse of a public URL
  rather than authenticating anyone.
- `EXPO_PUBLIC_PROVISION_API_URL` is required and points at the local `data-provision-api`, e.g. `http://127.0.0.1:8002`.

## What is live in the UI now

- recording uploads to `POST /ingest`
- record controls show `Sending…`, `Saved`, and `Retry ready`
- the universe screen fetches live `/universe` data on load
- the generation menu can create real `POST /podcasts` jobs and poll their status

## Manual verification checklist

These steps still require a runtime with a real microphone and reachable backend services:

1. Start the UI with the desired env vars.
2. Confirm the universe loads from the provision API instead of falling back to the preview map.
3. Open the Record tab and grant microphone permissions.
4. Record one real sample and press send.
5. Confirm the UI surfaces the ingest success state and the request reaches `/ingest`.
6. Return to the universe view, open a topic, and select `Podcast episode`.
7. Confirm the job is created through `POST /podcasts` and the status moves through `pending` / `running` / `completed` or `failed`.

## Manual verification blockers outside the UI repo

- browser/device must expose a real microphone input
- the ingestion app must be reachable and CORS-enabled for web
- the story-labeling service must be reachable if Phase 3 verification is being performed end to end
- the data-provision API must have working Postgres/Blob/Qdrant backing services for live podcast generation

## Local authentication (Supabase)

There is no local Supabase instance in this repo, and you do not need one for the
test suite.

**For the Playwright E2E suite** (`npx playwright test`), auth is primed directly in
`localStorage` by `tests/browser/helpers/auth.ts`. This is why
`EXPO_PUBLIC_SUPABASE_URL` must be exactly `https://example.supabase.co`: supabase-js
derives its storage key from the project ref in the URL, so the helper writes
`sb-example-auth-token`, and any other URL silently produces a key the client never
reads. The session then looks absent and every authenticated test fails in a way that
looks like a UI bug. See `.env.example`.

**For manual local development** you need a real Supabase project, because sign-in is
Google OAuth and the redirect has to be registered with a real provider. Either point
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` at a development
project, or run `supabase start` and configure a provider against it. Priming
`localStorage` the way the tests do also works for a quick look around without signing in.
