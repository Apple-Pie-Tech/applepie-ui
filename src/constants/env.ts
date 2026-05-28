export function getRequiredExpoPublicEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Set it before starting Expo.`);
  }

  return value;
}
