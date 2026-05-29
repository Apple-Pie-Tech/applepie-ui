import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { normalizeReturnTo, readSearchParam, type AuthReason } from '@/features/auth/auth-flow';
import { useAuth } from '@/features/auth/auth-state';
import { supabase } from '@/lib/supabase';

const SPACE = '#03050c';
const PANEL = 'rgba(8, 12, 23, 0.94)';
const TEXT = '#fff4e3';
const MUTED = 'rgba(255, 244, 227, 0.62)';
const APPLE_ORANGE = '#ff965c';
const ERROR = '#ffb4b4';

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthState = 'idle' | 'starting' | 'finishing';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    reason?: string | string[];
    returnTo?: string | string[];
  }>();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<GoogleAuthState>('idle');
  const callbackUrl = Linking.useLinkingURL();

  const returnTo = normalizeReturnTo(params.returnTo);
  const reason = readSearchParam(params.reason) as AuthReason | undefined;
  const title = useMemo(() => getTitle(reason), [reason]);
  const description = useMemo(() => getDescription(reason), [reason]);
  const returnLabel = returnTo === '/record' ? 'Record' : 'Universe';
  const redirectTo = useMemo(
    () =>
      Linking.createURL('/auth', {
        queryParams: {
          reason,
          returnTo,
        },
      }),
    [reason, returnTo],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    router.replace(returnTo as Href);
  }, [isAuthenticated, returnTo, router]);

  useEffect(() => {
    if (!callbackUrl || !hasAuthCallbackParams(callbackUrl)) {
      return;
    }

    let cancelled = false;
    setState('finishing');
    setError(null);
    setMessage('Finishing your Google sign-in…');

    void createSessionFromUrl(callbackUrl)
      .then((createdSession) => {
        if (cancelled) {
          return;
        }

        if (!createdSession) {
          setState('idle');
          return;
        }

        setMessage('Signed in. Taking you back…');
        setState('idle');
        router.replace(returnTo as Href);
      })
      .catch((sessionError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(sessionError instanceof Error ? sessionError.message : 'We could not finish Google sign-in.');
        setMessage(null);
        setState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, returnTo, router]);

  const handleGoogleSignIn = async () => {
    setState('starting');
    setError(null);
    setMessage(null);

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setMessage(null);
      setState('idle');
      return;
    }

    if (!data.url) {
      setError('Google sign-in did not return a browser URL.');
      setState('idle');
      return;
    }

    const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (authResult.type === 'success') {
      try {
        setState('finishing');
        setMessage('Finishing your Google sign-in…');
        const createdSession = await createSessionFromUrl(authResult.url);

        if (createdSession) {
          setMessage('Signed in. Taking you back…');
          router.replace(returnTo as Href);
          return;
        }
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : 'We could not finish Google sign-in.');
        setMessage(null);
        setState('idle');
        return;
      }
    }

    if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
      setMessage(null);
      setState('idle');
      return;
    }

    setError('Google sign-in did not complete. Try again.');
    setMessage(null);
    setState('idle');
  };

  const isBusy = state === 'starting' || state === 'finishing';

  return (
    <View style={styles.screen}>
      <View style={styles.glow} />
      <View style={styles.panelWrap}>
        <View style={styles.panel}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ID</Text>
          </View>

          <Text style={styles.kicker}>Google sign-in</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => {
              void handleGoogleSignIn();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              isBusy && styles.buttonDisabled,
              pressed && !isBusy && styles.pressed,
            ]}>
            {isBusy ? (
              <ActivityIndicator color={SPACE} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue with Google</Text>
            )}
          </Pressable>

          <Text style={styles.returnHint}>After sign-in, you’ll land back on {returnLabel}.</Text>

          {message ? (
            <View aria-live="polite" style={styles.statusCard}>
              <Text style={styles.statusText}>{message}</Text>
            </View>
          ) : null}

          {error ? (
            <View aria-live="polite" style={[styles.statusCard, styles.errorCard]}>
              <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

async function createSessionFromUrl(url: string) {
  const params = getAuthParamsFromUrl(url);
  const errorDescription = params.get('error_description') ?? params.get('error');

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }

    return data.session;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken) {
    return null;
  }

  if (!refreshToken) {
    throw new Error('Google sign-in did not include a refresh token.');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

function getAuthParamsFromUrl(url: string) {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

  hashParams.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

function hasAuthCallbackParams(url: string) {
  try {
    const params = getAuthParamsFromUrl(url);

    return Boolean(params.get('access_token') || params.get('refresh_token') || params.get('code') || params.get('error'));
  } catch {
    return false;
  }
}

function getDescription(reason: AuthReason | undefined) {
  if (reason === 'recording-send') {
    return 'Use Google to sign in, then we’ll bring you straight back so you can finish sending this recording.';
  }

  if (reason === 'podcast-generate') {
    return 'Use Google to sign in, then we’ll reopen your generation panel so you can kick off the podcast right away.';
  }

  return 'Use Google to sign in. New Apple Pie accounts are created automatically the first time you continue.';
}

function getTitle(reason: AuthReason | undefined) {
  if (reason === 'recording-send') {
    return 'Sign in to send this recording';
  }

  if (reason === 'podcast-generate') {
    return 'Sign in to generate this podcast';
  }

  return 'Sign in with Google';
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    marginBottom: Spacing.three,
    width: 38,
  },
  badgeText: {
    color: SPACE,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  buttonDisabled: {
    opacity: 0.56,
  },
  description: {
    color: MUTED,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: Spacing.four,
  },
  errorCard: {
    borderColor: 'rgba(255, 180, 180, 0.32)',
    marginTop: Spacing.two,
  },
  errorText: {
    color: ERROR,
  },
  glow: {
    backgroundColor: 'rgba(255, 108, 61, 0.14)',
    borderRadius: 999,
    height: 240,
    left: '50%',
    marginLeft: -120,
    opacity: 0.9,
    position: 'absolute',
    top: 64,
    width: 240,
  },
  kicker: {
    color: APPLE_ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: Spacing.one,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: PANEL,
    borderColor: 'rgba(255, 244, 227, 0.13)',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 440,
    padding: Spacing.four,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 34,
    width: '100%',
  },
  panelWrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    width: '100%',
  },
  pressed: {
    opacity: 0.76,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.four,
  },
  primaryButtonText: {
    color: SPACE,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '800',
  },
  returnHint: {
    color: 'rgba(255, 244, 227, 0.48)',
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: Spacing.two,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: SPACE,
    flex: 1,
    justifyContent: 'center',
    minHeight: '100%',
    paddingVertical: Spacing.five,
    width: '100%',
  },
  statusCard: {
    backgroundColor: 'rgba(255, 246, 231, 0.07)',
    borderColor: 'rgba(255, 244, 227, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statusText: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  title: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: Spacing.two,
  },
});
