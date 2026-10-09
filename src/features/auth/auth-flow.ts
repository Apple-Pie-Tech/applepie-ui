import type { Href } from 'expo-router';

export type AuthReason = 'account-save' | 'podcast-generate' | 'recording-send';

const AUTH_SESSION_UNAVAILABLE_PATTERN = /auth session missing|jwt expired|invalid jwt/i;

export function buildAuthPath({ reason, returnTo }: { reason: AuthReason; returnTo: string }): Href {
  return `/auth?reason=${encodeURIComponent(reason)}&returnTo=${encodeURIComponent(returnTo)}` as Href;
}

export function buildAuthHref({ reason, returnTo }: { reason: AuthReason; returnTo: string }): Href {
  return {
    pathname: '/auth',
    params: {
      reason,
      returnTo,
    },
  };
}

export function buildUniverseReturnPath({
  menu,
  topicId,
}: {
  menu: 'generate';
  topicId: string;
}): string {
  return `/universe?topicId=${encodeURIComponent(topicId)}&menu=${encodeURIComponent(menu)}`;
}

// `/` is the public landing page, so a sign-in with no usable returnTo falls
// back to the universe rather than bouncing the user out of the app.
const DEFAULT_RETURN_TO = '/universe';

export function normalizeReturnTo(value: string | string[] | undefined): string {
  const route = readSearchParam(value)?.trim();

  if (!route || route === '/' || !route.startsWith('/') || route.startsWith('/auth')) {
    return DEFAULT_RETURN_TO;
  }

  return route;
}

export function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function isAuthSessionUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AuthSessionMissingError' || AUTH_SESSION_UNAVAILABLE_PATTERN.test(error.message);
}
