import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-state';
import { getRevenueCatEntitlementState, restoreRevenueCatPurchases } from '@/lib/revenuecat';

const SPACE = '#03050c';
const PANEL = 'rgba(8, 12, 23, 0.94)';
const TEXT = '#fff4e3';
const MUTED = 'rgba(255, 244, 227, 0.62)';
const BORDER = 'rgba(255, 244, 227, 0.12)';
const APPLE_ORANGE = '#ff965c';
const APPLE_ORANGE_SOFT = 'rgba(255, 150, 92, 0.12)';
const ERROR = '#ffb4b4';
const SUCCESS = '#bff3ca';

type Notice = {
  message: string;
  tone: 'default' | 'error';
};

export function AccountScreen() {
  const router = useRouter();
  const { activeEntitlements, entitlementStatus, isAuthenticated, isBillingReady, signOut, user } = useAuth();
  const [actionState, setActionState] = useState<'idle' | 'restoring' | 'signing-out'>('idle');
  const [notice, setNotice] = useState<Notice | null>(null);

  const identityLabel = user?.email ?? user?.phone ?? user?.id ?? 'Unknown user';
  const accountHref: Href = useMemo(
    () => ({
      pathname: '/auth',
      params: { returnTo: '/account' },
    }),
    [],
  );
  const subscriptionLabel = useMemo(() => {
    if (Platform.OS === 'web') {
      return 'Subscription sync is available in native builds.';
    }

    if (!isBillingReady || entitlementStatus === 'unknown') {
      return 'Checking subscription…';
    }

    if (entitlementStatus === 'entitled') {
      return 'Active subscription found.';
    }

    return 'No active subscription found.';
  }, [entitlementStatus, isBillingReady]);

  const handleRestore = async () => {
    if (Platform.OS === 'web') {
      return;
    }

    setActionState('restoring');
    setNotice(null);

    try {
      const { customerInfo } = await restoreRevenueCatPurchases();
      const restoredEntitlements = getRevenueCatEntitlementState(customerInfo).activeEntitlements;
      setNotice({
        message:
          restoredEntitlements.length > 0
            ? `Restore complete. ${restoredEntitlements.join(', ')} is now active.`
            : 'Restore finished. No active purchases were found for this store account.',
        tone: 'default',
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'We could not restore purchases right now.',
        tone: 'error',
      });
    } finally {
      setActionState('idle');
    }
  };

  const handleSignOut = async () => {
    setActionState('signing-out');
    setNotice(null);

    try {
      await signOut();
      setNotice({ message: 'Signed out. Use the same email pass to return any time.', tone: 'default' });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'We could not sign you out right now.',
        tone: 'error',
      });
    } finally {
      setActionState('idle');
    }
  };

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.glow} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AC</Text>
          </View>

          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>{isAuthenticated ? 'Signed in' : 'Sign in to manage access'}</Text>
          <Text style={styles.description}>
            {isAuthenticated
              ? 'Check your identity, entitlement state, and purchase recovery from the same shell.'
              : 'Use your email pass to view subscription status, restore purchases, and sign out later.'}
          </Text>

          {isAuthenticated ? (
            <>
              <View style={styles.card}>
                <InfoRow label="Email" value={identityLabel} />
                <InfoRow label="User ID" mono value={user?.id ?? 'Unavailable'} />
              </View>

              <View style={styles.card}>
                <InfoRow label="Subscription" value={subscriptionLabel} />
                <InfoRow
                  label="Entitlements"
                  mono
                  value={activeEntitlements.length > 0 ? activeEntitlements.join(', ') : 'None active'}
                />
                {Platform.OS === 'web' ? (
                  <Text style={styles.meta}>Restore purchases is only available in native builds.</Text>
                ) : null}
              </View>

              <View style={styles.actionsRow}>
                <ActionButton
                  disabled={actionState !== 'idle' || Platform.OS === 'web'}
                  label="Restore purchases"
                  loading={actionState === 'restoring'}
                  onPress={() => {
                    void handleRestore();
                  }}
                  variant="secondary"
                />
                <ActionButton
                  disabled={actionState !== 'idle'}
                  label="Sign out"
                  loading={actionState === 'signing-out'}
                  onPress={() => {
                    void handleSignOut();
                  }}
                  variant="primary"
                />
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Signed out</Text>
              <Text style={styles.emptyBody}>
                Public browsing stays open. Sign in only when you want account or subscription controls.
              </Text>
              <ActionButton
                disabled={false}
                label="Sign in with email"
                onPress={() => {
                  router.push(accountHref);
                }}
                variant="primary"
              />
            </View>
          )}

          {notice ? (
            <View style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeDefault]}>
              <Text style={[styles.noticeText, notice.tone === 'error' ? styles.noticeTextError : null]}>
                {notice.message}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={3} style={[styles.infoValue, mono ? styles.infoValueMono : null]}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  loading = false,
  onPress,
  variant,
}: {
  disabled: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  variant: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !(disabled || loading) && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? SPACE : TEXT} size="small" />
      ) : (
        <Text style={[styles.buttonText, variant === 'primary' ? styles.primaryButtonText : null]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'column',
    gap: Spacing.two,
    width: '100%',
  },
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
  button: {
    alignItems: 'center',
    borderRadius: 18,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.44,
  },
  buttonText: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(255, 244, 227, 0.04)',
    borderColor: BORDER,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    padding: Spacing.three,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  description: {
    color: MUTED,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: Spacing.three,
  },
  emptyBody: {
    color: MUTED,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 22,
    fontWeight: '700',
  },
  glow: {
    backgroundColor: APPLE_ORANGE_SOFT,
    borderRadius: 240,
    height: 260,
    opacity: 0.9,
    position: 'absolute',
    right: -40,
    top: 72,
    width: 260,
  },
  infoLabel: {
    color: MUTED,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  infoRow: {
    gap: Spacing.one,
  },
  infoValue: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  infoValueMono: {
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  kicker: {
    color: APPLE_ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: Spacing.one,
    textTransform: 'uppercase',
  },
  meta: {
    color: MUTED,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: Spacing.one,
  },
  notice: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    width: '100%',
  },
  noticeDefault: {
    backgroundColor: 'rgba(191, 243, 202, 0.08)',
    borderColor: 'rgba(191, 243, 202, 0.2)',
  },
  noticeError: {
    backgroundColor: 'rgba(255, 180, 180, 0.08)',
    borderColor: 'rgba(255, 180, 180, 0.24)',
  },
  noticeText: {
    color: SUCCESS,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  noticeTextError: {
    color: ERROR,
  },
  panel: {
    backgroundColor: PANEL,
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 680,
    padding: Spacing.four,
    width: '100%',
  },
  pressed: {
    opacity: 0.82,
  },
  primaryButton: {
    backgroundColor: APPLE_ORANGE,
  },
  primaryButtonText: {
    color: SPACE,
  },
  screen: {
    backgroundColor: SPACE,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 244, 227, 0.08)',
    borderColor: 'rgba(255, 244, 227, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 40,
    marginBottom: Spacing.two,
  },
});
