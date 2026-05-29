import type { Session, User } from '@supabase/supabase-js';
import type { CustomerInfo } from 'react-native-purchases';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { addRevenueCatCustomerInfoUpdateListener, getRevenueCatEntitlementState, syncRevenueCatCustomerInfo } from '@/lib/revenuecat';
import { getSupabaseAuthState, getSupabaseDisplayName, supabase, updateSupabaseDisplayName } from '@/lib/supabase';

export type EntitlementStatus = 'unknown' | 'signed-out' | 'not-entitled' | 'entitled';

type EditableProfile = {
  displayName: string | null;
};

type AuthContextValue = {
  activeEntitlements: string[];
  displayName: string | null;
  entitlementStatus: EntitlementStatus;
  isAuthenticated: boolean;
  isBillingReady: boolean;
  profile: EditableProfile;
  session: Session | null;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeEntitlements, setActiveEntitlements] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [hasResolvedSession, setHasResolvedSession] = useState(false);
  const [entitlementStatus, setEntitlementStatus] = useState<EntitlementStatus>('unknown');
  const [isBillingReady, setIsBillingReady] = useState(false);
  const billingRequestIdRef = useRef(0);

  const user = session?.user ?? null;
  const authState = useMemo(() => getSupabaseAuthState(session), [session]);
  const displayName = useMemo(() => getSupabaseDisplayName(user), [user]);
  const profile = useMemo(
    () => ({
      displayName,
    }),
    [displayName],
  );
  const authStateRef = useRef(authState);
  authStateRef.current = authState;

  const applyEntitlementState = useCallback((isSignedIn: boolean, customerInfo: CustomerInfo | null | undefined) => {
    if (!isSignedIn) {
      setActiveEntitlements([]);
      setEntitlementStatus('signed-out');
      return;
    }

    const revenueCatState = getRevenueCatEntitlementState(customerInfo);
    setActiveEntitlements(revenueCatState.activeEntitlements);
    setEntitlementStatus(revenueCatState.isEntitled ? 'entitled' : 'not-entitled');
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

  const updateDisplayName = useCallback(async (nextDisplayName: string) => {
    await updateSupabaseDisplayName(nextDisplayName);
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setHasResolvedSession(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[auth] failed to hydrate Supabase session', error);
          applySession(null);
          return;
        }

        applySession(data.session ?? null);
      })
      .catch((error) => {
        console.warn('[auth] failed to hydrate Supabase session', error);
        applySession(null);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasResolvedSession) {
      return;
    }

    let active = true;
    const requestId = billingRequestIdRef.current + 1;
    billingRequestIdRef.current = requestId;

    setIsBillingReady(false);
    setActiveEntitlements([]);
    setEntitlementStatus(authState.isSignedIn ? 'unknown' : 'signed-out');

    void syncRevenueCatCustomerInfo(authState.userId)
      .then(({ customerInfo }) => {
        if (!active || billingRequestIdRef.current !== requestId) {
          return;
        }

        applyEntitlementState(authState.isSignedIn, customerInfo);
        setIsBillingReady(true);
      })
      .catch((error) => {
        if (!active || billingRequestIdRef.current !== requestId) {
          return;
        }

        console.warn('[auth] failed to sync RevenueCat customer info', error);
        applyEntitlementState(authState.isSignedIn, null);
        setIsBillingReady(true);
      });

    return () => {
      active = false;
    };
  }, [applyEntitlementState, authState.isSignedIn, authState.userId, hasResolvedSession]);

  useEffect(() => {
    if (!hasResolvedSession || !isBillingReady) {
      return;
    }

    let active = true;
    let unsubscribe = () => {};

    void addRevenueCatCustomerInfoUpdateListener((customerInfo) => {
      if (!active) {
        return;
      }

      applyEntitlementState(authStateRef.current.isSignedIn, customerInfo);
      setIsBillingReady(true);
    }).then((nextUnsubscribe) => {
      if (!active) {
        nextUnsubscribe();
        return;
      }

      unsubscribe = nextUnsubscribe;
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyEntitlementState, hasResolvedSession, isBillingReady]);

  const value = useMemo(
    () => ({
      activeEntitlements,
      displayName,
      entitlementStatus,
      isAuthenticated: authState.isSignedIn,
      isBillingReady,
      profile,
      session,
      signOut,
      updateDisplayName,
      user,
    }),
    [
      activeEntitlements,
      authState.isSignedIn,
      displayName,
      entitlementStatus,
      isBillingReady,
      profile,
      session,
      signOut,
      updateDisplayName,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
