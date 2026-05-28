import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export type RecordingCapabilityDecision =
  | {
      kind: 'supported';
      permissionGranted?: boolean;
    }
  | {
      kind: 'permission-denied' | 'unsupported';
      message: string;
      permissionGranted?: boolean;
      statusLabel: string;
    };

const PERMISSION_DENIED_LABEL = 'Microphone blocked';
const UNSUPPORTED_LABEL = 'Recording unavailable';

export class RecordingCapabilityError extends Error {
  readonly kind: 'permission-denied' | 'unsupported';
  readonly statusLabel: string;

  constructor(kind: 'permission-denied' | 'unsupported', message: string, statusLabel: string) {
    super(message);
    this.kind = kind;
    this.name = 'RecordingCapabilityError';
    this.statusLabel = statusLabel;
  }
}

export async function bootstrapRecordingCapability(): Promise<RecordingCapabilityDecision> {
  if (Platform.OS === 'web') {
    return supported();
  }

  try {
    const result = await AudioModule.requestRecordingPermissionsAsync();
    if (!result.granted) {
      return supported(false);
    }

    await configureRecordingAudioMode();
    return supported(true);
  } catch (error) {
    return toCapabilityDecision(error, unsupported('Recording setup failed on this device.'));
  }
}

export async function ensureRecordingCanStart({
  permissionGranted,
}: {
  permissionGranted: boolean;
}): Promise<RecordingCapabilityDecision> {
  const browserCapability = getBrowserRecordingCapability();
  if (browserCapability.kind !== 'supported') {
    return browserCapability;
  }

  if (Platform.OS === 'web') {
    return browserCapability;
  }

  if (permissionGranted) {
    await configureRecordingAudioMode();
    return supported(true);
  }

  try {
    const result = await AudioModule.requestRecordingPermissionsAsync();
    if (!result.granted) {
      return permissionDenied('Microphone access was denied.');
    }

    await configureRecordingAudioMode();
    return supported(true);
  } catch (error) {
    return toCapabilityDecision(error, unsupported('Recording setup failed on this device.'));
  }
}

export function getRecordingCapabilityError(error: unknown) {
  if (error instanceof RecordingCapabilityError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const signature = `${error.name} ${error.message}`.toLowerCase();
  if (
    signature.includes('notallowederror') ||
    signature.includes('permission denied') ||
    signature.includes('permission dismissed') ||
    signature.includes('permission blocked')
  ) {
    return new RecordingCapabilityError('permission-denied', 'Microphone access was denied.', PERMISSION_DENIED_LABEL);
  }

  if (
    signature.includes('secure context') ||
    signature.includes('mediarecorder') ||
    signature.includes('getusermedia') ||
    signature.includes('notsupportederror') ||
    signature.includes('notfounderror') ||
    signature.includes('notreadableerror') ||
    signature.includes('not supported')
  ) {
    return new RecordingCapabilityError(
      'unsupported',
      'This browser cannot record audio here. Use localhost or HTTPS and an available microphone.',
      UNSUPPORTED_LABEL,
    );
  }

  return null;
}

export function toRecordingCapabilityError(
  decision: Exclude<RecordingCapabilityDecision, { kind: 'supported' }>,
) {
  return new RecordingCapabilityError(decision.kind, decision.message, decision.statusLabel);
}

export function getFinalizedRecordingUri(uri: string | null) {
  if (uri) {
    return uri;
  }

  if (Platform.OS === 'web') {
    throw unsupportedError('This browser did not provide a recording file to upload.');
  }

  throw new Error('Recording file unavailable');
}

export async function createRecordingUploadAudioBody(uri: string) {
  if (Platform.OS !== 'web') {
    return new File(uri);
  }

  const browserCapability = getBrowserRecordingCapability();
  if (browserCapability.kind !== 'supported') {
    throw toRecordingCapabilityError(browserCapability);
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw unsupportedError('Recorded audio could not be read in this browser.');
  }

  return response.blob();
}

function getBrowserRecordingCapability(): RecordingCapabilityDecision {
  if (Platform.OS !== 'web') {
    return supported();
  }

  if (typeof window === 'undefined' || !window.isSecureContext) {
    return unsupported('Recording requires localhost or HTTPS.');
  }

  const hasGetUserMedia = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
  if (!hasGetUserMedia || typeof globalThis.MediaRecorder === 'undefined') {
    return unsupported('This browser does not expose microphone recording APIs.');
  }

  return supported();
}

async function configureRecordingAudioMode() {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
}

function toCapabilityDecision(error: unknown, fallback: RecordingCapabilityDecision): RecordingCapabilityDecision {
  const capabilityError = getRecordingCapabilityError(error);
  if (capabilityError) {
    return {
      kind: capabilityError.kind,
      message: capabilityError.message,
      statusLabel: capabilityError.statusLabel,
    };
  }

  return fallback;
}

function permissionDenied(message: string): RecordingCapabilityDecision {
  return {
    kind: 'permission-denied',
    message,
    permissionGranted: false,
    statusLabel: PERMISSION_DENIED_LABEL,
  };
}

function supported(permissionGranted?: boolean): RecordingCapabilityDecision {
  return {
    kind: 'supported',
    permissionGranted,
  };
}

function unsupported(message: string): RecordingCapabilityDecision {
  return {
    kind: 'unsupported',
    message,
    permissionGranted: false,
    statusLabel: UNSUPPORTED_LABEL,
  };
}

function unsupportedError(message: string) {
  return new RecordingCapabilityError('unsupported', message, UNSUPPORTED_LABEL);
}
