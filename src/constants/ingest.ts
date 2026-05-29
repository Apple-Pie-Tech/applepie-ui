function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function getRequiredIngestApiUrl() {
  const value = process.env.EXPO_PUBLIC_INGEST_API_URL?.trim();
  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_INGEST_API_URL for the data ingestion API.');
  }

  return trimTrailingSlashes(value);
}

export const ingestApiUrl = getRequiredIngestApiUrl();

export const ingestApiKey = process.env.EXPO_PUBLIC_INGEST_API_KEY?.trim() || null;

export function getIngestEndpoint() {
  return `${ingestApiUrl}/ingest`;
}
