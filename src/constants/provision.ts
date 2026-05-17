export const DEFAULT_PROVISION_API_URL =
  'https://data-provision-api-trigub-tech-7a2fdbc9.koyeb.app';

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

export const provisionApiUrl = trimTrailingSlashes(
  process.env.EXPO_PUBLIC_PROVISION_API_URL?.trim() || DEFAULT_PROVISION_API_URL,
);

export function getProvisionEndpoint(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${provisionApiUrl}${normalizedPath}`;
}
