# Supabase Auth + RevenueCat Integration

## TL;DR
> **Summary**: Add a lightweight auth and billing layer to the existing Expo Router shell using Supabase Auth for identity and RevenueCat for entitlements, without expanding into backend sync or web checkout work.
> **Deliverables**:
> - Supabase auth provider + session hydration
> - Sign-in / sign-up flow and minimal account screen
> - RevenueCat entitlement status + restore purchases UI
> - Canonical user identity wired into existing clients
> - Browser-safe tests, env docs, and setup notes
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3/4/5 → 6

## Context
### Original Request
Turn the chosen stack — Supabase Auth with RevenueCat — into a simple plan that can be executed, keeping the plan simple and parallelizing as much as possible.

### Interview Summary
- Stack decision is final: Supabase Auth + RevenueCat.
- Simplicity beats completeness.
- Public browsing can remain available while signed out.
- Billing is for gating premium features, not for building a broad subscription backend.

### Metis Review (gaps addressed)
- Canonical identity fixed to Supabase `user.id`.
- RevenueCat `appUserID` mirrors Supabase `user.id`.
- Sign-in methods limited to email magic link / OTP.
- Client-side entitlement gating only in this phase.
- Scope excludes backend webhooks, server validation, Apple Sign In, and web checkout.

## Work Objectives
### Core Objective
Integrate Supabase Auth and RevenueCat into the existing Expo UI so the app can authenticate users, expose a minimal account surface, and gate premium generation actions with deterministic client-side entitlement checks.

### Deliverables
- Root auth/billing service layer and provider wiring.
- Auth routes/screens for email sign-in and session recovery.
- Account tab/screen with sign out, subscription status, and restore purchases action.
- Existing recording/generation actions updated to use authenticated identity and entitlement state.
- Updated env/setup docs and browser tests.

### Definition of Done (verifiable conditions with commands)
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run export:web` passes.
- `npm run test:playwright-ui` passes with auth/billing mocks enabled.
- Signed-out users can load `/` and `/record`, but protected actions show sign-in CTA instead of silently proceeding.
- Signed-in users surface Supabase identity in the UI and API client layer.
- Entitled users can access premium generation entry points; non-entitled users see a locked/paywall state.

### Must Have
- Single canonical user ID: Supabase `user.id`.
- RevenueCat app user ID synchronized from Supabase session.
- Minimal account management only: session info, sign out, subscription status, restore purchases CTA.
- Premium gating applied to podcast generation and any future paid generation actions exposed in the same menu.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No backend webhook processor.
- No server-side entitlement validation.
- No Apple Sign In, Google Sign In, or broad OAuth expansion.
- No full profile editing/settings system.
- No web checkout or Stripe integration.
- No unrelated refactors of `UniverseScreen`, recording UI, or tab animations.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using existing Playwright + Expo lint/typecheck/export pipeline.
- QA policy: Every task includes one happy-path and one failure/edge scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation tasks
- Task 1: shared auth/billing client foundation
- Task 2: root provider and hydration shell

Wave 2: parallel product surface tasks
- Task 3: auth routes and protected action gating
- Task 4: account tab and subscription surface
- Task 5: canonical identity propagation to existing clients

Wave 3: consolidation
- Task 6: browser tests, env docs, and verification hardening

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 5, 6
- 2 blocks 3, 4, 5, 6
- 3 blocks 6
- 4 blocks 6
- 5 blocks 6
- 6 blocks final verification only

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → quick / unspecified-high
- Wave 2 → 3 tasks → quick / visual-engineering / unspecified-high
- Wave 3 → 1 task → writing

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add shared Supabase + RevenueCat foundation

  **What to do**: Install and configure the minimum client-side dependencies for Supabase Auth and RevenueCat; create a small service layer for Supabase client bootstrap, RevenueCat bootstrap, auth state helpers, and entitlement state helpers; define required `EXPO_PUBLIC_*` env variables and centralize runtime guards so missing config fails fast with clear messages.
  **Must NOT do**: Do not add server-side code, webhook endpoints, or database schema work. Do not add extra auth providers beyond email magic link / OTP.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded setup work across a few files with deterministic integration points.
  - Skills: [`systematic-debugging`] - needed to keep SDK initialization and runtime guards deterministic.
  - Omitted: [`brainstorming`] - decisions are already locked.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5, 6] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/app/_layout.tsx:1-19` - root provider seam where new auth/billing providers must be mounted.
  - Pattern: `src/constants/ingest.ts:1-15` - current env-driven constant pattern to follow.
  - Pattern: `src/constants/provision.ts:1-15` - current env-driven constant pattern to follow.
  - API/Type: `package.json:3-14` - Expo Router entry and existing verification commands.
  - External: `https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native` - Expo-compatible Supabase bootstrap reference.
  - External: `https://www.revenuecat.com/docs/getting-started/installation/expo` - Expo-compatible RevenueCat bootstrap reference.

  **Acceptance Criteria** (agent-executable only):
  - [ ] App boot code has a single import path for Supabase client creation and a single import path for RevenueCat initialization.
  - [ ] Missing auth/billing env vars produce deterministic developer-facing errors instead of silent fallbacks.
  - [ ] `npm run typecheck` passes after dependency and client-layer additions.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: foundation boots with valid config
    Tool: Bash
    Steps: run `npm run typecheck`
    Expected: command exits 0 and no unresolved SDK type/import errors remain
    Evidence: .sisyphus/evidence/task-1-foundation.txt

  Scenario: missing config fails fast
    Tool: Playwright / Bash
    Steps: start app with one required Supabase or RevenueCat env var intentionally unset; load `/`
    Expected: app surfaces a deterministic config error state/message instead of hanging or silently acting authenticated
    Evidence: .sisyphus/evidence/task-1-foundation-error.png
  ```

  **Commit**: YES | Message: `feat(auth): add supabase and revenuecat foundation` | Files: [package.json, src/app/_layout.tsx, src/constants/**, src/features/**]

- [x] 2. Add root auth and entitlement provider shell

  **What to do**: Extend the app shell to hydrate Supabase session state once, initialize RevenueCat with the canonical app user ID after auth is known, expose app-wide hooks/context for `session`, `user`, `isAuthenticated`, `entitlementStatus`, and `isBillingReady`, and keep the shell stable during first-load hydration.
  **Must NOT do**: Do not gate the whole app behind a blank loading screen. Do not introduce multiple competing auth contexts.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-cutting root-shell wiring with hydration edge cases.
  - Skills: [`vercel-react-best-practices`] - needed for clean provider composition and predictable render flow.
  - Omitted: [`frontend-design`] - styling is not the core challenge.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [3, 4, 5, 6] | Blocked By: [1]

  **References**:
  - Pattern: `src/app/_layout.tsx:1-19` - existing root composition pattern.
  - Pattern: `src/features/recording/recording-state.tsx:49-71` - current context/provider style for app-wide state.
  - Pattern: `src/features/recording/recording-state.tsx:250-353` - hook-based consumer API style to mirror.
  - Test: `tests/browser/universe-ui.spec.ts:58-123` - shell-level route and tab stability coverage that must continue to pass.

  **Acceptance Criteria**:
  - [ ] App root exposes one stable auth/entitlement context consumed by downstream UI.
  - [ ] Initial app load resolves to one of three explicit states: signed-out, signed-in-not-entitled, signed-in-entitled.
  - [ ] `npm run export:web` passes with the new provider shell.

  **QA Scenarios**:
  ```
  Scenario: hydration settles to signed-out state
    Tool: Playwright
    Steps: mock no Supabase session and no entitlement; load `/`
    Expected: page renders route shell, no crash, protected actions remain locked/sign-in gated
    Evidence: .sisyphus/evidence/task-2-provider.png

  Scenario: hydration does not flash broken UI
    Tool: Playwright
    Steps: mock delayed session resolution; load `/record`
    Expected: route stays usable and never shows both signed-in and signed-out states in the same load sequence
    Evidence: .sisyphus/evidence/task-2-provider-error.png
  ```

  **Commit**: YES | Message: `feat(auth): add root auth and entitlement providers` | Files: [src/app/_layout.tsx, src/features/**]

- [x] 3. Add auth routes and protected action gating

  **What to do**: Add minimal auth routes/screens for email sign-in/sign-up/session recovery, wire route-safe redirects or modal transitions from protected actions, and require sign-in before any mutating or premium action. Public browsing of `/` and `/record` remains allowed; protected actions are recording send, podcast generation, and account-only actions.
  **Must NOT do**: Do not force login before first render. Do not create a large onboarding flow.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded route/UI additions with clear gating rules.
  - Skills: [`frontend-design`] - needed for minimal but polished auth screens and CTAs.
  - Omitted: [`impeccable`] - overkill for a deliberately simple auth surface.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6] | Blocked By: [1, 2]

  **References**:
  - Pattern: `src/app/index.tsx:1-5` - route file style.
  - Pattern: `src/app/record.tsx:1-5` - route file style.
  - Pattern: `src/components/app-tabs.tsx:35-59` - tab registration pattern.
  - Pattern: `src/components/app-tabs.web.tsx:28-54` - web tab registration pattern.
  - Test: `tests/browser/universe-ui.spec.ts:126-191` - route parity expectations that must remain stable.
  - External: `https://supabase.com/docs/guides/auth/auth-email-passwordless` - passwordless auth reference.

  **Acceptance Criteria**:
  - [ ] Signed-out users can browse `/` and `/record` without errors.
  - [ ] Triggering recording send or podcast generation while signed out opens auth flow / CTA instead of calling the API.
  - [ ] Successful sign-in returns the user to the intended surface.

  **QA Scenarios**:
  ```
  Scenario: protected action routes to auth
    Tool: Playwright
    Steps: load `/`, open topic generation menu signed out, click `Podcast episode`
    Expected: auth screen or auth CTA appears, and no `POST /podcasts` request is made
    Evidence: .sisyphus/evidence/task-3-auth-gating.png

  Scenario: signed-out recording send is blocked cleanly
    Tool: Playwright
    Steps: load `/record` signed out, attempt send action using mocked recording-ready state
    Expected: no ingest request is sent and the UI shows a sign-in requirement state
    Evidence: .sisyphus/evidence/task-3-auth-gating-error.png
  ```

  **Commit**: YES | Message: `feat(auth): add auth routes and protected action gating` | Files: [src/app/**, src/components/**, src/features/**]

- [x] 4. Add account tab and minimal subscription management UI

  **What to do**: Add an `Account` tab/route on native and web; render signed-in account details, sign-out action, subscription status, entitlement label, and `Restore purchases` CTA; render signed-out users with a sign-in CTA instead of account content; keep the UI deliberately minimal.
  **Must NOT do**: Do not build editable profile forms, invoice history, or web billing checkout.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: small new surface that must fit the existing tab shell cleanly.
  - Skills: [`frontend-design`] - needed for a minimal, consistent account surface.
  - Omitted: [`copywriting`] - screen copy is straightforward.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6] | Blocked By: [1, 2]

  **References**:
  - Pattern: `src/components/app-tabs.tsx:35-59` - native tab shell where the new tab must be inserted.
  - Pattern: `src/components/app-tabs.web.tsx:28-54` - web tab shell where the new tab must be inserted.
  - Pattern: `src/components/app-tabs.web.tsx:56-119` - dock layout constraints to preserve.
  - Pattern: `src/features/universe/universe-screen.tsx:19-29` - existing feature imports and client usage style.
  - Test: `tests/browser/universe-ui.spec.ts:98-123` - tab shell navigation expectations to extend for a third tab.
  - External: `https://www.revenuecat.com/docs/getting-started/displaying-products/customer-center` - restore/manage customer surface reference.

  **Acceptance Criteria**:
  - [ ] Both native and web tab shells expose an `Account` destination without breaking current Universe/Record routing.
  - [ ] Signed-in account screen shows current auth identity and entitlement status.
  - [ ] Restore purchases action is visible and surfaces success/failure state.

  **QA Scenarios**:
  ```
  Scenario: account tab works signed in
    Tool: Playwright
    Steps: mock signed-in entitled user; load `/account` or click `Account`
    Expected: account screen shows user email/id, entitlement status, sign out button, and restore purchases CTA
    Evidence: .sisyphus/evidence/task-4-account.png

  Scenario: restore purchases failure is safe
    Tool: Playwright
    Steps: mock RevenueCat restore failure; click `Restore purchases`
    Expected: UI stays interactive and shows a deterministic error message
    Evidence: .sisyphus/evidence/task-4-account-error.png
  ```

  **Commit**: YES | Message: `feat(account): add account tab and subscription status` | Files: [src/app/**, src/components/**, src/features/**]

- [x] 5. Propagate canonical identity and entitlement checks into existing clients

  **What to do**: Replace the local device-derived identity path in ingest and any premium-triggering flows with the authenticated Supabase `user.id`, keeping a signed-out fallback path that blocks protected actions before requests leave the client. Ensure RevenueCat entitlements gate podcast generation before `POST /podcasts` and any future paid generation options in the same action menu.
  **Must NOT do**: Do not change unrelated request payload shapes beyond the `user_id` source and protected-action checks.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: touches live request paths and must preserve existing API behavior.
  - Skills: [`systematic-debugging`] - needed to avoid regressions in request flow and guarded actions.
  - Omitted: [`frontend-design`] - little visual work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6] | Blocked By: [1, 2]

  **References**:
  - Pattern: `src/features/recording/ingest-client.ts:22-35` - current metadata payload and request flow.
  - Pattern: `src/features/recording/ingest-client.ts:88-92` - device-derived `user_id` helper to replace or bound.
  - Pattern: `src/features/universe/provision-client.ts:78-96` - premium-triggering podcast request flow.
  - Pattern: `src/features/universe/universe-screen.tsx:21-29` - create/fetch podcast client usage.
  - Test: `tests/browser/universe-ui.spec.ts:195-227` - current podcast creation flow to extend with gating checks.

  **Acceptance Criteria**:
  - [ ] Signed-in requests use Supabase `user.id` consistently where user identity is sent.
  - [ ] Signed-out attempts to invoke protected API paths do not issue network requests.
  - [ ] Non-entitled users cannot invoke premium generation API calls.

  **QA Scenarios**:
  ```
  Scenario: entitled signed-in user can generate podcast
    Tool: Playwright
    Steps: mock signed-in entitled user; load `/`; search `Mom`; trigger `Podcast episode`
    Expected: `POST /podcasts` is sent once and success status UI appears
    Evidence: .sisyphus/evidence/task-5-identity.png

  Scenario: non-entitled user is blocked before request
    Tool: Playwright
    Steps: mock signed-in non-entitled user; load `/`; trigger `Podcast episode`
    Expected: paywall/locked UI appears and no `POST /podcasts` request is sent
    Evidence: .sisyphus/evidence/task-5-identity-error.png
  ```

  **Commit**: YES | Message: `feat(billing): gate premium actions and use canonical user id` | Files: [src/features/**]

- [ ] 6. Expand verification coverage and update setup docs

  **What to do**: Extend Playwright coverage for signed-out, signed-in, entitled, and non-entitled states; add mocks/fixtures for Supabase and RevenueCat; update README/env setup with the exact Supabase and RevenueCat public keys/config needed; ensure the default local verification commands remain accurate.
  **Must NOT do**: Do not document backend services that are out of scope for this phase.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this task is mostly verification and setup clarity.
  - Skills: [`playwright-cli`] - needed for browser test additions rooted in the existing spec.
  - Omitted: [`copywriting`] - technical setup docs are straightforward.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [F1, F2, F3, F4] | Blocked By: [1, 2, 3, 4, 5]

  **References**:
  - Test: `playwright.config.ts:8-31` - current browser test runner contract.
  - Test: `tests/browser/universe-ui.spec.ts:58-227` - existing shell and universe patterns to extend.
  - Pattern: `README.md:1-42` - current setup and env documentation structure.
  - API/Type: `package.json:5-14` - existing commands that docs/tests must preserve.

  **Acceptance Criteria**:
  - [ ] Playwright includes deterministic coverage for signed-out, signed-in, entitled, and non-entitled flows.
  - [ ] README lists every new env var and the exact commands used for verification.
  - [ ] `npm run lint`, `npm run typecheck`, `npm run export:web`, and `npm run test:playwright-ui` all pass.

  **QA Scenarios**:
  ```
  Scenario: full verification suite passes
    Tool: Bash
    Steps: run `npm run lint && npm run typecheck && npm run export:web && npm run test:playwright-ui`
    Expected: all commands exit 0
    Evidence: .sisyphus/evidence/task-6-verification.txt

  Scenario: docs match runtime requirements
    Tool: Bash / Playwright
    Steps: follow README env instructions in a clean shell and launch the app
    Expected: app boots without undocumented missing-config errors
    Evidence: .sisyphus/evidence/task-6-verification-error.txt
  ```

  **Commit**: YES | Message: `test(docs): cover auth billing flows and update setup` | Files: [README.md, playwright.config.ts, tests/browser/**]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- `feat(auth): add supabase and revenuecat foundation`
- `feat(auth): add root auth and entitlement providers`
- `feat(auth): add auth routes and protected action gating`
- `feat(account): add account tab and subscription status`
- `feat(billing): gate premium actions and use canonical user id`
- `test(docs): cover auth billing flows and update setup`

## Success Criteria
- Supabase session state is hydrated once at the app root and reused everywhere.
- RevenueCat entitlement state is visible and deterministic in the UI.
- Signed-out users can browse safely without accidental protected API calls.
- Signed-in entitled users can access premium generation actions.
- Signed-in non-entitled users see locked/paywall states before any premium request leaves the client.
- Existing Expo web verification pipeline continues to pass.
