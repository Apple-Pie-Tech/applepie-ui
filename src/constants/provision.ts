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

// Sent as `x-api-key` on POST /podcasts, which the API gates because each call
// spends Bedrock and Polly budget. Optional: the API skips the check when its
// own key is unset, which is how local development works.
//
// Like every EXPO_PUBLIC_* value this is inlined into the client bundle and is
// therefore readable by anyone who loads the site. It deters drive-by abuse of a
// discovered function URL; it is not authentication.
export const provisionApiKey = process.env.EXPO_PUBLIC_PROVISION_API_KEY?.trim() || null;

export function getProvisionEndpoint(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${provisionApiUrl}${normalizedPath}`;
}
