# Basic User Self-Management with Supabase

## TL;DR
> **Summary**: Add basic self-service account editing on top of the existing Supabase auth shell, using Supabase auth user metadata only. No separate backend app, profiles table, or admin surface.
> **Deliverables**: editable own display name/account metadata; normalized auth/profile helpers; account-screen edit/save UI; Playwright coverage for success and failure paths.
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: auth metadata contract -> auth state helper -> account UI -> browser verification

## Context
### Original Request
Plan out basic user self-management using Supabase.

### Interview Summary
- The app already has Supabase auth, session persistence, sign out, and an `/account` screen.
- There is no profile/settings/admin/invite/role management surface in the repo.
- Scope is approved as **basic self-service only**.

### Metis Review (gaps addressed)
- Locked the MVP to user-owned self-service only.
- Chose Supabase auth metadata as the source of truth to avoid a separate backend or schema migration.
- Added explicit loading/error/session-expiry behavior and Playwright acceptance criteria.

## Work Objectives
### Core Objective
Let signed-in users manage a small set of their own account fields from the existing account tab, using Supabase auth metadata and the current Expo client.

### Deliverables
- Editable display name stored in Supabase auth user metadata.
- Normalized profile/account helpers in auth state.
- Updated account screen with save/cancel/loading/error states.
- Verification coverage for happy path and failure path.

### Definition of Done (verifiable conditions with commands)
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test:playwright-ui` passes.
- Signed-in user can edit and persist their own display name.
- Logged-out gating still routes protected actions through existing auth flow.

### Must Have
- Supabase-only implementation.
- Self-service only; own account data only.
- No new backend app.
- No profiles table unless later requested.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No admin/team/invite/role features.
- No billing-management expansion.
- No separate server app or service-role backend.
- No broad settings hub rewrite.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after, using Playwright browser verification plus type/lint checks.
- QA policy: every task has agent-executed success and failure scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. This scope is small, so use 2 waves with tight dependencies.

Wave 1: auth metadata contract + auth state helpers
Wave 2: account UI, auth-flow hardening, browser verification

### Dependency Matrix (full, all tasks)
- 1 -> 2, 3, 4
- 2 -> 3, 4
- 3 -> 4
- 4 -> none

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → `deep`, `quick`
- Wave 2 → 2 tasks → `quick`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Normalize Supabase auth metadata for self-service fields

  **What to do**: Define the MVP editable account field as a user-owned display name stored in Supabase auth user metadata. Add a normalized profile helper that reads `user_metadata` with fallback order (`display_name` -> `full_name` -> `name` -> email). Add an update helper that calls `supabase.auth.updateUser({ data: ... })` for the current user.

  **Must NOT do**: Do not create a profiles table, Edge Function, or separate backend. Do not add admin-only fields.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the key data-contract decision that everything else depends on.
  - Skills: [`systematic-debugging`] - helps validate auth/session edge cases.
  - Omitted: [`supabase-postgres-best-practices`] - no SQL schema work in this plan.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4 | Blocked By: none

  **References**:
  - `src/lib/supabase.ts:13-34` - current client/session setup and `getSupabaseAuthState`.
  - `src/features/auth/auth-state.tsx:22-185` - existing auth context shape and session/user exposure.
  - `src/features/auth/account-screen.tsx:33-180` - current account UI that will consume the new helper.

  **Acceptance Criteria**:
  - [ ] Auth state exposes a stable, normalized display-name value for the current user.
  - [ ] A helper exists to update the current user’s own metadata through Supabase auth.
  - [ ] Missing metadata falls back cleanly to existing identity fields.

  **QA Scenarios**:
  ```
  Scenario: Happy path metadata normalization
    Tool: Bash
    Steps: Run typecheck and inspect the auth helper contract against a signed-in session shape with only email/name metadata.
    Expected: The normalized display name resolves to the first available metadata field and typecheck passes.
    Evidence: .sisyphus/evidence/task-1-normalize-metadata.txt

  Scenario: Failure path auth mutation rejected
    Tool: Bash
    Steps: Simulate a rejected updateUser response in the helper test path and confirm the helper surfaces a readable error.
    Expected: The helper does not silently succeed and preserves the existing identity value.
    Evidence: .sisyphus/evidence/task-1-normalize-metadata-error.txt
  ```

  **Commit**: YES | Message: `feat(auth): normalize account metadata` | Files: `src/lib/supabase.ts`, `src/features/auth/auth-state.tsx`

- [x] 2. Expose editable account state from auth context

  **What to do**: Extend the existing `AuthProvider` to surface the normalized account profile and an `updateProfile` action. Keep sign-out behavior unchanged. Make sure profile state clears on sign-out and rehydrates after session restore.

  **Must NOT do**: Do not introduce a second state store or duplicate session ownership.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: this is a contained auth-state refactor.
  - Skills: [`systematic-debugging`] - validate session load / reset behavior.
  - Omitted: [`supabase-postgres-best-practices`] - no DB changes.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 4 | Blocked By: 1

  **References**:
  - `src/features/auth/auth-state.tsx:22-185` - current context and sign-out plumbing.
  - `src/app/_layout.tsx:10-24` - provider wiring at the root.
  - `src/app/auth.tsx:30-255` - auth screen return-to handling that must remain intact.

  **Acceptance Criteria**:
  - [ ] `useAuth()` exposes the current editable profile plus an update action.
  - [ ] Sign-out still resolves through the existing Supabase flow.
  - [ ] Session restore rehydrates profile state without extra navigation.

  **QA Scenarios**:
  ```
  Scenario: Happy path session rehydrate
    Tool: Bash
    Steps: Start the app with a primed signed-in session and verify the account context exposes the same normalized profile after refresh.
    Expected: The profile remains available and sign-out still works.
    Evidence: .sisyphus/evidence/task-2-auth-context.txt

  Scenario: Failure path stale session
    Tool: Bash
    Steps: Clear the stored session before reload and confirm the context resolves to signed-out state.
    Expected: Profile data is cleared and no protected state lingers.
    Evidence: .sisyphus/evidence/task-2-auth-context-error.txt
  ```

  **Commit**: YES | Message: `feat(auth): expose editable self-service state` | Files: `src/features/auth/auth-state.tsx`, `src/app/_layout.tsx`

- [x] 3. Build the self-service account edit UI

  **What to do**: Update the `/account` experience to edit the signed-in user’s display name inline, with save/cancel/loading/error states. Keep identity, subscription, restore purchases, and sign-out visible. Preserve the signed-out CTA and existing copy where possible.

  **Must NOT do**: Do not turn the screen into a full settings hub. Do not add unrelated preferences or admin tools.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: limited to one screen and its local interaction states.
  - Skills: [`frontend-design`] - maintain a clean, app-native account surface.
  - Omitted: [`supabase-postgres-best-practices`] - no schema work here.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4 | Blocked By: 2

  **References**:
  - `src/features/auth/account-screen.tsx:33-428` - current account UI and layout structure.
  - `src/app/(tabs)/account.tsx:1-7` - account route entry.
  - `src/components/app-tabs.tsx:37-68` - native tab entry for Account.
  - `src/components/app-tabs.web.tsx:30-62` - web tab entry for Account.

  **Acceptance Criteria**:
  - [ ] Signed-in user can edit and save their display name from `/account`.
  - [ ] Save/cancel/loading/error states are visible and unambiguous.
  - [ ] Signed-out users still see the sign-in CTA.

  **QA Scenarios**:
  ```
  Scenario: Happy path edit and save
    Tool: Playwright
    Steps: Prime a signed-in session, open /account, change the display name field, click save, and verify the updated value remains after reload.
    Expected: The new name is visible immediately after save and persists on refresh.
    Evidence: .sisyphus/evidence/task-3-account-ui.png

  Scenario: Failure path save rejected
    Tool: Playwright
    Steps: Mock the Supabase updateUser response as a failure, submit the form, and inspect the inline error message.
    Expected: The screen shows a readable error and the previous value remains intact.
    Evidence: .sisyphus/evidence/task-3-account-ui-error.png
  ```

  **Commit**: YES | Message: `feat(account): add self-service profile edit` | Files: `src/features/auth/account-screen.tsx`, `src/app/(tabs)/account.tsx`

- [x] 4. Harden auth-flow behavior for self-service actions

  **What to do**: Keep the existing auth redirect model intact while ensuring the new self-service action respects session state, loading state, and return-to behavior. If a save action runs without a valid session, block it or route back to `/auth` using the current flow helpers. Preserve the existing recording-send and podcast-generate gates.

  **Must NOT do**: Do not alter unrelated tab behavior or add a separate auth route.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is about preserving cross-route auth semantics.
  - Skills: [`systematic-debugging`] - validate redirect and session-expiry edge cases.
  - Omitted: [`frontend-design`] - the visual layer is already handled in task 3.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: 2, 3

  **References**:
  - `src/app/auth.tsx:30-255` - Google OAuth route and return-to logic.
  - `src/features/auth/auth-flow.ts:1-41` - redirect helpers and auth reasons.
  - `src/components/app-tabs.tsx:176-245` - native gated send flow.
  - `src/components/app-tabs.web.tsx:201-312` - web gated send flow.

  **Acceptance Criteria**:
  - [ ] Logged-out self-service action cannot bypass the auth gate.
  - [ ] Session-expiry or missing-session cases fail safely with a visible message.
  - [ ] Existing recording and generation auth gates continue to use the same redirect model.

  **QA Scenarios**:
  ```
  Scenario: Happy path gated navigation remains intact
    Tool: Playwright
    Steps: Start logged out, trigger a protected action, and confirm the app routes to /auth with a return-to value.
    Expected: The auth screen opens and the original destination is preserved.
    Evidence: .sisyphus/evidence/task-4-auth-flow.png

  Scenario: Failure path expired session on save
    Tool: Playwright
    Steps: Expire the stored session, attempt to save the account edit, and confirm the UI blocks the request or shows a session error.
    Expected: No silent success and no state corruption.
    Evidence: .sisyphus/evidence/task-4-auth-flow-error.png
  ```

  **Commit**: YES | Message: `fix(auth): preserve self-service gating` | Files: `src/app/auth.tsx`, `src/features/auth/auth-flow.ts`, `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`

- [x] 5. Add browser verification for self-service success and failure

  **What to do**: Extend the existing Playwright browser suite to cover the new account edit flow, using `primeSignedInSession` and request mocking patterns already used by the repo. Add one success path and one failure path. Keep diagnostics strict.

  **Must NOT do**: Do not rewrite the current test harness. Do not add a new runner.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: verification work needs careful end-to-end checks.
  - Skills: [`systematic-debugging`] - keeps the browser checks focused on observed failures.
  - Omitted: [`frontend-design`] - not a UI design task.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: none | Blocked By: 3, 4

  **References**:
  - `tests/browser/universe-ui.spec.ts:1-260` - existing Playwright style, diagnostics, and mock patterns.
  - `tests/browser/helpers/auth.ts:1-44` - session priming helper.
  - `package.json:5-15` - `test:playwright-ui` script used for verification.

  **Acceptance Criteria**:
  - [ ] The browser suite covers the account edit happy path.
  - [ ] The browser suite covers the account edit failure path.
  - [ ] The suite remains aligned with existing diagnostics and route-parity style.

  **QA Scenarios**:
  ```
  Scenario: Happy path browser verification
    Tool: Playwright
    Steps: Prime a signed-in session, visit /account, save a display-name change, and confirm the visible value updates.
    Expected: Playwright passes with no console/runtime errors.
    Evidence: .sisyphus/evidence/task-5-playwright-account.png

  Scenario: Failure path browser verification
    Tool: Playwright
    Steps: Mock a rejected auth update call, submit the form, and assert the inline error message.
    Expected: Playwright passes and the failure is surfaced cleanly.
    Evidence: .sisyphus/evidence/task-5-playwright-account-error.png
  ```

  **Commit**: YES | Message: `test(account): cover self-service flows` | Files: `tests/browser/universe-ui.spec.ts`, `tests/browser/helpers/auth.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: auth metadata normalization + auth state exposure.
- Commit 2: account UI + auth-flow hardening + browser tests.
- Keep commits small and vertical; no mixed refactors.

## Success Criteria
- Signed-in users can update their own display name from the existing account tab.
- Supabase auth remains the only backend dependency for self-service.
- No new admin/team/invite/settings surface is introduced.
- All verification commands pass and the new browser coverage is stable.
