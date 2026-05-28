import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getRequiredExpoPublicEnv } from '@/constants/env';

export const supabaseUrl = getRequiredExpoPublicEnv('EXPO_PUBLIC_SUPABASE_URL');
export const supabasePublishableKey = getRequiredExpoPublicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const supabaseStorage = Platform.OS === 'web' ? createWebStorage() : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: supabaseStorage,
    persistSession: true,
  },
});

export type SupabaseAuthState = {
  expiresAt: number | null;
  isSignedIn: boolean;
  userId: string | null;
};

export function getSupabaseAuthState(session: Session | null | undefined): SupabaseAuthState {
  return {
    expiresAt: session?.expires_at ?? null,
    isSignedIn: Boolean(session?.user),
    userId: session?.user.id ?? null,
  };
}

function createWebStorage() {
  const memoryStorage = new Map<string, string>();

  return {
    getItem(key: string) {
      if (typeof window === 'undefined') {
        return Promise.resolve(memoryStorage.get(key) ?? null);
      }

      return Promise.resolve(window.localStorage.getItem(key));
    },
    removeItem(key: string) {
      if (typeof window === 'undefined') {
        memoryStorage.delete(key);
        return Promise.resolve();
      }

      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
    setItem(key: string, value: string) {
      if (typeof window === 'undefined') {
        memoryStorage.set(key, value);
        return Promise.resolve();
      }

      window.localStorage.setItem(key, value);
      return Promise.resolve();
    },
  };
}
