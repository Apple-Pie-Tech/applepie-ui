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

## Environment variables

The UI now uses two optional env vars for the ingest handoff and one for the provisioning API:

```bash
EXPO_PUBLIC_INGEST_API_URL=https://misleading-dotty-trigub-tech-89f74bab.koyeb.app
EXPO_PUBLIC_INGEST_API_KEY=
EXPO_PUBLIC_PROVISION_API_URL=https://data-provision-api-trigub-tech-7a2fdbc9.koyeb.app
```

Notes:
- `EXPO_PUBLIC_INGEST_API_URL` defaults to the deployed ingestion app if omitted.
- `EXPO_PUBLIC_INGEST_API_KEY` is only needed if ingest auth is later enforced.
- `EXPO_PUBLIC_PROVISION_API_URL` defaults to the deployed data-provision API if omitted.

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
