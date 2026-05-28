import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { getIngestEndpoint, ingestApiKey } from '@/constants/ingest';

import { createRecordingUploadAudioBody } from './recording-capability';

export type IngestResult = {
  audio_url?: string;
  chunks: number;
  input_id: string;
  status: string;
};

export type RecordingUpload = {
  createdAt: number;
  durationSeconds: number;
  uri: string;
};

export async function submitRecordingToIngest(
  recording: RecordingUpload,
  userId: string,
): Promise<IngestResult> {
  const canonicalUserId = userId.trim();
  if (!canonicalUserId) {
    throw new Error('Upload requires an authenticated user.');
  }

  const endpoint = getIngestEndpoint();
  const formData = new FormData();
  const file = await createRecordingUploadAudioBody(recording.uri);

  formData.append(
    'metadata',
    JSON.stringify({
      input_id: `recording-${recording.createdAt}`,
      timestamp: new Date(recording.createdAt).toISOString(),
      user_id: canonicalUserId,
    }),
  );
  formData.append('audio', file, getRecordingFilename(recording));

  const headers = ingestApiKey ? { 'x-api-key': ingestApiKey } : undefined;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      body: formData,
      headers,
      method: 'POST',
    });
  } catch (error) {
    throw toIngestRequestError(error);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return {
    audio_url: readOptionalString(payload?.audio_url),
    chunks: readRequiredNumber(payload?.chunks, 'chunks'),
    input_id: readRequiredString(payload?.input_id, 'input_id'),
    status: readRequiredString(payload?.status, 'status'),
  };
}

function getRecordingFilename(recording: RecordingUpload) {
  const uriTail = recording.uri.split('/').pop()?.split('?')[0]?.trim();
  if (uriTail) {
    return decodeURIComponent(uriTail);
  }

  return `memory-${recording.createdAt}.m4a`;
}

function toIngestRequestError(error: unknown) {
  if (looksLikeNetworkRequestError(error)) {
    return new Error(
      Platform.OS === 'web'
        ? 'Upload could not reach the ingest service from this browser. Check CORS, network access, or whether the service is down.'
        : 'Upload failed before the ingest service responded.',
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Upload failed before the ingest service responded.');
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(text);
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function getErrorMessage(payload: Record<string, unknown> | null, statusCode: number) {
  const detail = payload?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  return `Upload failed (${statusCode})`;
}

function looksLikeNetworkRequestError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const signature = `${error.name} ${error.message}`.toLowerCase();

  return (
    signature.includes('failed to fetch') ||
    signature.includes('load failed') ||
    signature.includes('network request failed') ||
    signature.includes('networkerror') ||
    signature.includes('err_failed') ||
    signature.includes('cors')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new Error(`Ingest response missing ${fieldName}`);
}

function readRequiredNumber(value: unknown, fieldName: string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`Ingest response missing ${fieldName}`);
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
