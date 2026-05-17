export const DEFAULT_INGEST_API_URL = 'https://misleading-dotty-trigub-tech-89f74bab.koyeb.app';

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

export const ingestApiUrl = trimTrailingSlashes(
  process.env.EXPO_PUBLIC_INGEST_API_URL?.trim() || DEFAULT_INGEST_API_URL,
);

export const ingestApiKey = process.env.EXPO_PUBLIC_INGEST_API_KEY?.trim() || null;

export function getIngestEndpoint() {
  return `${ingestApiUrl}/ingest`;
}
