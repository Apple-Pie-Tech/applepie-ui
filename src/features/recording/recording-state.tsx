import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { IngestResult, submitRecordingToIngest } from './ingest-client';
import {
  bootstrapRecordingCapability,
  ensureRecordingCanStart,
  getFinalizedRecordingUri,
  getRecordingCapabilityError,
  toRecordingCapabilityError,
} from './recording-capability';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'sending' | 'sent' | 'error';

export type RecordingResult = {
  uri: string;
  durationSeconds: number;
  createdAt: number;
};

type RecordingContextValue = {
  cancel: () => void;
  elapsedSeconds: number;
  ingestError: string | null;
  ingestResult: IngestResult | null;
  lastRecording: RecordingResult | null;
  pause: () => void;
  permissionGranted: boolean;
  resume: () => void;
  send: () => void;
  start: () => void;
  status: RecordingStatus;
  statusLabel: string | null;
  toggle: () => void;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [lastRecording, setLastRecording] = useState<RecordingResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [frozenElapsed, setFrozenElapsed] = useState<number | null>(null);
  const [errorLabel, setErrorLabel] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const surfaceRecordingError = useCallback((error: Error, fallbackLabel: string) => {
    setPermissionGranted(false);
    setErrorLabel(error instanceof Error && 'statusLabel' in error ? String(error.statusLabel) : fallbackLabel);
    setIngestError(error.message);
    setStatus('error');
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const result = await bootstrapRecordingCapability();
        if (!mounted) {
          return;
        }

        if (typeof result.permissionGranted === 'boolean') {
          setPermissionGranted(result.permissionGranted);
        }
      } catch (err) {
        console.warn('[recording] permission/audio mode setup failed', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearResetTimer();
    setFrozenElapsed(null);
    setErrorLabel(null);
    setIngestError(null);
    setIngestResult(null);
    setLastRecording(null);

    (async () => {
      try {
        const capability = await ensureRecordingCanStart({ permissionGranted });
        if (capability.kind !== 'supported') {
          surfaceRecordingError(toRecordingCapabilityError(capability), capability.statusLabel);
          return;
        }

        if (typeof capability.permissionGranted === 'boolean') {
          setPermissionGranted(capability.permissionGranted);
        }

        await recorder.prepareToRecordAsync();
        recorder.record();
        setPermissionGranted(true);
        setStatus('recording');
      } catch (err) {
        const capabilityError = getRecordingCapabilityError(err);
        if (capabilityError) {
          surfaceRecordingError(capabilityError, capabilityError.statusLabel);
          return;
        }

        const message = err instanceof Error ? err.message : 'Recording failed to start';
        setPermissionGranted(false);
        setErrorLabel('Recording error');
        setIngestError(message);
        setStatus('error');
        console.warn('[recording] failed to start', err);
      }
    })();
  }, [clearResetTimer, permissionGranted, recorder, surfaceRecordingError]);

  const pause = useCallback(() => {
    try {
      recorder.pause();
      setStatus('paused');
    } catch (err) {
      const capabilityError = getRecordingCapabilityError(err);
      if (capabilityError) {
        surfaceRecordingError(capabilityError, capabilityError.statusLabel);
        return;
      }

      const message = err instanceof Error ? err.message : 'Recording failed to pause';
      setErrorLabel('Recording error');
      setIngestError(message);
      setStatus('error');
      console.warn('[recording] failed to pause', err);
    }
  }, [recorder, surfaceRecordingError]);

  const resume = useCallback(() => {
    clearResetTimer();
    try {
      recorder.record();
      setStatus('recording');
    } catch (err) {
      const capabilityError = getRecordingCapabilityError(err);
      if (capabilityError) {
        surfaceRecordingError(capabilityError, capabilityError.statusLabel);
        return;
      }

      const message = err instanceof Error ? err.message : 'Recording failed to resume';
      setErrorLabel('Recording error');
      setIngestError(message);
      setStatus('error');
      console.warn('[recording] failed to resume', err);
    }
  }, [clearResetTimer, recorder, surfaceRecordingError]);

  const cancel = useCallback(() => {
    clearResetTimer();
    setFrozenElapsed(null);
    setErrorLabel(null);
    setIngestError(null);
    setIngestResult(null);
    setLastRecording(null);
    setStatus('idle');

    (async () => {
      try {
        await recorder.stop();
      } catch {
        // recorder may not be active — safe to ignore
      }
    })();
  }, [clearResetTimer, recorder]);

  const send = useCallback(() => {
    clearResetTimer();
    const canRetry = status === 'error' && lastRecording !== null;
    const canSendCurrent = status === 'recording' || status === 'paused';

    if (!canRetry && !canSendCurrent) {
      return;
    }

    const finalElapsed = lastRecording?.durationSeconds ?? Math.floor((recorderState.durationMillis ?? 0) / 1000);
    setFrozenElapsed(finalElapsed);
    setErrorLabel(null);
    setIngestError(null);
    setIngestResult(null);
    setStatus('sending');

    (async () => {
      let retryReady = canRetry;

      try {
        const recording = canRetry
          ? lastRecording
          : await finalizeRecording({
              finalElapsed,
              recorder,
            });

        setLastRecording(recording);
        retryReady = true;

        const result = await submitRecordingToIngest(recording);
        setIngestResult(result);
        setStatus('sent');

        resetTimerRef.current = setTimeout(() => {
          setStatus('idle');
          setFrozenElapsed(null);
          setErrorLabel(null);
          resetTimerRef.current = null;
        }, 1400);
      } catch (err) {
        const capabilityError = getRecordingCapabilityError(err);
        const message = err instanceof Error ? err.message : 'Upload failed';
        setIngestError(message);
        setErrorLabel(capabilityError?.statusLabel ?? (retryReady ? null : 'Recording error'));
        setStatus('error');
        console.warn('[recording] failed to send', err);
      }
    })();
  }, [clearResetTimer, lastRecording, recorder, recorderState.durationMillis, status]);

  const toggle = useCallback(() => {
    if (status === 'sending') {
      return;
    }

    if (status === 'recording') {
      pause();
      return;
    }

    if (status === 'paused') {
      resume();
      return;
    }

    start();
  }, [pause, resume, start, status]);

  useEffect(
    () => () => {
      clearResetTimer();
    },
    [clearResetTimer],
  );

  const liveElapsed = Math.floor((recorderState.durationMillis ?? 0) / 1000);
  const elapsedSeconds =
    status === 'idle'
      ? 0
      : (status === 'sending' || status === 'sent' || status === 'error') && frozenElapsed != null
        ? frozenElapsed
        : liveElapsed;

  const statusLabel =
    status === 'sending'
      ? 'Sending…'
      : status === 'sent'
        ? 'Saved'
        : status === 'error'
          ? errorLabel ?? 'Retry ready'
          : null;

  const value = useMemo(
    () => ({
      cancel,
      elapsedSeconds,
      ingestError,
      ingestResult,
      lastRecording,
      pause,
      permissionGranted,
      resume,
      send,
      start,
      status,
      statusLabel,
      toggle,
    }),
    [
      cancel,
      elapsedSeconds,
      ingestError,
      ingestResult,
      lastRecording,
      pause,
      permissionGranted,
      resume,
      send,
      start,
      status,
      statusLabel,
      toggle,
    ],
  );

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording() {
  const context = useContext(RecordingContext);

  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }

  return context;
}

async function finalizeRecording({
  finalElapsed,
  recorder,
}: {
  finalElapsed: number;
  recorder: ReturnType<typeof useAudioRecorder>;
}): Promise<RecordingResult> {
  await recorder.stop();
  const uri = getFinalizedRecordingUri(recorder.uri);

  return {
    createdAt: Date.now(),
    durationSeconds: finalElapsed,
    uri,
  };
}
