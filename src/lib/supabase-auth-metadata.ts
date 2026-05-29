const DISPLAY_NAME_METADATA_KEYS = ['display_name', 'full_name', 'name'] as const;

export type SupabaseDisplayNameSource = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type SupabaseDisplayNameUpdateResult<TUser extends SupabaseDisplayNameSource> = Promise<{
  data: { user: TUser | null };
  error: Error | null;
}>;

export type SupabaseDisplayNameUpdater<TUser extends SupabaseDisplayNameSource = SupabaseDisplayNameSource> = {
  updateUser: (attributes: { data: { display_name: string } }) => SupabaseDisplayNameUpdateResult<TUser>;
};

export function getSupabaseDisplayName(user: SupabaseDisplayNameSource | null | undefined): string | null {
  const metadata = user?.user_metadata ?? null;

  for (const key of DISPLAY_NAME_METADATA_KEYS) {
    const value = normalizeDisplayName(metadata?.[key]);

    if (value) {
      return value;
    }
  }

  return normalizeDisplayName(user?.email);
}

export async function updateSupabaseDisplayNameWithAuth<TUser extends SupabaseDisplayNameSource>(
  displayName: string,
  auth: SupabaseDisplayNameUpdater<TUser>,
): Promise<TUser> {
  try {
    const { data, error } = await auth.updateUser({
      data: { display_name: displayName },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Supabase did not return the updated user.');
    }

    return data.user;
  } catch (error) {
    throw toReadableError(error, 'We could not update your display name right now.');
  }
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function toReadableError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  return new Error(fallbackMessage);
}
