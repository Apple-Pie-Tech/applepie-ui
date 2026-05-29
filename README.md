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
EXPO_PUBLIC_INGEST_API_URL=https://<azure-ingestion-api-host>
EXPO_PUBLIC_INGEST_API_KEY=
EXPO_PUBLIC_PROVISION_API_URL=https://<azure-provision-api-host>
```

Notes:
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are required for Supabase Auth.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` are required on native builds, RevenueCat stays a web no-op.
- `EXPO_PUBLIC_INGEST_API_URL` is required and must point to the deployed Azure ingestion API base URL.
- `EXPO_PUBLIC_INGEST_API_KEY` is only needed if ingest auth is later enforced.
- `EXPO_PUBLIC_PROVISION_API_URL` is required and must point to the deployed Azure data-provision API base URL.

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
