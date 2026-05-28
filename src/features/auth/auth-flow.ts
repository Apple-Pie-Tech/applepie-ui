import type { Href } from 'expo-router';

export type AuthReason = 'podcast-generate' | 'recording-send';

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
  return `/?topicId=${encodeURIComponent(topicId)}&menu=${encodeURIComponent(menu)}`;
}

export function normalizeReturnTo(value: string | string[] | undefined): string {
  const route = readSearchParam(value)?.trim();

  if (!route || !route.startsWith('/') || route.startsWith('/auth')) {
    return '/';
  }

  return route;
}

export function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
