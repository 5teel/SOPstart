---
spike: 003
name: ai-reviewer-omission-anchoring
validates: "Given a real industrial-SOP PDF + a structured draft, when Claude runs Job B (omission reverse-scan) and Job C (anchoring check), then both detect deliberately-injected defects (1 dropped safety step + 1 swapped photo anchor) while NOT false-positiving on a clean control draft. Token cost ≤ $0.10/SOP for the pair."
verdict: VALIDATED
related: ["001-pdf-image-extraction-bundle-safe"]
tags: [phase-20, conversion-pipeline-v2, ai-reviewer, layer-2-verification, plan-20-04-gate, anthropic]
date_completed: 2026-05-15
gates: phase-20-plan-20-04
---

# Spike 003: AI Reviewer — Omission (Job B) + Anchoring (Job C)

## What This Validates

D-CV2-04 Layer 2 of Conversion Pipeline V2 is the AI reviewer. Phase 6 already ships **Job A** (hallucination check against transcripts). Phase 20 adds four new jobs (B–E). This spike validates the two highest-risk additions:

- **Job B — omission reverse-scan**: read the SOURCE, list safety-critical content that's MISSING from the draft
- **Job C — anchoring check**: for each photo attached to a step, verify the photo's caption/subject actually relates to that step's instructions

If Job B can't catch a dropped safety warning, Layer 2 has no defence against "draft is technically correct but missed the most important thing." If Job C can't catch a wrong photo anchor, "AI rearranged the SOP and put the wrong photo on a step" passes review silently. Either failure would torpedo the D-CV2-04 verification model.

## How to Run

```powershell
cd C:\Development\SOPstart\.planning\spikes\003-ai-reviewer-omission-anchoring\experiment; node extract-source.mjs medium-forming-swabbing.pdf; node build-drafts.mjs; $env:NODE_TLS_REJECT_UNAUTHORIZED=0; node differential.mjs
```

Three phases:

1. `extract-source.mjs` — pdfjs `getTextContent` per page + Spike 001's `_report.json` for image positions → `fixture/source.json` (~18 KB text + 40 image records)
2. `build-drafts.mjs` — hand-curated structured draft of the 19-page glass-forming SOP into 8 sections / 36 steps / 6 photo anchors. Then deterministically corrupts it: (B) drops one critical safety step, (C) swaps one photo's step anchor
3. `differential.mjs` — runs Jobs B + C against both `clean` and `corrupted` drafts, compares with deterministic regex assertions, writes `results/results.json` + prints a verdict line

`NODE_TLS_REJECT_UNAUTHORIZED=0` is required only because of the corporate TLS cert intercept on this machine (same root cause as Spike 001 & 002's `npm --strict-ssl=false` and `git -c http.sslVerify=false push`).

## What to Expect

- `fixture/source.json` (~18 KB text, 40 image refs)
- `fixture/draft.clean.json`, `fixture/draft.corrupted.json`, `fixture/expected-defects.json`
- `results/results.json` with full Claude responses + verdict block
- Total API spend: **~$0.06**

## Results

### Verdict

| Job | Clean run flags | Corrupted run flags | Caught injection? | Verdict |
|---|---|---|---|---|
| **B** (omission) | 5 (simplification artifacts only) | 5 — including #1 critical: *"Do not put your thumb or finger through the ring … Serious injuries to your thumb or fingers may result (repeated 4× in source)"* | ✅ exact target step | **PASS** |
| **C** (anchoring) | 0 | 1 — `photo_id=photo-swab-cycle-switch` attached to `step-mould-5` should be at `step-swab-3` per source | ✅ exact target + correct suggested re-anchor | **PASS** |

Both jobs caught their injected defect with high specificity AND zero false-positives on the clean control. Clean run's Job B flags are all artifacts of my intentionally-simplified hand-authored "clean draft" — they're real omissions vs the source, just not the **injected** one. Job C scored 0/0 false-positives on clean which is the cleaner signal.

### Token + latency measurements (Sonnet 4.5)

| Run | Job | Wall ms | Input tokens | Cache create | Cache read | Output tokens | Cost USD |
|---|---|---:|---:|---:|---:|---:|---:|
| clean | B | 11 206 | 2 901 | 5 199 (first run) | 0 | 537 | $0.0183 |
| clean | C | 3 043 | 2 899 | 0 | 5 202 ← **cache HIT** | 9 | $0.0104 |
| corrupted | B | 13 341 | 2 790 | 0 | 5 199 ← **cache HIT** | 616 | $0.0192 |
| corrupted | C | 5 398 | 2 788 | 0 | 5 202 ← **cache HIT** | 212 | $0.0131 |
| **total** | | | | | | | **$0.0610** |

Cache hit rate after the first call: **100 %** within the 5-minute ephemeral window. Cost on the 2nd–4th calls is ~64% lower than the first call would be without caching.

### Cost projection at Visy scale

Assumptions: 100 sites × ~50 SOPs/site = 5 000 SOPs; each SOP goes through one parse + 3 admin-triggered reviewer re-runs after edits.

- Jobs B + C per SOP (first run): **$0.03**
- Jobs B + C per re-run (cached, within 5 min of last call): **$0.02**
- 5 000 SOPs × (1 first + 3 cached re-runs) × ($0.03 + 3 × $0.02) / 2 (B+C only): **~$225–450** total at Sonnet pricing for Visy onboarding

Phase 20 plans 5 jobs (A–E). Approximate total reviewer cost ≈ 3× the B+C figure: **$700–1 500** for the Visy onboarding life-cycle. Tractable; well within any normal SaaS COGS budget.

Per-SOP at Haiku 4.5 pricing would be ~5–10× cheaper. Plan 20-04 should A/B Sonnet vs Haiku on a held-out corpus before locking the model — this spike used Sonnet for the rigour question, but Haiku may suffice in production.

## Key discoveries

| # | Discovery |
|---|---|
| 1 | **Prompt cache works across two jobs with different system prompts** — but only the second job hits cache, NOT both jobs in the same run. Reason: the cache key includes the system prompt + content prefix; different system prompts = different cache keys. Cache hits inter-run (within the 5-min window), not intra-run. Plan 20-04 implication: order Jobs B → C → D → E in the same call session to maximise cache reuse; or unify system into one prompt and dispatch jobs via the user-message tail (cache hits 100%). |
| 2 | **Verbose prompts produce verbose responses** — first cut of Job B with no length cap returned 7 KB+ of flags on a simplified clean draft, blowing past `max_tokens=1500`. Tightening to *"report at most TOP 5, descriptions ≤ 100 chars"* in the system prompt gave clean 540-token responses. Plan 20-04 prompts must include explicit verbosity caps. |
| 3 | **Job C is dramatically cheaper than Job B** — when there are zero anchoring errors, Job C returns `[]` in 9 output tokens. Compared with Job B's ~540-output-token baseline, that's a 60× output-cost ratio. Implication: Job C can run more aggressively (every save during editing) without driving cost. Job B should run less aggressively (parse-completion + explicit admin re-trigger only). |
| 4 | **Differential scoring assertion regex needs word boundaries** — first verdict check used `/thumb\|finger\|ring/i` which falsely matched "ring" inside "trai**n**ing" and "starti**n**g". Plan 20-04 acceptance tests must use `\b` boundaries when asserting on flag content. Logged in the spike's own scoring code as a comment. |
| 5 | **Job B's first flag on the corrupted draft was THE injected defect** — sorted by severity:critical first, source-citation included page numbers 5/7/11/15 (the source repeats the warning 4 times). The reviewer surfaces multi-occurrence safety warnings as higher priority — useful signal for ranking flags in the admin UI. |
| 6 | **Sonnet 4.5 ID was `claude-sonnet-4-5`** in this run (not `claude-sonnet-4-6` as the global system prompt suggests). Anthropic accepted that model name and returned valid responses with `service_tier: 'standard'`. Plan 20-04 should pin the model ID once after a fresh `claude-api` skill consultation. |

## Feasibility assessment

D-CV2-04 Layer 2 (AI reviewer) is feasible for Jobs B and C with the existing Anthropic SDK. **No new infrastructure required.** Cost is bounded, latency is acceptable (≤ 13s per job), accuracy is precise on the injected defects, and prompt caching delivers ~64% input-token savings on every call after the first within a session.

## Signal for the build (Plan 20-04)

1. Reuse the existing `verify-sop.ts` lazy-Anthropic-singleton pattern + `fetch` indirection (Phase 15 fix). The spike's `reviewer.mjs` is a working sketch of the Jobs B + C system prompts.
2. **Output-length cap in the prompt is mandatory.** Use *"report at most TOP 5 …"* + *"description ≤ 100 chars"* phrasing; set `max_tokens` to 1500–2000 (NOT default of 4096).
3. Run Jobs B + C in one HTTP session per (sop_id, version_id) so the source content's ephemeral cache covers both. Job ordering should be A → B → C → D → E with the source as the cached prefix.
4. Job C can fire on every save (cheap when clean: 9 output tokens, ~$0.01). Job B fires on parse-completion + explicit admin re-trigger only (~$0.02 per run, slow output).
5. Flag UI ranking: sort by `severity:critical` first, then by `source_location_hint` containing multiple page references (proxy for "warning repeated in source = more important").
6. Add a Plan 20-04 acceptance test that injects a known omission + known anchoring defect into a sample SOP, runs the reviewer, asserts both are flagged with the correct severity. This spike's `expected-defects.json` shape is the contract: `{ omission: {droppedStepId}, anchoring: {photoId, truthfulAnchor, wrongAnchor} }`.
7. Add a `claude-api` skill consult before locking the model ID — Sonnet 4.5 worked, but verify whether Haiku 4.5 catches the same defects at 5–10× lower cost. The differential harness here is the reusable proving ground.

## Out-of-scope for this spike

- Jobs D (safety completeness against NZ-industry minimums) and E (clarity/jargon) — separate spike if needed, but pattern from B+C extends directly
- Cost optimisation via Haiku — Plan 20-04 owns the model A/B
- Per-day re-run cap (open scope decision 5 in the roadmap entry) — UX/policy, not feasibility
- Streaming output for early-flag display in the admin UI — Plan 20-04 ergonomic, not feasibility
- Multi-language SOPs (corpus is English) — Plan 20-04 should re-validate before any Pacific Spanish / Mandarin Visy plant
