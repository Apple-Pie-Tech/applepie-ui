type ExpoPublicEnvName =
  | 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'
  | 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'
  | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | 'EXPO_PUBLIC_SUPABASE_URL';

export function getRequiredExpoPublicEnv(name: ExpoPublicEnvName) {
  const value = getExpoPublicEnvValue(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Set it before starting Expo.`);
  }

  return value;
}

function getExpoPublicEnvValue(name: ExpoPublicEnvName) {
  switch (name) {
    case 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    case 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY':
      return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    case 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY':
      return process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    case 'EXPO_PUBLIC_SUPABASE_URL':
      return process.env.EXPO_PUBLIC_SUPABASE_URL;
  }
}
