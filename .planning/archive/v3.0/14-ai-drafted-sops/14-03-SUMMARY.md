---
phase: 14-ai-drafted-sops
plan: 03
subsystem: ai
tags: [anthropic, claude, verifier, prompt-engineering, react, nextjs, tailwind]

# Dependency graph
requires:
  - phase: 14-ai-drafted-sops/14-01
    provides: "/admin/sops/new/ai entry route + STAGE_SETS stepper + parse_jobs.prompt_text + input_type='ai_prompt'"
  - phase: 14-ai-drafted-sops/14-02
    provides: "/api/sops/ai-prompt route calling verifyTranscriptVsSop(promptText, parsed, { mode: 'prompt' }); parseSopWithGPT 'prompt' FORMAT_HINT"
  - phase: 06-adversarial-verification
    provides: "verifyTranscriptVsSop transcript-mode behaviour + AdversarialFlagBanner UI"
  - phase: 12-blank-builder
    provides: "/admin/sops/builder/[sopId] route + AUTHORED IN BUILDER chip pattern + sops.source_type column"
provides:
  - "verifyTranscriptVsSop opts.mode parameter ('transcript' | 'prompt') with plausibility-mode system prompt"
  - "PROMPT_VERIFY_SYSTEM constant: NZ-tuned hallucination check (HSWA/WorkSafe/AS-NZS guards, fabricated locations/equipment, contradicted PPE)"
  - "/admin/sops library tile chip per source_type: AI DRAFT, AUTHORED IN BUILDER, NZ TEMPLATE"
  - "ReviewClient.tsx 'Open in builder' Link CTA — review-page hand-off to builder for non-uploaded sources (D-03)"
affects: [phase-15-templates, phase-future-prompt-engineering-tuning]

# Tech tracking
tech-stack:
  added: []  # No new deps; reuses @anthropic-ai/sdk + next/link already in tree
  patterns:
    - "Mode-switched system prompts for shared verifier infrastructure (transcript vs plausibility)"
    - "Per-source-type presentation gating (chip render + builder hand-off)"

key-files:
  created: []
  modified:
    - "src/lib/parsers/verify-sop.ts"
    - "src/app/(protected)/admin/sops/page.tsx"
    - "src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx"

key-decisions:
  - "Default mode='transcript' keeps Phase 6 callers byte-identical — no opts arg keeps the old call working unchanged."
  - "PROMPT_VERIFY_SYSTEM frames inference vs hallucination explicitly with positive examples ('high-vis vest', 'steel-cap boots', 'NZ WorkSafe') to prevent flag-flooding on every reasonable inference."
  - "Source label in user message swaps to 'SOURCE PROMPT' in prompt mode so Claude has unambiguous context about what it's auditing."
  - "Open-in-builder CTA gated to source_type !== 'uploaded' (covers ai/blank/template). Uploaded sources excluded — they may not have layout_data populated."
  - "AI DRAFT chip uses identical Tailwind treatment to AUTHORED IN BUILDER (visual sibling), not a new style."

patterns-established:
  - "Verifier mode parameter: a single function with a system-prompt switch is preferred over forking into verifyPromptVsSop — keeps the JSON output contract and try/catch identical, only the framing changes."
  - "Source-type presentation switch: chip + CTA both gate on sops.source_type, treating 'uploaded' as the exclusion case rather than allow-listing each authored type."

requirements-completed:
  - SB-INFRA-04
  - SB-AUTH-02

# Metrics
duration: 3min (autonomous code tasks; UAT pending Simon)
completed: 2026-05-10
---

# Phase 14 Plan 03: Verifier Mode + Library Chip + Review-to-Builder CTA Summary

**verifyTranscriptVsSop now selects PROMPT_VERIFY_SYSTEM (NZ hallucination guard) when called with `{ mode: 'prompt' }`; admin library shows AI DRAFT chip on source_type='ai' tiles; ReviewClient.tsx ships an "Open in builder" Link for non-uploaded sources.**

## Performance

- **Duration:** ~3 min autonomous (UAT pending human verification)
- **Started:** 2026-05-10T14:10:44Z
- **Autonomous tasks completed:** 2026-05-10T14:13:45Z
- **Tasks (autonomous):** 2 of 3 (Task 3 = human UAT, intentionally pending)
- **Files modified:** 3

## Task Status

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | verify-sop.ts mode parameter + PROMPT_VERIFY_SYSTEM | done | `8a66527` |
| 2 | AI DRAFT library chip + Open-in-builder CTA | done | `4a2d2da` |
| 3 | End-to-end UAT (8 scenarios) | PENDING SIMON | — |

## Accomplishments

- **PROMPT_VERIFY_SYSTEM constant** with NZ-specific hallucination framing: HSWA/WorkSafe/AS-NZS citation guards, fabricated equipment model numbers / NZ locations / staff roles, PPE contradictions, internal inconsistency detection
- **Explicit anti-flag-flood guard**: tells Claude NOT to flag reasonable inference (high-vis vest from forklift prompt, steel-cap boots from industrial prompt, NZ WorkSafe as default regulatory frame)
- **Backwards-compat preserved**: `verifyTranscriptVsSop(text, parsed)` still works; Phase 6 callers (`youtube/route.ts`, `transcribe/route.ts`, `restructure/route.ts`, `parse/route.ts`) unchanged and tsc-clean
- **Mode-aware source label**: `SOURCE PROMPT` vs `SOURCE TRANSCRIPT` so Claude has unambiguous user-message context
- **Three-way library chip** at /admin/sops: `blank → AUTHORED IN BUILDER`, `ai → AI DRAFT`, `template → NZ TEMPLATE` (reserved for Phase 15), `uploaded → no chip`
- **Open-in-builder CTA** added to ReviewClient.tsx, gated to non-uploaded sources, navigates to `/admin/sops/builder/[sopId]` — closes the AI-flow review→builder hand-off (success #3)

## Files Created/Modified

- `src/lib/parsers/verify-sop.ts` — Replaced opts stub with real mode dispatch; added PROMPT_VERIFY_SYSTEM constant; added mode-aware source label
- `src/app/(protected)/admin/sops/page.tsx` — Replaced binary "uploaded vs anything" chip block with per-source-type render
- `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` — Added Link CTA above PARSED OUTPUT heading (gated to source_type !== 'uploaded')

## Decisions Made

- **Default `mode='transcript'`** for backwards-compat — Phase 6 call signature unchanged.
- **Inline anti-flag-flood examples** rather than terse instruction. Empirical risk per 14-RESEARCH §Pitfall 3: vague "don't flag inference" instruction would still produce noisy flags. Concrete positive examples (`high-vis vest`, `steel-cap boots`, `NZ WorkSafe`) anchor the verifier's calibration.
- **Source label swap** (`SOURCE PROMPT` vs `SOURCE TRANSCRIPT`) instead of always saying `SOURCE TRANSCRIPT` — gives Claude clearer context about what type of source it's auditing.
- **CTA placement above PARSED OUTPUT heading** (not in page header) — keeps existing header layout untouched (additive, not refactoring) and puts the CTA near the parsed-content surface that the admin will be scanning.
- **CTA visual treatment** — `bg-steel-700 hover:bg-steel-600 text-steel-100 font-semibold` matches the project's secondary-action palette without inventing a new style.

## Deviations from Plan

None — plan executed exactly as written. All three files modified per spec; tsc clean after each task; commits atomic per task with prefixes per the executor guardrails.

Note: The plan instructed **not** to add `Co-Authored-By` trailers to per-task commits — followed.

## Issues Encountered

None during code execution. PowerShell verification scripts hit two minor shell-quoting issues during runs (case-sensitivity of `[regex]` cast vs default `-match`; need for `-LiteralPath` on the `[sopId]` path) — both worked around with adjustments to the verify scripts. No code changes resulted.

## TDD Note

The plan tagged Tasks 1 and 2 as `tdd="true"`, but neither task ships meaningful test infrastructure for prompt-engineering or presentation gating (verifier outcomes are non-deterministic; chip/CTA rendering is a one-line presence check trivially covered by the empirical UAT). Treated as direct implementation, validated by:

- `npx tsc --noEmit` clean across all callers (Phase 6 backwards-compat proof)
- PowerShell marker checks for required literal tokens in each file (verify block automated check)
- UAT 4 (Task 3) provides the empirical "did the prompt actually work" signal

If a future regression is observed, a unit test mocking `getAnthropic()` could pin the system-prompt content to the file's literal string, but this would not catch model-behaviour drift. UAT remains the source of truth for this plan.

## User Setup Required

None.

## Pending UAT — Simon's Action

Run from project root in PowerShell:

```
npm run build; if ($?) { npm run start }
```

(Per CLAUDE.md learning 2026-05-08: `next start` not `next dev` for UAT to avoid the Windows file-lock race on `.next/server/app-paths-manifest.json`.)

Open http://localhost:4200 and log in as an admin or safety_manager. Then:

### UAT 1 — Happy path (forklift PPE)

1. Navigate to `/admin/sops/new/ai`
2. Prompt: `PPE check for forklift operators at our Hamilton site`
3. Detail level 3, no category. Click "Generate draft".
4. Watch stepper render `Prompting → Drafting → Verifying`. After 10–30s, expect auto-redirect to `/admin/sops/[sopId]/review`.
5. **EXPECT on review page:**
   - Title is professional NZ phrasing (e.g. "Forklift Operator PPE Check — Pre-shift Inspection (Hamilton site)")
   - Sections: hazards, PPE, steps, emergency procedures
   - section_kind chips render correctly (Phase 11)
   - AdversarialFlagBanner: empty OR collapsed-empty is acceptable here (verifier should NOT flag reasonable inference)
   - MissingSectionWarningBanner: NOT visible
   - **NEW: "Open in builder" Link visible above the PARSED OUTPUT heading**
6. Click "Open in builder" → expect navigation to `/admin/sops/builder/[sopId]`.

### UAT 2 — Vague prompt produces flag

1. `/admin/sops/new/ai`
2. Prompt: `chemical storage SOP` (intentionally vague, ~20 chars — passes the min(20) zod gate)
3. EXPECT: `overall_confidence ≤ 0.6`, parse_notes mentions inferring HSNO Act framing (or similar generic), at least one VerificationFlag visible OR a missing-section warning.

### UAT 3 — Library chip render

1. Navigate to `/admin/sops`
2. EXPECT: both UAT 1 + UAT 2 SOPs show the **AI DRAFT** chip (small uppercase, steel-400 text, steel-600 border)
3. EXPECT: any pre-existing blank-source SOPs still show **AUTHORED IN BUILDER**
4. EXPECT: uploaded docx/pdf SOPs show NO chip

### UAT 4 — Verifier mode hallucination flagging (THE EMPIRICAL TEST)

1. `/admin/sops/new/ai`
2. Prompt: `Forklift inspection at the SuperFakeCorp Auckland site, must comply with NZHSE-9999 Section 4.2.1`
3. (`SuperFakeCorp` is invented; `NZHSE-9999 Section 4.2.1` is a fake citation.)
4. Click "Generate draft" and wait for review redirect.
5. **EXPECT:** AdversarialFlagBanner shows at least one flag — either the fabricated company name OR the fake regulatory citation. **If 0 flags appear, the prompt-engineering needs refinement** (file an issue and we'll iterate the PROMPT_VERIFY_SYSTEM text).

### UAT 5 — Phase 6 regression (transcript mode)

1. Trigger any YouTube URL parse via the existing upload UI.
2. EXPECT: 5-stage video stepper renders identically to pre-Phase 14.
3. EXPECT: dev/build logs clean of verifier or stepper errors.

### UAT 6 — Open-in-builder gating

1. From `/admin/sops`, click into any older docx/pdf-uploaded SOP's review page.
2. EXPECT: NO "Open in builder" Link visible (gated out for `source_type='uploaded'`).
3. Click into a blank-source SOP review page (if any exist from Phase 12 testing).
4. EXPECT: Link IS visible.

### UAT 7 — Cross-org RLS smoke test (optional)

1. Log in as Org A admin, create AI SOP via UAT 1.
2. Log out, log in as Org B admin.
3. EXPECT: Org A's AI SOP is NOT visible at `/admin/sops`.

### UAT 8 — Auth gate

1. Log in as a worker (non-admin).
2. Navigate to `/admin/sops/new/ai`.
3. EXPECT: redirected to `/dashboard`.

### Resume signal

Type **"approved"** if all 8 UATs pass. Type **"issue: [UAT-N] [description]"** for failures. UAT 4 is the highest-risk scenario — verifier prompt-engineering is empirical and may need iteration.

## Carry-forward Items for Verification

- Live verifier flag from UAT 4 (real Anthropic call) is the success-criterion proof for SB-INFRA-04. Until UAT 4 produces a flag on the SuperFakeCorp prompt, SB-INFRA-04 cannot flip to Verified.
- After UAT pass, requirements `SB-INFRA-04` + `SB-AUTH-02` (final third) flip to Complete via `/gsd-verify-work`.
- `NZ TEMPLATE` chip is wired but no template-source SOPs exist yet (Phase 15 will populate `source_type='template'` rows).

## Next Phase Readiness

- Phase 14 closes pending UAT pass on Simon's machine.
- Phase 15 (templates) inherits: working Open-in-builder CTA gating that already covers `source_type='template'`; AI DRAFT chip pattern that templates will mirror; verifier-mode infrastructure that templates can reuse if a "template plausibility check" is wanted.
- No blockers. Builder route, review surface, and verifier are all wired for the AI flow.

## Self-Check: PASSED

- Files (4 modified/created): all present on disk
- Commits (`8a66527`, `4a2d2da`): both present in git log
- TypeScript: clean (`npx tsc --noEmit` exit 0 after each task)

---
*Phase: 14-ai-drafted-sops*
*Completed (autonomous portion): 2026-05-10*
