# Adapt Existing Expo App for Near-Full Static Web Parity

## TL;DR
> **Summary**: Adapt the existing Expo SDK 55 app into a browser-safe, static-exportable web product with near-full parity by preserving the current Expo Router structure, hardening shared UI surfaces, and isolating native-only behavior behind explicit web-safe adapters and fallbacks.
> **Deliverables**:
> - Browser-safe root shell, routes, providers, and shared UI primitives
> - Near-full parity for universe/search/generation flows on web
> - Web-compatible recording experience with explicit unsupported-state handling where browser APIs or backend constraints block parity
> - Static export passing plus expanded Playwright coverage for parity-critical journeys
> **Effort**: Large
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 2/3/4/5 → 6/7/8/9 → 10

## Context
### Original Request
- Read the UI setup of the current app and make a plan to create a web version.

### Interview Summary
- The correct architecture is to **adapt this app**, not build a separate web app.
- The target is **near-full parity** on web, not a reduced MVP.
- Web must remain on the current **Expo static export** model (`web.output: "static"`).
- Implementation should follow **TDD** where practical, with agent-run QA in every task.

### Metis Review (gaps addressed)
- Guardrails added: no separate web app, no route tree redesign, no SSR/server output, no PWA/offline expansion, no opportunistic infra rewrites.
- Acceptance criteria now require static export success, browser route coverage, console-clean runtime behavior, and explicit degraded states for unsupported native/browser capabilities.
- Edge cases explicitly covered: direct route refresh, back/forward navigation, resize behavior, permission denial, unsupported recording capability, backend outage fallback, and browser-safe hydration.
- Scope defaults applied where user did not specify them: preserve current route URLs (`/`, `/record`), keep current static-export architecture, and treat unsupported native/browser features as explicit degraded UX rather than silent failure.

## Work Objectives
### Core Objective
Ship a decision-complete implementation path for turning the current Expo Router app into a near-full-parity static web app without splitting the codebase or breaking existing native flows.

### Deliverables
- Static-export-safe shared app shell rooted in `src/app/_layout.tsx`.
- Web-hardened `UniverseScreen` behavior for `/` and `/record` routes.
- Browser-safe recording/provider/client path with explicit fallbacks for unsupported cases.
- Expanded Playwright regression coverage for parity-critical web journeys.
- CI-aligned verification path using the repo’s existing scripts.

### Definition of Done (verifiable conditions with commands)
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run export:web` completes successfully.
- `npm run web` serves the app without blocking runtime crashes on `/` and `/record`.
- `npm run test:playwright-ui` passes with updated near-full-parity coverage.
- Browser console is free of unhandled errors during parity-critical journeys.

### Must Have
- Preserve the current Expo Router entrypoint and route names.
- Preserve a single shared app codebase.
- Keep `web.output: "static"` unless a blocker is explicitly documented and approved later.
- Make browser incompatibilities explicit in UI state, not implicit in broken flows.
- Keep universe/search/generation flows web-usable with automated verification.
- Keep recording flows browser-safe, including denied-permission and unsupported-environment states.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT create a second web-only app or separate router tree.
- Must NOT introduce SSR, API routes, or server output.
- Must NOT broaden scope into PWA/offline/SEO/marketing-site work.
- Must NOT scatter ad-hoc `Platform.OS === 'web'` branches across unrelated files when a capability adapter or platform file can contain the divergence.
- Must NOT rewrite the entire recording state machine unless a targeted web adapter cannot satisfy the requirement.
- Must NOT change route URLs unless a route is impossible to support on web and the exception is documented.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **TDD**, with browser/integration checks added before or alongside each meaningful parity change.
- Primary repo commands: `npm run lint`, `npm run typecheck`, `npm run export:web`, `npm run web`, `npm run test:playwright-ui`.
- QA policy: Every task includes at least one happy-path and one failure/edge-path scenario.
- Browser support default for this plan: Desktop Chrome plus mobile viewport emulation in Playwright; Safari/Firefox are explicitly deferred unless the implementation uncovers a blocker that affects Chromium too.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: 1 baseline verification/TDD harness, 2 recording capability boundary, 3 provider/layout web safety, 4 theme/hydration/web presentation primitives, 5 API/static-export browser safety

Wave 2: 6 universe route/layout parity, 7 topic/search/generation interaction parity, 8 recording route and browser-permission parity, 9 navigation/history/direct-refresh parity, 10 Playwright expansion and final web regression gates

### Dependency Matrix (full, all tasks)
- 1 blocks 6-10
- 2 blocks 3, 5, 8, 10
- 3 blocks 6, 8, 9
- 4 blocks 6, 7, 10
- 5 blocks 7, 8, 10
- 6 blocks 7, 9, 10
- 7 blocks 10
- 8 blocks 10
- 9 blocks 10
- 10 precedes F1-F4

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 5 tasks → unspecified-high, deep, visual-engineering
- Wave 2 → 5 tasks → visual-engineering, unspecified-high, deep
- Final Verification → 4 tasks → oracle, unspecified-high, deep

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Establish web parity red-green harness

  **What to do**: Add or reshape the browser test harness so the repo can prove web parity incrementally before feature work lands. Keep the existing Playwright entrypoint, but add route-specific tests, console-error capture, and task-focused grepable test names that support TDD for later tasks.
  **Must NOT do**: Must NOT replace Playwright with a new framework, remove the existing `tests/browser/universe-ui.spec.ts` coverage, or add CI workflow work.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-cutting test harness work with repo-wide verification consequences.
  - Skills: [`playwright-cli`] - needed for browser-focused test authoring and execution flow.
  - Omitted: [`vercel-react-best-practices`] - Expo/RNW parity is the core concern, not Next.js/React bundle optimization.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5, 6, 7, 8, 9, 10] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `package.json:5-15` - existing repo commands for web/export/Playwright.
  - Pattern: `playwright.config.ts:5-21` - current browser test configuration and base URL contract.
  - Test: `tests/browser/universe-ui.spec.ts:39-84` - current non-microphone live/fallback coverage pattern.
  - Test helper: `tests/browser/universe-ui.spec.ts:86-160` - route mocking, overlay-click helper, and response fixtures to reuse.
  - External: `https://docs.expo.dev/workflow/web/` - Expo’s recommended web workflow.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes after the new/updated Playwright helpers and tests are added.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "web parity baseline"` passes against `npm run web`.
  - [ ] `npm run export:web` still succeeds after the harness additions.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Baseline universe route stays green under updated harness
    Tool: Playwright
    Steps: Start `npm run web`; run `npx playwright test tests/browser/universe-ui.spec.ts --grep "web parity baseline"`; open `/`; wait for "Tap a glow to enter a topic".
    Expected: Test passes, page loads, and no unhandled console errors are reported by the new harness.
    Evidence: .sisyphus/evidence/task-1-web-harness.txt

  Scenario: Harness catches a browser runtime failure path
    Tool: Playwright
    Steps: Execute the new outage/console-guard test branch that mocks a failing API response for `/universe`.
    Expected: The suite reports the explicit fallback state (`Mocked outage. Showing preview map.`) instead of a silent crash.
    Evidence: .sisyphus/evidence/task-1-web-harness-error.txt
  ```

  **Commit**: YES | Message: `test(web): establish parity harness` | Files: [`playwright.config.ts`, `tests/browser/universe-ui.spec.ts`]

- [x] 2. Introduce a web capability boundary for native-heavy features

  **What to do**: Create a single capability layer for browser-sensitive behavior, centered on recording and any hidden native/browser assumptions. The shared app must ask this layer what is supported on web instead of spreading raw platform branching through feature code.
  **Must NOT do**: Must NOT rewrite the recording state machine wholesale or create a second provider tree for web.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the architectural seam that prevents web parity work from degrading into scattered platform checks.
  - Skills: [`systematic-debugging`] - needed to reason carefully about capability failures and native/browser mismatches.
  - Omitted: [`playwright-cli`] - browser execution comes later; this task is about architecture and contracts.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [3, 5, 8, 10] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/features/recording/recording-state.tsx:46-119` - current permission/bootstrap path in the provider.
  - Pattern: `src/features/recording/recording-state.tsx:157-199` - current send/finalize flow and error transitions.
  - API/Type: `src/features/recording/recording-state.tsx:20-42` - recording statuses and context contract that downstream UI already consumes.
  - API/Type: `src/features/recording/recording-state.tsx:279-308` - provider hook boundary and finalization helper.
  - API/Type: `src/features/recording/ingest-client.ts:1-69` - current browser-sensitive upload/device/file assumptions.
  - Pattern: `src/app/_layout.tsx:5-16` - global provider mount point that must stay shared.
  - External: `https://docs.expo.dev/versions/v55.0.0/sdk/webbrowser/` - secure-origin and web capability constraints for browser APIs.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes with the new capability contract in place.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "recording capability"` passes with explicit supported/unsupported-state assertions.
  - [ ] `npm run export:web` succeeds without importing native-only code on the web route path.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Supported browser path exposes a usable recording capability state
    Tool: Playwright
    Steps: Start `npm run web`; navigate to `/record`; assert the Record tab loads and the UI exposes the supported capability state before starting recording.
    Expected: The route renders without crashing and the recording controls reflect a browser-safe capability decision.
    Evidence: .sisyphus/evidence/task-2-capability-boundary.png

  Scenario: Unsupported or denied capability yields explicit degraded UX
    Tool: Playwright
    Steps: Run the new denied/unsupported test path for `/record` with browser permissions blocked or capability mocked unavailable.
    Expected: The UI shows an explicit unsupported/permission-denied state and does not throw an unhandled runtime error.
    Evidence: .sisyphus/evidence/task-2-capability-boundary-error.png
  ```

  **Commit**: YES | Message: `refactor(web): add native capability boundary` | Files: [`src/features/recording/**`, `src/app/_layout.tsx`, `tests/browser/**`]

- [x] 3. Make the shared root shell and providers static-web-safe

  **What to do**: Harden the root shell so `ThemeProvider`, `RecordingProvider`, and route composition remain safe during browser hydration and static export. Ensure both `/` and `/record` can mount the shared shell without provider-side crashes or client-only assumptions leaking into initial render.
  **Must NOT do**: Must NOT replace Expo Router, remove the shared `_layout.tsx`, or fork provider mounting by route.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: provider/bootstrap issues are subtle, cross-cutting, and easy to regress.
  - Skills: [`systematic-debugging`] - hydration and provider bootstrap bugs require careful failure analysis.
  - Omitted: [`playwright-cli`] - task needs browser verification, but the core work is provider/bootstrap safety.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [6, 8, 9, 10] | Blocked By: [1, 2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/app/_layout.tsx:1-19` - shared root shell and provider composition.
  - Pattern: `src/hooks/use-color-scheme.web.ts:1-21` - current static-render hydration guard for color scheme.
  - Pattern: `src/constants/theme.ts:6-65` - global CSS import and platform-specific font/token selection.
  - Pattern: `src/app/index.tsx:1-5` - universe route entrypoint.
  - Pattern: `src/app/record.tsx:1-5` - record route entrypoint.
  - External: `https://docs.expo.dev/deploy/web/` - static export behavior and route-generation constraints.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npm run export:web` passes with both `/` and `/record` in the static output path.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "root shell"` passes for direct loads of `/` and `/record`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Shared shell mounts both routes cleanly
    Tool: Playwright
    Steps: Start `npm run web`; navigate directly to `/`; then navigate directly to `/record`; wait for each route to finish initial render.
    Expected: Both routes mount through the shared shell without hydration/runtime errors and without losing provider state wiring.
    Evidence: .sisyphus/evidence/task-3-root-shell.txt

  Scenario: Static-export path does not break provider bootstrap
    Tool: Bash
    Steps: Run `npm run export:web`.
    Expected: Export completes successfully with no provider/bootstrap crash on either routed screen.
    Evidence: .sisyphus/evidence/task-3-root-shell-export.txt
  ```

  **Commit**: YES | Message: `fix(web): harden shared shell providers` | Files: [`src/app/_layout.tsx`, `src/hooks/**`, `src/constants/theme.ts`, `tests/browser/**`]

- [x] 4. Harden web presentation primitives, hydration, and tab shell behavior

  **What to do**: Normalize web-only presentation primitives so fonts, color-scheme hydration, splash handling, and the custom floating tab bar behave consistently in browser layouts. Keep the current platform-file strategy and confine web-only visual divergence to the existing web-oriented surfaces.
  **Must NOT do**: Must NOT port the UI into a new styling system or add speculative design-system abstractions.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: this is UI shell and presentation hardening with visible browser-specific behavior.
  - Skills: [`playwright-cli`] - browser rendering feedback is needed while adjusting web presentation.
  - Omitted: [`vercel-react-best-practices`] - Expo RNW shell behavior matters more than generic React optimization heuristics.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [6, 7, 9, 10] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/components/app-tabs.web.tsx:26-109` - web tab shell, backdrop blur, and active/idle layer morphing.
  - Pattern: `src/components/app-tabs.web.tsx:133-225` - web recording controls embedded in the tab shell.
  - Pattern: `src/constants/theme.ts:6-65` - global CSS and font variable usage.
  - Pattern: `src/hooks/use-color-scheme.web.ts:1-21` - hydration-safe color scheme fallback.
  - Pattern: `src/components/animated-icon.web.tsx:1-10` - current web splash overlay behavior (currently returns `null`).
  - External: `https://docs.expo.dev/versions/v55.0.0/sdk/font/` - Expo font behavior on web.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "tab shell|hydration"` passes with no hydration warning regressions.
  - [ ] `npm run export:web` passes after presentation-layer changes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Floating tab shell remains usable on web
    Tool: Playwright
    Steps: Start `npm run web`; open `/`; click the tabs labeled "Universe" and "Record"; observe the bottom dock before and after route changes.
    Expected: The floating tab shell stays visible, interactive, and visually stable without overlap or broken blur styling.
    Evidence: .sisyphus/evidence/task-4-web-shell.png

  Scenario: First paint remains hydration-safe on web
    Tool: Playwright
    Steps: Load `/` from a cold browser session with console capture enabled.
    Expected: No hydration mismatch warnings appear and the initial theme/font state settles without flashing broken layout.
    Evidence: .sisyphus/evidence/task-4-web-shell-hydration.txt
  ```

  **Commit**: YES | Message: `fix(web): stabilize shell and hydration` | Files: [`src/components/app-tabs.web.tsx`, `src/components/animated-icon.web.tsx`, `src/hooks/use-color-scheme.web.ts`, `src/constants/theme.ts`, `tests/browser/**`]

- [x] 5. Make API clients and browser/network failure states web-safe

  **What to do**: Harden the provisioning and ingest client boundaries for static web usage, browser fetch behavior, and backend outage/CORS-style failures. Preserve the existing env-var contract and make every browser-visible failure path explicit in UI state.
  **Must NOT do**: Must NOT redesign backend contracts or hide network failures behind silent no-ops.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: browser networking, env handling, and error-path UX span API code and UI state.
  - Skills: [`systematic-debugging`] - failure-path analysis is more important than new abstraction work here.
  - Omitted: [`playwright-cli`] - browser tests verify this later, but the core task is robust client/error behavior.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 8, 10] | Blocked By: [1, 2]

  **References** (executor has NO interview context - be exhaustive):
  - API/Type: `src/features/universe/provision-client.ts:60-107` - universe/podcast requests and error handling.
  - API/Type: `src/features/universe/provision-client.ts:109-168` - parsing and error-message derivation.
  - API/Type: `src/features/recording/ingest-client.ts:21-69` - web upload path, device-derived metadata, file handling, and POST behavior.
  - Pattern: `README.md:36-49` - env-var contract that must remain valid.
  - Pattern: `README.md:58-75` - known runtime blockers outside the repo that must surface as explicit UX states, not crashes.
  - Test: `tests/browser/universe-ui.spec.ts:71-83` - existing outage fallback pattern for `/universe`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "outage|network|ingest"` passes.
  - [ ] `npm run export:web` succeeds and the app still exposes clear browser-visible error states for failing backend calls.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Provision API outage falls back cleanly on web
    Tool: Playwright
    Steps: Start `npm run web`; run the outage test path that mocks `/universe` to return a failing response.
    Expected: The preview-map fallback renders with an explicit message instead of a blank or crashed screen.
    Evidence: .sisyphus/evidence/task-5-api-fallback.png

  Scenario: Ingest/network failure surfaces explicit send error state
    Tool: Playwright
    Steps: Execute the new recording-send failure test path with ingest mocked to fail or reject.
    Expected: The UI surfaces the retry/error state and does not lose route interactivity or crash.
    Evidence: .sisyphus/evidence/task-5-api-fallback-error.png
  ```

  **Commit**: YES | Message: `fix(web): harden browser api failure states` | Files: [`src/features/universe/provision-client.ts`, `src/features/recording/ingest-client.ts`, `tests/browser/**`, `README.md`]

- [x] 6. Adapt UniverseScreen layout and viewport behavior for web parity

  **What to do**: Refine `UniverseScreen` so its layout, navigation inset logic, and main canvas/panel composition behave correctly on browser-sized viewports while preserving the shared screen model for both `/` and `/record`. Focus on responsive layout stability and route-safe rendering rather than visual reinvention.
  **Must NOT do**: Must NOT split `UniverseScreen` into a separate web-only screen unless an isolated platform file is the only way to keep parity without destabilizing native.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: this is the largest shared UI surface and the most browser-visible parity work.
  - Skills: [`playwright-cli`] - browser iteration is required for responsive parity.
  - Omitted: [`systematic-debugging`] - useful later for bugs, but this task is primarily UI behavior and layout work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [7, 9, 10] | Blocked By: [1, 3, 4]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/features/universe/universe-screen.tsx:77-96` - current platform-specific font handling.
  - Pattern: `src/features/universe/universe-screen.tsx:301-327` - route mode handling, web navigation inset, and pathname-based state.
  - Pattern: `src/app/index.tsx:1-5` - universe route entrypoint.
  - Pattern: `src/app/record.tsx:1-5` - record route entrypoint.
  - Pattern: `src/components/app-tabs.web.tsx:82-109` - dock offset and shell composition that the screen must coexist with.
  - Test: `tests/browser/universe-ui.spec.ts:47-69` - current core universe route assertions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "universe layout"` passes for desktop and mobile-viewport variants.
  - [ ] `npm run export:web` passes with the adapted `UniverseScreen`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Universe route remains usable across browser viewport sizes
    Tool: Playwright
    Steps: Start `npm run web`; load `/`; run desktop and mobile-viewport checks against the universe route; interact with the graph/search surface.
    Expected: Core content remains visible, dock overlap is controlled, and the route stays interactive at both viewport sizes.
    Evidence: .sisyphus/evidence/task-6-universe-layout.png

  Scenario: Record-mode route keeps its shared layout contract on web
    Tool: Playwright
    Steps: Navigate directly to `/record`; confirm the shared screen renders in record mode without broken spacing or off-screen critical controls.
    Expected: `/record` remains readable and interactive rather than inheriting invalid universe-route-only layout assumptions.
    Evidence: .sisyphus/evidence/task-6-universe-layout-record.png
  ```

  **Commit**: YES | Message: `feat(web): adapt universe layout parity` | Files: [`src/features/universe/universe-screen.tsx`, `tests/browser/**`]

- [x] 7. Complete topic, search, and generation interaction parity on web

  **What to do**: Bring the topic-selection, search, generation menu, and podcast-status flows to near-full parity on web, using browser-safe pointer/keyboard interaction patterns while keeping the shared business logic and provision client intact.
  **Must NOT do**: Must NOT re-scope this into SEO/search-index work or redesign the generation flow IA.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: high-touch UI interaction parity across the main feature surface.
  - Skills: [`playwright-cli`] - interaction-level browser tests must be authored alongside the changes.
  - Omitted: [`vercel-react-best-practices`] - parity of RNW interactions matters more than generic React guidance here.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10] | Blocked By: [1, 4, 5, 6]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/features/universe/universe-screen.tsx:301-327` - shared route and UI entry context for the interaction surface.
  - API/Type: `src/features/universe/provision-client.ts:77-95` - create/list/detail podcast flow contract.
  - Test: `tests/browser/universe-ui.spec.ts:40-69` - current search + generation + podcast progression path.
  - Test helper: `tests/browser/universe-ui.spec.ts:140-148` - overlay-target click helper pattern.
  - Pattern: `README.md:51-68` - live product behavior currently expected for universe and generation flows.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "topic parity|generation parity"` passes.
  - [ ] `npm run export:web` passes after interaction-parity changes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Search-to-podcast flow completes on web
    Tool: Playwright
    Steps: Start `npm run web`; load `/`; click "Search memories"; fill "Search places, people, feelings" with `Mom`; open "Generate something"; choose "Podcast episode".
    Expected: The job is submitted, status progresses, and the UI reaches the ready state without broken overlay interactions.
    Evidence: .sisyphus/evidence/task-7-generation-parity.txt

  Scenario: Generation failure path stays explicit and recoverable
    Tool: Playwright
    Steps: Run a mocked failure path for podcast creation/detail polling.
    Expected: The UI presents an explicit error/retry state and the rest of the universe screen remains usable.
    Evidence: .sisyphus/evidence/task-7-generation-parity-error.txt
  ```

  **Commit**: YES | Message: `feat(web): complete universe interaction parity` | Files: [`src/features/universe/universe-screen.tsx`, `src/features/universe/provision-client.ts`, `tests/browser/**`]

- [x] 8. Implement browser-safe recording route parity

  **What to do**: Make the `/record` experience near-fully usable on web by combining the capability boundary, provider changes, and ingest handling into a browser-safe recording flow. Where the browser or backend cannot support the native behavior, present an explicit, tested degraded state without breaking the route.
  **Must NOT do**: Must NOT silently disable the route, hide the feature behind dead controls, or bypass the capability layer introduced earlier.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: recording parity spans browser permissions, provider state, upload semantics, and graceful degradation.
  - Skills: [`systematic-debugging`, `playwright-cli`] - needed for both failure analysis and browser verification.
  - Omitted: [`vercel-react-best-practices`] - not the relevant risk surface.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10] | Blocked By: [1, 2, 3, 5]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/app/record.tsx:1-5` - route entrypoint for record mode.
  - Pattern: `src/features/recording/recording-state.tsx:46-119` - permission/bootstrap/start flow.
  - Pattern: `src/features/recording/recording-state.tsx:157-199` - send/retry/sent/error transitions.
  - API/Type: `src/features/recording/recording-state.tsx:234-307` - status label mapping, provider value, and finalization behavior.
  - API/Type: `src/features/recording/ingest-client.ts:21-69` - upload request and browser/device metadata assumptions.
  - Pattern: `src/components/app-tabs.web.tsx:133-225` - existing web recording controls embedded in the tab shell.
  - Pattern: `README.md:58-75` - real-world microphone/CORS blockers that must surface as explicit web UX states.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "record route parity|recording parity"` passes.
  - [ ] `npm run export:web` passes and `/record` remains reachable.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Browser-supported recording path is usable on /record
    Tool: Playwright
    Steps: Start `npm run web`; navigate to `/record`; allow mocked/supported recording capability; interact with the pause/resume/send controls.
    Expected: The route remains interactive, state transitions are visible, and send-related statuses update without crashing the shell.
    Evidence: .sisyphus/evidence/task-8-recording-parity.png

  Scenario: Permission denial or unsupported browser state is explicit
    Tool: Playwright
    Steps: Run the denied/unsupported recording test path for `/record`.
    Expected: The UI communicates the failure mode clearly (permission denied / unsupported / retry ready), keeps navigation available, and avoids hidden failures.
    Evidence: .sisyphus/evidence/task-8-recording-parity-error.png
  ```

  **Commit**: YES | Message: `feat(web): harden recording route parity` | Files: [`src/app/record.tsx`, `src/features/recording/**`, `src/components/app-tabs.web.tsx`, `tests/browser/**`]

- [x] 9. Preserve browser navigation, direct refresh, and route-state parity

  **What to do**: Ensure the static web app behaves correctly under direct URL entry, refresh, browser back/forward, and tab-based route switching. Preserve the current route URLs and keep state transitions compatible with browser history rather than mobile-only assumptions.
  **Must NOT do**: Must NOT rename routes or introduce browser-only route aliases.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: route/history bugs are subtle and cross-cut UI, router, and state assumptions.
  - Skills: [`playwright-cli`] - browser history and refresh need real browser automation.
  - Omitted: [`systematic-debugging`] - helpful for defects, but the primary requirement is browser-route verification.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10] | Blocked By: [1, 3, 4, 6]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/app/index.tsx:1-5` - `/` route contract.
  - Pattern: `src/app/record.tsx:1-5` - `/record` route contract.
  - Pattern: `src/app/_layout.tsx:9-17` - shared shell mounted for both routes.
  - Pattern: `src/features/universe/universe-screen.tsx:324-327` - pathname-derived route-state assumptions.
  - Pattern: `src/components/app-tabs.web.tsx:30-48` - tab triggers for `/` and `/record`.
  - External: `https://docs.expo.dev/deploy/web/` - static web output and route behavior constraints.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] `npx playwright test tests/browser/universe-ui.spec.ts --grep "route parity|history parity|refresh parity"` passes.
  - [ ] `npm run export:web` passes with preserved route names.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Direct loads and browser history work for both routes
    Tool: Playwright
    Steps: Start `npm run web`; `page.goto('/')`; switch to `/record` using the tab; use browser back and forward; then directly `page.goto('/record')`.
    Expected: Both routes load correctly, back/forward preserve usable UI state, and tab navigation stays in sync with browser history.
    Evidence: .sisyphus/evidence/task-9-route-parity.txt

  Scenario: Refresh does not strand the app on a broken route state
    Tool: Playwright
    Steps: Load `/record`; trigger a page reload; verify the route shell rehydrates cleanly.
    Expected: Refresh returns a valid `/record` experience rather than a blank screen, stuck shell, or incorrect `/` fallback.
    Evidence: .sisyphus/evidence/task-9-route-parity-refresh.txt
  ```

  **Commit**: YES | Message: `fix(web): preserve route and history parity` | Files: [`src/app/**`, `src/features/universe/universe-screen.tsx`, `src/components/app-tabs.web.tsx`, `tests/browser/**`]

- [x] 10. Expand Playwright parity coverage and lock final web regression gates

  **What to do**: Convert the accumulated parity work into a stable regression suite that covers the agreed web-critical journeys, including console cleanliness, outage paths, route refresh/history, universe interactions, and record-route behavior. The final suite must exercise the current repo commands and act as the implementation stop condition before review.
  **Must NOT do**: Must NOT bloat coverage into unrelated native-only or cosmetic-only cases.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this task consolidates the release gate for the entire migration.
  - Skills: [`playwright-cli`] - browser automation is the primary deliverable.
  - Omitted: [`systematic-debugging`] - failures may need debugging, but the task itself is verification-gate construction.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [F1, F2, F3, F4] | Blocked By: [1, 2, 3, 4, 5, 6, 7, 8, 9]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `package.json:5-15` - canonical repo commands for web/export/tests.
  - Pattern: `playwright.config.ts:5-21` - current Playwright environment and single-worker assumptions.
  - Test: `tests/browser/universe-ui.spec.ts:39-160` - current suite structure to extend rather than replace.
  - Pattern: `README.md:19-34` - current verification contract used locally/CI-like flows.
  - Pattern: `README.md:58-75` - known manual blocker surfaces that must be either mocked in automation or represented as explicit degraded UX.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run lint` passes.
  - [ ] `npm run typecheck` passes.
  - [ ] `npm run export:web` passes.
  - [ ] `npm run test:playwright-ui` passes with the expanded parity suite.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full near-parity browser regression suite passes
    Tool: Playwright
    Steps: Start `npm run web`; run `npm run test:playwright-ui`.
    Expected: The full suite passes, covering universe, fallback, generation, recording, route refresh, and history parity without console errors.
    Evidence: .sisyphus/evidence/task-10-web-regression.txt

  Scenario: Static export remains the shipping gate
    Tool: Bash
    Steps: Run `npm run export:web` after the full parity work is complete.
    Expected: Export succeeds and no newly introduced web-only route/provider/native dependency breaks the static build.
    Evidence: .sisyphus/evidence/task-10-web-regression-export.txt
  ```

  **Commit**: YES | Message: `test(web): lock parity regression gates` | Files: [`playwright.config.ts`, `tests/browser/**`, `README.md`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: web verification harness + failing/updated tests
- Commit 2: web capability adapters + provider/layout safety
- Commit 3: theme/hydration/tab/splash web hardening
- Commit 4: universe/generation/search parity changes
- Commit 5: recording/browser-permission/send parity changes
- Commit 6: navigation/history/direct-refresh fixes + Playwright expansion
- Commit 7: final cleanup after verification feedback

## Success Criteria
- The existing Expo app runs on web without a parallel app fork.
- Static export remains the shipping model and passes consistently.
- `/` and `/record` remain valid routes on web.
- Universe/search/generation flows are browser-usable and covered by automated tests.
- Recording behavior is web-safe, with either working browser parity or explicit, tested degraded UX where the browser/backend combination cannot support it.
- Native behavior is preserved or intentionally platform-split without regressions.
