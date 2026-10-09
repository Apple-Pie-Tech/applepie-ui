import { supabase } from '@/lib/supabase';

/**
 * Thrown when there is no usable Supabase session to authenticate a request.
 *
 * The name is load-bearing: `isAuthSessionUnavailableError` in ./auth-flow.ts
 * matches on `error.name === 'AuthSessionMissingError'`, which is how callers
 * route the user to the sign-in screen instead of showing a raw message. Do not
 * rename it without changing that matcher.
 */
export class AuthSessionMissingError extends Error {
  name = 'AuthSessionMissingError';
}

/**
 * The current Supabase access token, refreshing it first if it has expired.
 *
 * `getSession()` rather than `getUser()` on purpose. getSession reads the
 * persisted session from storage and only goes to the network when the access
 * token has actually expired, in which case supabase-js exchanges the refresh
 * token and hands back a fresh one. getUser() would be a round trip on every
 * API call. The practical consequence is that a token which expired while the
 * tab sat open is renewed here and never reaches the server -- the sign-in
 * redirect is for the case where the *refresh* token is dead too.
 */
export async function getSupabaseAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new AuthSessionMissingError(error.message);
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new AuthSessionMissingError('Auth session missing');
  }

  return token;
}

/**
 * Request headers carrying the bearer token, merged with anything extra.
 *
 * The `x-api-key` the callers still pass is a transitional second factor: it is
 * an EXPO_PUBLIC_* value inlined into this bundle, so every visitor has it and
 * it authenticates nobody. The bearer token is the one the API verifies.
 */
export async function buildAuthHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getSupabaseAccessToken();

  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}
