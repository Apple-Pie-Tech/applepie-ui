import { Platform } from 'react-native';
import type { CustomerInfo, CustomerInfoUpdateListener } from 'react-native-purchases';

import { getRequiredExpoPublicEnv } from '@/constants/env';

export type RevenueCatBootstrapState = {
  appUserId: string | null;
  configured: boolean;
  platform: 'android' | 'ios' | 'web';
};

export type RevenueCatEntitlementState = {
  activeEntitlements: string[];
  isEntitled: boolean;
};

export type RevenueCatCustomerState = RevenueCatBootstrapState & {
  customerInfo: CustomerInfo | null;
};

let configured = false;
let currentAppUserId: string | null = null;
let purchasesModulePromise: Promise<typeof import('react-native-purchases').default> | null = null;

export async function initializeRevenueCat(appUserId: string | null = null): Promise<RevenueCatBootstrapState> {
  if (Platform.OS === 'web') {
    return {
      appUserId,
      configured: false,
      platform: 'web',
    };
  }

  const Purchases = await getPurchasesModule();
  const apiKey = getRevenueCatApiKey();

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: appUserId ?? undefined });
    configured = true;
    currentAppUserId = appUserId;
  }

  return {
    appUserId: currentAppUserId,
    configured: true,
    platform: Platform.OS as RevenueCatBootstrapState['platform'],
  };
}

export async function syncRevenueCatCustomerInfo(appUserId: string | null = null): Promise<RevenueCatCustomerState> {
  const bootstrapState = await initializeRevenueCat(appUserId);

  if (!bootstrapState.configured) {
    return {
      ...bootstrapState,
      customerInfo: getWebCustomerInfoOverride(),
    };
  }

  const Purchases = await getPurchasesModule();
  let customerInfo: CustomerInfo;

  if (currentAppUserId !== appUserId) {
    customerInfo = appUserId ? (await Purchases.logIn(appUserId)).customerInfo : await Purchases.logOut();
    currentAppUserId = appUserId;
  } else {
    customerInfo = await Purchases.getCustomerInfo();
  }

  return {
    ...bootstrapState,
    appUserId: currentAppUserId,
    customerInfo,
  };
}

export async function addRevenueCatCustomerInfoUpdateListener(
  listener: CustomerInfoUpdateListener,
): Promise<() => void> {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const Purchases = await getPurchasesModule();
  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function restoreRevenueCatPurchases(): Promise<RevenueCatCustomerState> {
  const bootstrapState = await initializeRevenueCat(currentAppUserId);

  if (!bootstrapState.configured) {
    return {
      ...bootstrapState,
      appUserId: currentAppUserId,
      customerInfo: null,
    };
  }

  const Purchases = await getPurchasesModule();
  const customerInfo = await Purchases.restorePurchases();

  return {
    ...bootstrapState,
    appUserId: currentAppUserId,
    customerInfo,
  };
}

export function getRevenueCatEntitlementState(customerInfo: CustomerInfo | null | undefined): RevenueCatEntitlementState {
  const activeEntitlements = customerInfo ? Object.keys(customerInfo.entitlements.active).sort() : [];

  return {
    activeEntitlements,
    isEntitled: activeEntitlements.length > 0,
  };
}

function getRevenueCatApiKey() {
  if (Platform.OS === 'ios') {
    return getRequiredExpoPublicEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
  }

  if (Platform.OS === 'android') {
    return getRequiredExpoPublicEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
  }

  throw new Error(`RevenueCat is not supported on platform ${Platform.OS}`);
}

function getWebCustomerInfoOverride(): CustomerInfo | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem('applepie.test.activeEntitlements');
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const activeEntitlements = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    return {
      entitlements: {
        active: Object.fromEntries(activeEntitlements.map((id) => [id, { identifier: id }])),
      },
    } as CustomerInfo;
  } catch {
    return null;
  }
}

async function getPurchasesModule() {
  if (!purchasesModulePromise) {
    purchasesModulePromise = import('react-native-purchases').then((module) => module.default);
  }

  return purchasesModulePromise;
}
