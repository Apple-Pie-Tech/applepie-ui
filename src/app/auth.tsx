import type { EmailOtpType } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
const APPLE_ORANGE_SOFT = 'rgba(255, 150, 92, 0.12)';
const ERROR = '#ffb4b4';

const RECOVERY_TYPES = new Set<EmailOtpType>(['email', 'invite', 'magiclink', 'recovery']);

type RecoveryState = 'idle' | 'sending' | 'sent' | 'verifying';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    reason?: string | string[];
    returnTo?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
  }>();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<RecoveryState>('idle');

  const returnTo = normalizeReturnTo(params.returnTo);
  const reason = readSearchParam(params.reason) as AuthReason | undefined;
  const tokenHash = readSearchParam(params.token_hash);
  const recoveryType = readSearchParam(params.type);
  const title = useMemo(() => getTitle(reason), [reason]);
  const description = useMemo(() => getDescription(reason), [reason]);
  const returnLabel = returnTo === '/record' ? 'Record' : 'Universe';

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    router.replace(returnTo as Href);
  }, [isAuthenticated, returnTo, router]);

  useEffect(() => {
    if (!tokenHash) {
      return;
    }

    if (!isRecoveryType(recoveryType)) {
      setError('This sign-in link is missing recovery details. Request a fresh link.');
      return;
    }

    let cancelled = false;
    setState('verifying');
    setError(null);
    setMessage('Finishing your sign-in…');

    void supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: recoveryType })
      .then(async ({ data, error: verifyError }) => {
        if (cancelled) {
          return;
        }

        if (verifyError) {
          setError(verifyError.message);
          setMessage(null);
          setState('idle');
          return;
        }

        if (data.session?.access_token && data.session.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (cancelled) {
            return;
          }

          if (sessionError) {
            setError(sessionError.message);
            setMessage(null);
            setState('idle');
            return;
          }
        }

        setMessage('Signed in. Taking you back…');
        setState('sent');
        router.replace(returnTo as Href);
      })
      .catch((verifyError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(verifyError instanceof Error ? verifyError.message : 'We could not finish the sign-in link.');
        setMessage(null);
        setState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [recoveryType, tokenHash]);

  const handleEmailLink = async () => {
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail) {
      setError('Enter an email address first.');
      return;
    }

    setState('sending');
    setError(null);
    setMessage(null);

    const emailRedirectTo = Linking.createURL('/auth', {
      queryParams: {
        reason,
        returnTo,
      },
    });

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: {
        emailRedirectTo,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setMessage(null);
      setState('idle');
      return;
    }

    setMessage('Check your inbox for a sign-in link, then open it on this device to continue.');
    setState('sent');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glow} />
      <View style={styles.panelWrap}>
        <View style={styles.panel}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ID</Text>
          </View>

          <Text style={styles.kicker}>Email pass</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.inputCard}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255, 244, 227, 0.36)"
              selectionColor={APPLE_ORANGE}
              style={styles.input}
              value={email}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={state === 'sending' || state === 'verifying'}
            onPress={() => {
              void handleEmailLink();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              (state === 'sending' || state === 'verifying') && styles.buttonDisabled,
              pressed && state !== 'sending' && state !== 'verifying' && styles.pressed,
            ]}>
            {state === 'sending' || state === 'verifying' ? (
              <ActivityIndicator color={SPACE} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Email me a sign-in link</Text>
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

function getDescription(reason: AuthReason | undefined) {
  if (reason === 'recording-send') {
    return 'We’ll email a secure link, then bring you straight back so you can finish sending this recording.';
  }

  if (reason === 'podcast-generate') {
    return 'We’ll email a secure link, then reopen your generation panel so you can kick off the podcast right away.';
  }

  return 'We’ll email a secure link. New Apple Pie accounts are created automatically on first sign-in.';
}

function getTitle(reason: AuthReason | undefined) {
  if (reason === 'recording-send') {
    return 'Sign in to send this recording';
  }

  if (reason === 'podcast-generate') {
    return 'Sign in to generate this podcast';
  }

  return 'Sign in with email';
}

function isRecoveryType(value: string | undefined): value is EmailOtpType {
  return Boolean(value && RECOVERY_TYPES.has(value as EmailOtpType));
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
  input: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '600',
    paddingBottom: Platform.OS === 'web' ? 12 : 14,
    paddingTop: Platform.OS === 'web' ? 12 : 14,
  },
  inputCard: {
    backgroundColor: APPLE_ORANGE_SOFT,
    borderColor: 'rgba(255, 244, 227, 0.12)',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
  label: {
    color: MUTED,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
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
