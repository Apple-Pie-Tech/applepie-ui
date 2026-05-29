function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function getRequiredProvisionApiUrl() {
  const value = process.env.EXPO_PUBLIC_PROVISION_API_URL?.trim();
  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_PROVISION_API_URL for the data provision API.');
  }

  return trimTrailingSlashes(value);
}

export const provisionApiUrl = getRequiredProvisionApiUrl();

export function getProvisionEndpoint(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${provisionApiUrl}${normalizedPath}`;
}
