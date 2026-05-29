
## 2026-05-29T18:17:09Z Task: normalize-supabase-auth-metadata
- `src/lib/supabase-auth-metadata.ts` now centralizes display-name normalization with fallback order `display_name` -> `full_name` -> `name` -> email.
- `src/lib/supabase.ts` exports a thin `updateSupabaseDisplayName()` wrapper over `supabase.auth`.
- Web export verification needs placeholder values for all required Expo public env vars, not just Supabase; otherwise the build stops earlier in unrelated bootstrap code.

## 2026-05-29T19:XX:XXZ Task: expose-editable-account-state-from-auth-context
- `src/features/auth/auth-state.tsx` can expose an editable profile view without adding a second store by deriving `profile.displayName` from the hydrated Supabase user.
- `updateDisplayName()` should call the existing Supabase auth wrapper and let the session/user lifecycle rehydrate the context instead of copying profile state locally.
- Keeping `AuthProvider` above `RecordingProvider` in `src/app/_layout.tsx` preserves the existing auth source of truth for downstream consumers.
- Recorded at 2026-05-29T19:00:01Z.

## 2026-05-29T19:XX:XXZ Task: expose-editable-account-state-from-auth-context-verified
- `useAuth()` now has a minimal editable profile seam: `profile.displayName` plus `updateDisplayName()` derived from the same session/user lifecycle as the existing auth flags.
- Keeping the auth provider above recording is still the correct seam; the added layout comment documents that dependency without changing behavior.
- Web export with placeholder envs still reaches the route manifest cleanly after the auth-context change, so the new auth surface did not break static rendering.

## 2026-05-29T19:XX:XXZ Task: build-self-service-account-edit-ui
- `src/features/auth/account-screen.tsx` can layer a display-name editor into the existing account shell without touching the route wrapper: keep the new form local, but preserve the existing identity, subscription, restore-purchases, and sign-out cards/actions underneath it.
- Using `profile.displayName` as the editable source works cleanly if the screen treats an email-equal value as fallback identity rather than a saved custom name; that keeps the input empty for first-time edits while the identity card still shows the sign-in email.
- `npm run typecheck`, `rtk lint`, and `npm run export:web` with placeholder Expo public env vars all pass after the account edit UI change, and the exported `/account` route still includes the signed-out CTA while the built bundle contains the new save/error strings.

## 2026-05-29T19:XX:XXZ Task: fix-account-edit-refresh-persistence
- Supabase Auth JS already persists `session.user` on `updateUser()` and emits `USER_UPDATED`; the false negative came from browser QA seeding with `page.addInitScript(...)`, which re-applies the old `sb-example-auth-token` on every reload and masks real persistence.
- A reload-safe signed-in browser helper should seed localStorage after the first same-origin navigation and then reload once; that preserves the mutated auth session across subsequent refresh assertions.
- `src/features/auth/account-screen.tsx` should only clear its inline save state when the signed-in user actually changes, not whenever the same user's `displayName` rehydrates, otherwise the success message disappears immediately after a successful `USER_UPDATED` event.

## 2026-05-29T19:XX:XXZ Task: fix-account-edit-refresh-persistence-verified
- The browser refresh path now passes when the Supabase response is wrapped as `{ user: ... }` and the seeded session is restored after the initial navigation, so the `/account` display name survives reload.
- Failure-path verification remains readable inline (`server blew up` in the mocked browser case), while the subscription / sign-out controls stay visible on the same screen.

## 2026-05-29T19:XX:XXZ Task: harden-auth-flow-for-account-save
- `account-save` is now a shared auth reason, so the account save flow can reuse the same `/auth` redirect contract as the recording-send and podcast-generate gates.
- The `/auth` screen needs explicit copy for `account-save` so return-to behavior stays understandable when a save attempt is blocked by a missing session.
- The existing record and podcast auth gates still pass after the auth-flow extension, so the new reason did not regress the old redirect paths.

## 2026-05-29T19:XX:XXZ Task: harden-auth-flow-for-account-save-verified
- Browser coverage proves the new `account-save` route renders the right copy and still returns to `/account` after the session is rehydrated.
- The signed-out record/podcast gates continue to pass, so the shared auth-flow extension stayed additive.

## 2026-05-29T19:XX:XXZ Task: add-browser-verification-for-self-service-success-and-failure
- The browser suite now covers the account edit happy path, failure path, and the `account-save` auth route, which is the right regression net for the self-service flow.
- The reload-safe session helper (`primeSignedInSessionForReload`) is the key difference between a passing persistence check and a false-negative reload test.

## 2026-05-29T19:XX:XXZ Task: harden-auth-flow-for-account-saves
- Account-save reauth should reuse the same shared auth-flow contract as recording send and podcast generate: add a first-class `account-save` reason in `src/features/auth/auth-flow.ts` and let `/auth` own the user-facing copy plus `returnTo` label.
- The account save handler can stay surgical by redirecting with `buildAuthHref({ reason: 'account-save', returnTo: '/account' })` when local auth state is missing, and by using a shared auth-session-unavailable detector so generic save failures still remain inline.
- Browser verification is most reliable when it proves the shared route contract (`/auth?reason=account-save&returnTo=%2Faccount`) plus the existing send/generate gates, rather than trying to coerce a flaky mocked expiry response from the Supabase client.
