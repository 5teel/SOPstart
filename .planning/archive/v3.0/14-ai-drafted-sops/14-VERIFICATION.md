---
phase: 14-ai-drafted-sops
verified: 2026-05-11T00:00:00Z
status: human_needed
score: 9/9 must-haves verified (UAT pending for SB-INFRA-04 empirical proof)
overrides_applied: 0
human_verification:
  - test: "UAT 1 — Forklift PPE happy path"
    expected: "/admin/sops/new/ai → prompt 'PPE check for forklift operators at our Hamilton site' → 3-stage stepper renders → redirect to review with hazards/PPE/steps/emergency sections + Open in builder Link visible"
    why_human: "Requires live Anthropic API call (10-30s); empirical model output cannot be asserted programmatically"
  - test: "UAT 2 — Vague prompt produces low confidence"
    expected: "Prompt 'chemical storage SOP' → overall_confidence ≤ 0.6 + parse_notes references HSNO/inference + at least one VerificationFlag visible"
    why_human: "Empirical Anthropic behaviour; deterministic mock cannot prove calibration"
  - test: "UAT 4 — Hallucination flagging (THE empirical test for SB-INFRA-04)"
    expected: "Prompt with 'SuperFakeCorp' + 'NZHSE-9999 Section 4.2.1' → AdversarialFlagBanner shows ≥1 flag against the fabricated company OR fake citation"
    why_human: "Verifier prompt-engineering effectiveness is non-deterministic; only a real Anthropic call against PROMPT_VERIFY_SYSTEM proves D-02 framing works"
---

# Phase 14: AI-Drafted SOPs — Verification Report

**Phase Goal:** Admin types a natural-language prompt → Claude drafts a structured SOP (hazards/PPE/steps/emergency) → adversarial verifier flags hallucinations in prompt-mode framing → admin lands on review page with flags visible → can hand off to the unified builder.

**Verified:** 2026-05-11
**Status:** human_needed (autonomous code complete; UAT 1/2/4 require live Anthropic API)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (goal-backward)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can navigate to `/admin/sops/new/ai` and submit a NL prompt; auth-guarded to admin/safety_manager | VERIFIED | `src/app/(protected)/admin/sops/new/ai/page.tsx:13-26` (organisation_members.role guard, redirect to /dashboard for non-admin); `PromptClient.tsx:30,40` (zodResolver(aiPromptSchema) + POST `/api/sops/ai-prompt`) |
| 2 | Zod validator enforces min(20)/max(2000) chars + detailLevel 1-5 | VERIFIED | `src/lib/validators/sop.ts:159-168` — literal `.min(20)`, `.max(2000)`, `z.number().int().min(1).max(5).default(3)`, `AiPromptInput` exported |
| 3 | POST `/api/sops/ai-prompt` creates sops (source_type='ai') + parse_jobs (input_type='ai_prompt', prompt_text populated) | VERIFIED | `src/app/api/sops/ai-prompt/route.ts:66` (`source_type: 'ai'`), `:86-88` (`input_type: 'ai_prompt'`, `prompt_text: promptText`), `:42-48` aiPromptSchema re-validation |
| 4 | parseSopWithGPT called with `sourceMode: 'prompt'`; FORMAT_HINTS.prompt selects NZ-tuned NL framing | VERIFIED | `route.ts:107` (`{ sourceMode: 'prompt', detailLevel }`); `gpt-parser.ts:104` (FORMAT_HINTS keyspace `Partial<Record<SourceFileType \| 'prompt', string>>`); `:120-129` MAXIMUM inference + NZ WorkSafe + HSNO + AS/NZS framing present |
| 5 | verifyTranscriptVsSop called with `mode: 'prompt'` and PROMPT_VERIFY_SYSTEM swaps system prompt | VERIFIED | `route.ts:115` (`{ mode: 'prompt' }`); `verify-sop.ts:62-69` (signature accepts opts.mode; `mode === 'prompt' ? PROMPT_VERIFY_SYSTEM : ADVERSARIAL_SYSTEM`); `:17-36` PROMPT_VERIFY_SYSTEM contains 'reasonably INFERRED', 'fake regulatory citations', 'high-vis vest', 'NZ WorkSafe' anti-flag-flood examples; default `'transcript'` keeps Phase 6 byte-identical |
| 6 | Each parsed section gets section_kind_id resolved against canonical kinds (hazards/ppe/steps/emergency) | VERIFIED | `route.ts:124-141` one-shot fetch of `section_kinds`, slug→id map, exact-then-substring resolver returning null fallback; `:173` `section_kind_id: sectionKindId` on insert |
| 7 | ParseJobStatus stepper renders 3-stage AI set when input_type='ai_prompt'; both SELECT projections include input_type; video flows byte-identical | VERIFIED | `ParseJobStatus.tsx:37-47` (STAGE_SETS map with `prompting → drafting → verifying`; video_file/youtube_url alias preserved); `:97` + `:120` both SELECT projections include `input_type` (I-2 closed); `:180-184` activeStageSet derivation; `:197` endpoint dispatch `inputType === 'ai_prompt' ? '/api/sops/ai-prompt' : ...` |
| 8 | Admin lands on `/admin/sops/[sopId]/review` (NOT directly the builder); D-03 hand-off via Open-in-builder CTA | VERIFIED | `PromptClient.tsx:68` (`onCompleted: () => router.push(/admin/sops/${sopId}/review)`); `ReviewClient.tsx:373-378` NEW `<Link href={/admin/sops/builder/${sop.id}}>Open in builder</Link>` gated to `source_type !== 'uploaded'` (covers ai/blank/template; excludes uploaded). CTA confirmed added by 14-03 (was absent prior — 14-CONTEXT.md grep claim). |
| 9 | `/admin/sops` library renders AI DRAFT chip when source_type='ai'; AUTHORED IN BUILDER + NZ TEMPLATE chips also wired | VERIFIED | `src/app/(protected)/admin/sops/page.tsx:168-182` per-source-type chip block (blank → AUTHORED IN BUILDER, ai → AI DRAFT, template → NZ TEMPLATE); identical Tailwind treatment as existing chip; `:60` SELECT includes `source_type` so the column reaches the render. |

**Score:** 9/9 truths verified (autonomous code complete).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00029_ai_prompt_input_type.sql` | input_type CHECK extension + prompt_text column | VERIFIED | All 6 input_type values present in CHECK; idempotent DO $$ BEGIN…EXCEPTION block; `prompt_text TEXT NULL` with COMMENT; no destructive operations |
| `src/types/database.types.ts` | Manual extension for prompt_text | VERIFIED (per 14-01-SUMMARY commit d78d191) | parse_jobs Row/Insert/Update gain `prompt_text` |
| `src/types/sop.ts` | InputType + ParseJob.prompt_text | VERIFIED | line 16 `InputType` union includes 'ai_prompt'; line 138 `prompt_text?: string \| null` |
| `src/lib/validators/sop.ts` | aiPromptSchema | VERIFIED | line 159-168 |
| `src/lib/parsers/gpt-parser.ts` | opts signature + 'prompt' FORMAT_HINT | VERIFIED | lines 104-130 keyspace + hint; lines 168-180 dual-shape signature |
| `src/lib/parsers/verify-sop.ts` | mode parameter + PROMPT_VERIFY_SYSTEM | VERIFIED | lines 17-36 (PROMPT_VERIFY_SYSTEM); lines 38-50 (ADVERSARIAL_SYSTEM unchanged); lines 62-69 (mode dispatch) |
| `src/app/api/sops/ai-prompt/route.ts` | full pipeline | VERIFIED | All 19 plan-mandated literals present (auth, role, aiPromptSchema, source_type='ai', input_type='ai_prompt', prompt_text, sourceMode='prompt', mode='prompt', section_kinds, section_kind_id, all 3 stage labels, failed-stage catch with current_stage + error_message) |
| `src/app/(protected)/admin/sops/new/ai/page.tsx` | server route + auth guard | VERIFIED | organisation_members.role check; redirects to /login + /dashboard correctly |
| `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx` | client form | VERIFIED | RHF + zodResolver(aiPromptSchema), POST to /api/sops/ai-prompt, ParseJobStatus on success, redirect to /admin/sops/[id]/review on completion |
| `src/components/admin/ParseJobStatus.tsx` | STAGE_SETS map + I-2 SELECT projections | VERIFIED | both SELECT lines include input_type; activeStageSet logic; legacy VIDEO_STAGES alias preserved |
| `src/app/(protected)/admin/sops/page.tsx` | per-source-type chips | VERIFIED | lines 168-182 |
| `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` | Open in builder CTA | VERIFIED | lines 373-378; gated to non-uploaded |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| PromptClient.tsx | /api/sops/ai-prompt | `fetch('/api/sops/ai-prompt', {method: 'POST'})` | WIRED (line 40) |
| /api/sops/ai-prompt route | parseSopWithGPT | `parseSopWithGPT(promptText, { sourceMode: 'prompt', detailLevel })` | WIRED (route.ts:107) |
| /api/sops/ai-prompt route | verifyTranscriptVsSop | `verifyTranscriptVsSop(promptText, parsed, { mode: 'prompt' })` | WIRED (route.ts:115) |
| /api/sops/ai-prompt route | section_kinds resolver | `admin.from('section_kinds').select('id, slug')` → slug→id map | WIRED (route.ts:126-141) |
| /api/sops/ai-prompt route | parse_jobs INSERT input_type='ai_prompt' | direct INSERT | WIRED (route.ts:86) |
| ReviewClient.tsx | /admin/sops/builder/[sopId] | `<Link href={/admin/sops/builder/${sop.id}}>Open in builder</Link>` | WIRED (line 373-378), gated to non-uploaded |
| /admin/sops/page.tsx | source_type column | `.select('…, source_type, …')` (line 60) → per-type chip render | WIRED |
| ParseJobStatus.tsx | input_type column | both SELECT projections include it (lines 97 + 120); Realtime payload reads at line 163 | WIRED |
| Phase 6 callers (youtube/transcribe/parse/restructure) | parseSopWithGPT | all migrated to opts shape `{ sourceMode: 'video', … }` | WIRED — no Phase 6 regression. restructure/route.ts:55 = `{ sourceMode: 'video', detailLevel: detailLevel ?? 3 }` (I-1 cleared) |

### Data-Flow Trace (Level 4)

| Artifact | Data Source | Produces Real Data | Status |
|----------|-------------|--------------------|--------|
| PromptClient form → API | Form values → `/api/sops/ai-prompt` body | Yes — POST with JSON body | FLOWING |
| API route → Anthropic | `parseSopWithGPT(promptText, {sourceMode:'prompt'})` | Yes — real Anthropic call (live API), not stubbed | FLOWING (subject to UAT) |
| API route → DB sections | `parsed.sections` loop with `sort_order: section.order`, `section_kind_id: resolveKindId(...)` | Yes — real INSERTs per parsed section | FLOWING |
| ReviewClient → AdversarialFlagBanner | parse_jobs.verification_flags (already wired Phase 6) | Yes — populated at route.ts:119-122 | FLOWING |
| /admin/sops chips | sops.source_type | Yes — column queried at line 60, rendered conditionally at 168-182 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0, no errors | PASS |
| Migration file syntactically valid SQL | Read 00029 + check for required tokens | All 6 input_type values present, prompt_text column declared, idempotent DROP pattern | PASS |
| Phase 6 callers migrated | `grep "sourceMode" src/app/api/sops/{youtube,transcribe,parse,restructure}/route.ts` | All 4 callers use `{ sourceMode: 'video' or fileType }` shape | PASS |
| Verifier backwards-compat | `verifyTranscriptVsSop(text, parsed)` (no opts) → defaults `mode='transcript'` → uses ADVERSARIAL_SYSTEM | verify-sop.ts:67-68 confirms default | PASS |
| Live Anthropic call produces SOP with hazards/PPE/steps/emergency | UAT 1 (forklift prompt) | requires live API + admin login | SKIP (routed to human) |
| Hallucination flag fires on SuperFakeCorp/NZHSE-9999 | UAT 4 | requires live API + admin login | SKIP (routed to human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SB-AUTH-02 | 14-01, 14-02 | Admin types NL prompt → structured draft with hazards/PPE/steps/emergency pre-filled for review | SATISFIED (autonomous) — UAT 1 confirms empirically | Entry route + route.ts pipeline + section_kind_id resolver + redirect to review (truths 1-4, 6, 8) |
| SB-INFRA-04 | 14-03 | AI-drafted content passes Phase 6 adversarial verifier; hallucinated hazards/missing PPE flagged before reviewer | SATISFIED (code) — NEEDS UAT 4 for empirical proof | verify-sop.ts mode='prompt' + PROMPT_VERIFY_SYSTEM (truth 5); AdversarialFlagBanner already wired Phase 6 |

No orphaned requirements — REQUIREMENTS.md maps SB-AUTH-02 + SB-INFRA-04 to Phase 14, and both are claimed by 14-01/14-02/14-03 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | All grep hits for TODO/FIXME/placeholder/etc. resolved to legitimate HTML `placeholder=` attributes on the prompt textarea (UI hint text, not stub markers) |

No anti-patterns. The deferred items in 14-02-SUMMARY.md (`require('ffmpeg-static')` ESLint, unused `sop` var in restructure/route.ts, unused `failedStageName` / `onRetry` voids in ParseJobStatus.tsx) are all **pre-existing** code — not introduced by Phase 14, and explicitly logged as out-of-scope.

### Decisions D-01..D-06 Disposition

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01: Use Anthropic Claude (not GPT-4o) | HONORED | gpt-parser.ts continues to use `claude-haiku-4-5-20251001` triage + `claude-sonnet-4-6` parse; new `'prompt'` FORMAT_HINTS entry runs through the same Claude path |
| D-02: Verifier mode parameter | HONORED | verify-sop.ts:62-69 — opts.mode dispatch; PROMPT_VERIFY_SYSTEM is a real plausibility-mode prompt (not a stub); default `'transcript'` keeps Phase 6 byte-identical |
| D-03: Hand-off lands on review, not builder | HONORED | PromptClient.tsx:68 redirect to /review; ReviewClient.tsx:373-378 NEW Open-in-builder CTA gated to non-uploaded sources |
| D-04: Persist prompt_text on parse_jobs | HONORED | Migration 00029 adds column; route.ts:88 inserts prompt_text |
| D-05: AI DRAFT library chip | HONORED | admin/sops/page.tsx:173-176 |
| D-06: Zod min(20) | HONORED | validators/sop.ts:162 |

### Human Verification Required

3 UATs require a live Anthropic API call against the running app — they cannot be verified by static analysis or by mocking, because the value of D-02 (PROMPT_VERIFY_SYSTEM framing effectiveness) and the model's ability to produce hazards/PPE/steps/emergency from a brief NZ industrial prompt are empirical properties.

#### 1. UAT 1 — Forklift PPE happy path (SB-AUTH-02 empirical)

**Test:** Log in as admin/safety_manager → `/admin/sops/new/ai` → prompt `PPE check for forklift operators at our Hamilton site` → detail 3 → Generate.
**Expected:**
- Stepper: `Prompting → Drafting → Verifying`
- After 10-30s, redirect to `/admin/sops/[sopId]/review`
- Review page contains: title in NZ-professional phrasing, sections covering hazards/PPE/steps/emergency, section_kind chips rendered (Phase 11 join active), AdversarialFlagBanner empty-or-collapsed (well-formed prompt should not flag inferences), MissingSectionWarningBanner not visible, **NEW "Open in builder" Link visible**
- Click Open in builder → /admin/sops/builder/[sopId]
**Why human:** Live Anthropic API call (≥10s) + non-deterministic model output cannot be asserted programmatically.

#### 2. UAT 2 — Vague prompt produces low confidence

**Test:** `/admin/sops/new/ai` → prompt `chemical storage SOP` (~20 chars; passes min(20)).
**Expected:** `overall_confidence ≤ 0.6`, parse_notes references HSNO Act / generic framing, ≥1 VerificationFlag visible OR a missing-section warning.
**Why human:** Empirical Anthropic behaviour against `'prompt'` FORMAT_HINT calibration.

#### 3. UAT 4 — Hallucination flagging (THE empirical proof of SB-INFRA-04)

**Test:** `/admin/sops/new/ai` → prompt `Forklift inspection at the SuperFakeCorp Auckland site, must comply with NZHSE-9999 Section 4.2.1` → Generate.
**Expected:** AdversarialFlagBanner shows ≥1 flag — either against the fabricated company name `SuperFakeCorp` OR the fake regulatory citation `NZHSE-9999 Section 4.2.1`.
**Why human:** This is the deliberate empirical test for D-02. PROMPT_VERIFY_SYSTEM framing effectiveness can only be proven by a real Anthropic call. **If 0 flags appear, prompt-engineering needs iteration.**

UAT 3 (library chip), UAT 5 (Phase 6 regression), UAT 6 (Open-in-builder gating), UAT 7 (cross-org RLS), UAT 8 (auth gate) are also human-verifiable but are routine smoke tests fully backed by the static analysis above (chip rendering, gating logic, auth guard all confirmed in code). They are nice-to-haves; the three UATs above are the load-bearing checks.

### Gaps Summary

**No code gaps.** All autonomous tasks across 14-01, 14-02, 14-03 have shipped — every plan-mandated literal, route, type, validator, migration, chip, and CTA is present in the codebase, tsc-clean, with Phase 6 backwards-compat preserved (all four legacy callers migrated to the opts shape; restructure I-1 cleared).

The phase is **structurally complete and ready for human UAT** to empirically confirm the verifier prompt-engineering (D-02) actually flags hallucinations on a known-bad prompt — this is the only remaining checkpoint and was deliberately gated as `autonomous: false` in 14-03 plan.

### Phase 6 Regression Check

All four pre-Phase-14 callers of `parseSopWithGPT` migrated to opts shape:

- `youtube/route.ts:123` → `{ sourceMode: 'video' }`
- `transcribe/route.ts:176` → `{ sourceMode: 'video' }`
- `parse/route.ts:113` → `{ sourceMode: fileType }`
- `restructure/route.ts:55` → `{ sourceMode: 'video', detailLevel: detailLevel ?? 3 }`

Default `mode='transcript'` in verifier preserves Phase 6 verifier behaviour byte-identical. Legacy `VIDEO_STAGES` alias preserved in ParseJobStatus.tsx STAGE_SETS map. tsc clean.

---

*Verified: 2026-05-11*
*Verifier: Claude (gsd-verifier)*
