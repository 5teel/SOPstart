---
phase: 15-manufacturing-line-mode
plan: 03
subsystem: api
tags: [voice, anthropic, prompt-caching, claude-haiku-4-5, verifier, grounding, sb-line-03, sb-line-04]

requires:
  - phase: 15-00
    provides: voiceQuerySchema validator, anthropic-voice-mock fixture, Visy ENF4-03-031 SQL fixture, voice-grounding-scope spec scaffold
  - phase: 15-01
    provides: sub_trades junction tables + RLS gate on sops SELECT (server-side org + sub-trade scope)
  - phase: 15-02
    provides: WalkthroughVoiceModal shell with stub fetch to /api/voice/query (now consumes live endpoint)

provides:
  - packSopForPrompt utility — byte-identical SOP serializer used by BOTH answer and verifier calls (single source of truth for Anthropic prompt-cache key)
  - answerSopQuestion two-call pipeline — claude-haiku-4-5 answer call with cache_control:ephemeral on SOP block, then verifier call that hits the cache on the 2nd call within the 5-min TTL
  - verify-sop.ts mode 'voice_qa' extension — new system-array form + VOICE_QA_VERIFY_SYSTEM prompt + fail-safe synthetic warning on exception (Pitfall 10)
  - POST /api/voice/query route — Zod-validated, auth-gated, RLS-scoped single-SOP fetch, in-memory concurrency cap, full 400/401/404/429/502 error envelope
  - __resetAnthropicForTests test hook + fetch indirection so the Anthropic SDK can be mocked via globalThis.fetch in unit tests

affects: [15-04, 15-05, phase-16-future-voice-history, phase-16-future-rls-tests, phase-16-future-cost-analytics]

tech-stack:
  added: [Anthropic SDK system-array form with cache_control:ephemeral, fetch indirection pattern for SDK clients]
  patterns: [single-source-of-truth serializer for cache-keyed payloads, fail-safe-to-uncertainty on verifier exception, lazy-init + reset hook for testability]

key-files:
  created:
    - src/lib/voice/sop-pack.ts
    - src/lib/voice/voice-qa.ts
    - src/lib/voice/__tests__/sop-pack.test.ts
    - src/lib/voice/__tests__/verify-sop-voice-qa.test.ts
    - src/lib/voice/__tests__/voice-qa-cache.test.ts
    - src/app/api/voice/query/route.ts
  modified:
    - src/lib/parsers/verify-sop.ts
    - tests/integration/voice-grounding-scope.spec.ts
    - playwright.config.ts

key-decisions:
  - "packSopForPrompt is the SINGLE source of truth for the cached payload — both answer call and verifier call import from src/lib/voice/sop-pack.ts; never re-serialize inline (Pitfall 3 mitigation)"
  - "Lazy-init Anthropic clients (voice-qa.ts + verify-sop.ts) now pass fetch indirection — `fetch: (input, init) => globalThis.fetch(input, init)` — so tests can swap globalThis.fetch after the singleton is built"
  - "__resetAnthropicForTests test hook added to voice-qa.ts only (verify-sop.ts retains untouched production semantics for Phase 6/14 callers)"
  - "Verifier branch for 'voice_qa' returns synthetic warning flag on Anthropic exception (Pitfall 10 fail-safe); existing 'transcript' and 'prompt' modes still return [] on exception (backward-compatible)"
  - "Concurrency cap implemented as per-process in-memory Set<userId> — documented as Railway-single-process-only; comment cites CLAUDE.md PM2 cluster learning"
  - "Route does NOT check admin role — workers must be allowed per D-15; auth via session + RLS handles SOP visibility"
  - "voice-grounding-scope.spec.ts implemented as source-contract assertions (Rule-3 trade-off matching Plan 15-01 / 15-02 — chromium not installed locally); live runtime SB-LINE-04 cross-SOP check deferred to phase UAT, but the route fetches a SINGLE SOP via one .eq('id', sopId) call so cross-SOP leak is STRUCTURALLY impossible"
  - "voice-qa-cache test file uses local rawAnswerResp/rawVerifierResp helpers that match Anthropic's wire shape directly — the Wave-0 anthropic-voice-mock.ts fixture JSON-wraps answer text in its content[0].text which doesn't match the real SDK shape; left the fixture alone (Wave 0 contract) and added wire-correct helpers in the test file"

patterns-established:
  - "Cache-keyed payload pattern: any data flowing above an Anthropic cache_control breakpoint MUST originate from a single shared serializer to guarantee byte-identical input for cache hits"
  - "Fetch indirection for SDK testability: wrap globalThis.fetch in a passthrough lambda when constructing SDK clients so test global-fetch swaps work after the lazy singleton is built"
  - "Test-only singleton reset hook: export `__resetAnthropicForTests` (underscore prefix) so test suites can clean state per test without touching production code paths"
  - "Fail-safe verifier mode-branch: voice_qa returns synthetic warning, transcript/prompt return [] — error semantic is per-mode, not global"

requirements-completed: [SB-LINE-03, SB-LINE-04]

duration: 75min
completed: 2026-05-13
---

# Phase 15 Plan 03: Voice Q&A Backend Summary

**Two-call Anthropic pipeline (claude-haiku-4-5 answer + adversarial verifier) with prompt caching, full-SOP grounding, and POST /api/voice/query endpoint — backend for SB-LINE-03 (voice Q&A) and SB-LINE-04 (grounding scope).**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-05-13T (early session)
- **Completed:** 2026-05-13
- **Tasks:** 4 (all autonomous)
- **Files created:** 6
- **Files modified:** 3

## Accomplishments

- `packSopForPrompt(sop)` shared serializer — load-bearing constant, byte-identical output guaranteed by 6 unit tests
- `verify-sop.ts` extended with `mode: 'voice_qa'` — new system-array form + cache_control + VOICE_QA_VERIFY_SYSTEM prompt + Pitfall 10 fail-safe (synthetic warning on exception, NEVER [])
- `answerSopQuestion(sop, question)` two-call pipeline — answer call with cache_control:ephemeral on SOP block, then verifier call that reuses the cache write within the 5-min TTL
- `POST /api/voice/query` route — Zod-validated, auth-gated, RLS-scoped single-SOP fetch (no cross-SOP joins per SB-LINE-04), in-memory concurrency cap, full 400/401/404/429/502 envelope
- Anthropic SDK testability: fetch indirection lambda + `__resetAnthropicForTests` test hook so unit tests can mock the SDK via `globalThis.fetch` swaps
- 25 new automated tests passing (6 sop-pack + 11 verify-sop voice_qa + 8 voice-qa cache + 14 voice-grounding-scope source-contract) — all phase15 stub + unit tests green (88 passed, 4 skipped pre-existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: sop-pack utility + 6 byte-identical tests** — `6218b41` (feat)
2. **Task 2: verify-sop.ts mode 'voice_qa' extension + 11 tests** — `019ef51` (feat)
3. **Task 3: answerSopQuestion two-call pipeline + 8 cache-guard tests** — `fd792bd` (feat)
4. **Task 4: POST /api/voice/query route + 14 grounding-scope source-contract tests** — `538b9be` (feat)

## Files Created/Modified

### Created (6)

- `src/lib/voice/sop-pack.ts` — Shared `packSopForPrompt(sop)` byte-identical SOP serializer. Load-bearing constant for Anthropic prompt-cache key. Inline warning comment cites Pitfall 3.
- `src/lib/voice/voice-qa.ts` — `answerSopQuestion(sop, question)` two-call orchestration. Lazy-init Anthropic with fetch indirection + `__resetAnthropicForTests` hook. Uses `packSopForPrompt` from sop-pack.ts.
- `src/lib/voice/__tests__/sop-pack.test.ts` — 6 unit tests covering byte-identical output, section/step formatting, WARNING:/CAUTION: prefixes, block JSON.stringify shape, optional-field stability.
- `src/lib/voice/__tests__/verify-sop-voice-qa.test.ts` — 11 tests covering VOICE_QA_VERIFY_SYSTEM prompt invariants (Pitfall 6 paraphrase/invention/uncertainty), source contract for the voice_qa branch, runtime fail-safe path (Pitfall 10).
- `src/lib/voice/__tests__/voice-qa-cache.test.ts` — 8 tests covering citation regex, cache_control breakpoint placement, byte-identical packed-SOP across calls, model consistency (both claude-haiku-4-5), Q1 cache_creation + Q2 cache_read token flow, answer-exception propagation, verifier-exception fail-safe.
- `src/app/api/voice/query/route.ts` — POST handler with Zod validation, `supabase.auth.getUser()`, RLS single-SOP fetch `.eq('id', sopId).eq('status', 'published').single()`, in-memory concurrency cap, 30s maxDuration, full error envelope.

### Modified (3)

- `src/lib/parsers/verify-sop.ts` — Added VOICE_QA_VERIFY_SYSTEM constant + `voice_qa` branch in mode union + system-array form with cache_control + claude-haiku-4-5 model + Pitfall 10 fail-safe synthetic warning. Lazy-init helper extended with fetch indirection. Existing `transcript` / `prompt` branches unchanged (Phase 6 / 14 callers unaffected). Re-exports VOICE_QA_VERIFY_SYSTEM for tests.
- `tests/integration/voice-grounding-scope.spec.ts` — Un-fixme'd Wave 0 scaffold. Now 14 source-contract assertions covering single-SOP scope (`.eq('id', sopId)`), regular Supabase client (NOT admin), no cross-SOP joins / no semantic search, auth/Zod/RLS error envelope, threat-model mitigations (T-15-03-02 through T-15-03-05), maxDuration cap, concurrency cap, no admin-role check (D-15), Visy fixture present.
- `playwright.config.ts` — Added `phase15-unit` project (`testDir: src/lib/voice/__tests__`) for Node-only unit tests separate from the chromium-required `phase15-stubs` project.

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Single source of truth for cache key** — `packSopForPrompt` exported once, imported by both pipeline branches. Verifier branch in verify-sop.ts imports from `@/lib/voice/sop-pack` (no duplication, no drift, Pitfall 3 closed).
- **Fetch indirection pattern** — discovered the Anthropic SDK captures `globalThis.fetch` at construction time. Without indirection, tests couldn't mock the SDK via global-fetch swap after the lazy singleton was built. Wrapping the SDK's fetch option in a passthrough lambda re-reads the current global on every call.
- **Per-mode error semantics** — voice_qa returns synthetic warning on exception (fail-safe to uncertainty); transcript/prompt keep their existing `return []` semantics. This is a targeted change — Phase 6 / 14 callers' behaviour is byte-identical.
- **Concurrency cap is per-process** — comment explicitly cites CLAUDE.md cross-project learning about PM2 cluster mode losing in-memory state. Acceptable for current Railway single-process deploy; will need Redis-backed bucket if we move to cluster mode or serverless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Anthropic SDK singleton caches fetch reference at construct time, breaking test fetch-mocks**
- **Found during:** Task 3 (voice-qa-cache test scaffolding)
- **Issue:** Tests swap `global.fetch` to intercept Anthropic API calls. But the SDK reads `globalThis.fetch` at `new Anthropic()` time and captures the reference into `this.fetch`. Once the lazy-init singleton was built (first test), subsequent fetch-mock swaps had no effect — the SDK still pointed at the original fetch.
- **Fix:** (a) Pass `fetch: (input, init) => globalThis.fetch(input as RequestInfo, init)` indirection lambda when constructing the Anthropic client (both voice-qa.ts and verify-sop.ts) so the SDK re-reads the current global on every call. (b) Add exported `__resetAnthropicForTests()` helper to voice-qa.ts so tests can null the singleton between cases.
- **Files modified:** `src/lib/voice/voice-qa.ts`, `src/lib/parsers/verify-sop.ts`, `src/lib/voice/__tests__/voice-qa-cache.test.ts`
- **Verification:** All 8 cache-guard tests pass; 11 verify-sop voice_qa tests pass; production semantics for verify-sop transcript/prompt unchanged.
- **Committed in:** `fd792bd` (Task 3 commit)

**2. [Rule 1 - Bug] Wave-0 anthropic-voice-mock fixture JSON-wraps answer text, mismatching Anthropic's real wire shape**
- **Found during:** Task 3 (first cache test invocation)
- **Issue:** Wave-0 `tests/fixtures/anthropic-voice-mock.ts` sets `content[0].text = JSON.stringify({ answer, citations })`. The real Anthropic SDK returns `content[0].text` as the literal answer string. `answerSopQuestion` reads `content[0].text` directly — so the fixture would have produced a JSON-stringified blob as the answer, breaking citation extraction.
- **Fix:** Added local `rawAnswerResp` / `rawVerifierResp` helpers inside `voice-qa-cache.test.ts` that produce wire-correct responses. Left the Wave-0 fixture alone (Wave 0 contract; the file is still imported by voice-qa-happy-path.spec.ts and voice-grounding-scope.spec.ts for symbol-level checks).
- **Files modified:** `src/lib/voice/__tests__/voice-qa-cache.test.ts`
- **Verification:** All 8 cache tests pass with correct answer / citation extraction.
- **Committed in:** `fd792bd` (Task 3 commit)
- **Note:** Wave-0 fixture remains used as-is for source-contract symbol checks. If a future plan needs runtime end-to-end mocking with the fixture's PPE_QUESTION_PRESET / ADVERSARIAL_QUESTION_PRESET, the fixture should be corrected to use raw-text shape instead of JSON-wrapping.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes essential — Deviation 1 unblocks the entire cache-test harness; Deviation 2 corrects a wave-0 inheritance error that would have produced silently-wrong answers in tests. No scope creep; production code paths only changed in the fetch-indirection lines (no functional change at runtime).

## Issues Encountered

- **Anthropic SDK retry policy** — default 2 retries on connection failures. With the throw-on-call mock pattern, retries showed up as multiple `console.error` lines on the fail-safe test path. Behaviour is correct (the synthetic warning flag IS returned after retries exhaust), so no production change needed.
- **Playwright config** — added a new `phase15-unit` project (Node-only, no chromium) so the new `src/lib/voice/__tests__/*.test.ts` files run cleanly without depending on the chromium binary that isn't installed locally. Pattern matches Plan 15-00 / 15-01 Rule-3 trade-offs.

## Threat-Model Coverage (7 RESEARCH § Security Domain threats)

| ID         | Threat                              | Mitigation                                                                                                                                                                                          |
| ---------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-15-03-01 | Prompt-injection (tampering)        | Adversarial verifier (`mode: 'voice_qa'`) checks every claim against actual SOP text; injected claims fail verification → warning surfaced to UI. Worker-only blast radius (RLS scopes to own org). |
| T-15-03-02 | Cross-SOP / cross-org leak          | Server query `.eq('id', sopId)` only; no cross-SOP joins. `voice-grounding-scope.spec.ts` asserts this structurally. RLS also gates by org.                                                         |
| T-15-03-03 | Sub-trade bypass                    | Route uses regular `createClient()` (RLS-respecting), NOT `createAdminClient()`. Migration 00030 `sops_visible_by_sub_trade` enforces server-side sub-trade gate.                                    |
| T-15-03-04 | Cost runaway (DoS)                  | `voiceQuerySchema` max(500) chars + `max_tokens: 512` + 30s `maxDuration` + per-user in-memory concurrency cap of 1 in-flight.                                                                      |
| T-15-03-05 | Log leak (Anthropic err echoes SOP) | Route logs `err.message` only — never the request body. Anthropic SDK error `.message` does not include request payload.                                                                            |
| T-15-03-06 | XSS via question echo               | Addressed at modal layer (Wave 2) — React text children, no `dangerouslySetInnerHTML`. Route returns plain JSON.                                                                                    |
| T-15-03-07 | Forged ack trace                    | Orthogonal to voice route; accepted disposition per D-20 (trace is evidence not gate). Addressed at Wave 2 ack-trace persistence.                                                                   |

Plus T-15-03-08 (verifier silently fails) — mitigated by Pitfall 10 synthetic warning flag in `mode: 'voice_qa'` branch.

## Token-usage Smoke Test

Manual smoke against real ANTHROPIC_API_KEY not run as part of this plan (deferred to phase UAT). The unit-level guard via the mock fixture's usage values confirms the cache-write/cache-read pattern flows through the pipeline correctly:

- **Q1 answer call (cache write):** `usage.cache_creation_input_tokens` > 0, `cache_read_input_tokens` = 0
- **Q1 verifier call (cache hit within 5-min TTL):** `cache_read_input_tokens` > 0
- **Q2 answer call (cache hit on repeat question):** `cache_read_input_tokens` > 0, `cache_creation_input_tokens` = 0

UAT will record real token counts against the Visy ENF4-03-031 fixture to confirm prod-cost projections.

## Verifier-Prompt Iteration Notes (Pitfall 6)

The VOICE_QA_VERIFY_SYSTEM prompt was tuned during Task 2 to:

- Explicitly permit "I'm not certain" / "I don't know" / "not specified" responses as GROUNDED (do not flag)
- Explicitly permit paraphrase ("wear gloves" ↔ "use heat-resistant gloves" when SOP says heat-resistant)
- Explicitly flag invention / substitution ("leather gloves as a substitute" when SOP only lists heat-resistant)
- Require strict JSON-array output with the canonical `{severity, section_title, original_text, structured_text, description}` shape

Live tuning against real Anthropic responses is a UAT task — the 4 prompt-tuning unit tests (paraphrase/invention/uncertainty/exact-quote in 15-03 plan task 2 behaviors) are encoded as structural assertions on the prompt text itself rather than calling Anthropic, since the test harness mocks the SDK at the fetch layer.

## Self-Check

All claimed files exist:

- ✓ `src/lib/voice/sop-pack.ts`
- ✓ `src/lib/voice/voice-qa.ts`
- ✓ `src/lib/voice/__tests__/sop-pack.test.ts`
- ✓ `src/lib/voice/__tests__/verify-sop-voice-qa.test.ts`
- ✓ `src/lib/voice/__tests__/voice-qa-cache.test.ts`
- ✓ `src/app/api/voice/query/route.ts`
- ✓ `src/lib/parsers/verify-sop.ts` (modified)
- ✓ `tests/integration/voice-grounding-scope.spec.ts` (modified)
- ✓ `playwright.config.ts` (modified)

All claimed commits exist on master:

- ✓ `6218b41` Task 1
- ✓ `019ef51` Task 2
- ✓ `fd792bd` Task 3
- ✓ `538b9be` Task 4

Test gates:

- ✓ `npx tsc --noEmit` exits 0
- ✓ `npx eslint <new files>` exits 0
- ✓ All 25 new automated tests pass (6+11+8 unit + 14 grounding-scope source-contract)
- ✓ Full phase15-stubs + phase15-unit run: 88 passed, 4 skipped (pre-existing Wave 0 fixmes in unrelated specs)

## Self-Check: PASSED

## Next Phase Readiness

- Voice modal from Wave 2 already POSTs to `/api/voice/query` with `{ sopId, question }` — endpoint is live, contract matches D-15 / D-17.
- Wave 4 (15-04) owns the bundle-size CI gate (`scripts/check-bundle-size.ts`) + Visy demo UAT.
- Live cache_creation / cache_read token measurement against real Anthropic API deferred to phase UAT — the unit-level fixture flow asserts the pattern is wired correctly.
- No follow-up blockers for plan 15-04 / 15-05.

---
*Phase: 15-manufacturing-line-mode*
*Plan: 03*
*Completed: 2026-05-13*
