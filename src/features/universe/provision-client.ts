import { fetch } from 'expo/fetch';

import { getProvisionEndpoint } from '@/constants/provision';

export type ProvisionUniversePoint = {
  audio_url?: string;
  id: string;
  is_central: boolean;
  is_synthetic: boolean;
  label: string;
};

export type ProvisionUniverseEdge = {
  source_id: string;
  target_id: string;
};

export type ProvisionUniverseResponse = {
  edges: ProvisionUniverseEdge[];
  points: ProvisionUniversePoint[];
};

export type ProvisionPodcastStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ProvisionPodcastScriptLine = {
  speaker: string;
  text: string;
};

export type ProvisionPodcastScript = {
  parts: ProvisionPodcastScriptLine[];
};

export type ProvisionPodcastListItem = {
  audio_url?: string | null;
  cover_url?: string | null;
  id: string;
  label: string;
  status: ProvisionPodcastStatus;
};

export type ProvisionPodcastDetail = ProvisionPodcastListItem & {
  error?: string | null;
  script?: ProvisionPodcastScript | null;
};

export function mergePodcastListItem(
  item: ProvisionPodcastListItem,
  existing?: ProvisionPodcastDetail | null,
): ProvisionPodcastDetail {
  const preserveDetails = existing?.id === item.id;

  return {
    ...item,
    error: preserveDetails ? existing?.error ?? null : null,
    script: preserveDetails ? existing?.script ?? null : null,
  };
}

export async function fetchUniverse(): Promise<ProvisionUniverseResponse> {
  const payload = asRecord(await requestJson(getProvisionEndpoint('/universe')), 'universe');
  return {
    edges: readRequiredRecordArray(payload.edges, 'edges').map((item) => ({
      source_id: readRequiredString(item.source_id, 'source_id'),
      target_id: readRequiredString(item.target_id, 'target_id'),
    })),
    points: readRequiredRecordArray(payload.points, 'points').map((item) => ({
      audio_url: readOptionalString(item.audio_url),
      id: readRequiredString(item.id, 'id'),
      is_central: readOptionalBoolean(item.is_central),
      is_synthetic: readOptionalBoolean(item.is_synthetic),
      label: readRequiredString(item.label, 'label'),
    })),
  };
}

export async function createPodcast(label: string): Promise<ProvisionPodcastDetail> {
  return parsePodcastDetail(
    await requestJson(getProvisionEndpoint('/podcasts'), {
      body: JSON.stringify({ label }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
  );
}

export async function fetchPodcastDetail(podcastId: string): Promise<ProvisionPodcastDetail> {
  return parsePodcastDetail(await requestJson(getProvisionEndpoint(`/podcasts/${podcastId}`)));
}

export async function fetchPodcasts(): Promise<ProvisionPodcastListItem[]> {
  return parsePodcastList(await requestJson(getProvisionEndpoint('/podcasts')));
}

async function requestJson(input: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(input, init);
  const text = await response.text();
  const payload = parseJsonValue(text);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return payload;
}

function parsePodcastDetail(payload: unknown): ProvisionPodcastDetail {
  const record = asRecord(payload, 'detail');
  const item = parsePodcastListItem(record);

  return {
    ...item,
    error: readOptionalString(record.error) ?? null,
    script: parseOptionalScript(record.script),
  };
}

function parsePodcastList(payload: unknown): ProvisionPodcastListItem[] {
  return readRequiredRecordArray(payload, 'podcasts').map((item) => parsePodcastListItem(item));
}

function parsePodcastListItem(payload: Record<string, unknown>): ProvisionPodcastListItem {
  return {
    audio_url: readOptionalString(payload.audio_url) ?? null,
    cover_url: readOptionalString(payload.cover_url) ?? null,
    id: readRequiredString(payload.id, 'id'),
    label: readRequiredString(payload.label, 'label'),
    status: readRequiredStatus(payload.status),
  };
}

function parseOptionalScript(value: unknown): ProvisionPodcastScript | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    parts: readRequiredRecordArray(value.parts, 'script.parts').map((item) => ({
      speaker: readRequiredString(item.speaker, 'speaker'),
      text: readRequiredString(item.text, 'text'),
    })),
  };
}

function parseJsonValue(text: string): unknown {
  if (!text.trim()) {
    throw new Error('Provision API returned an empty response');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Provision API returned invalid JSON');
  }
}

function getErrorMessage(payload: unknown, statusCode: number) {
  if (isRecord(payload)) {
    const detail = payload.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
  }

  return `Provision API request failed (${statusCode})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRequiredRecordArray(
  value: unknown,
  fieldName: string,
): Record<string, unknown>[] {
  if (Array.isArray(value) && value.every(isRecord)) {
    return value;
  }

  throw new Error(`Provision response missing ${fieldName}`);
}

function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  throw new Error(`Provision response missing ${fieldName}`);
}

function readRequiredStatus(value: unknown): ProvisionPodcastStatus {
  if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed') {
    return value;
  }

  throw new Error('Provision response missing status');
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new Error(`Provision response missing ${fieldName}`);
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readOptionalBoolean(value: unknown) {
  return value === true;
}
