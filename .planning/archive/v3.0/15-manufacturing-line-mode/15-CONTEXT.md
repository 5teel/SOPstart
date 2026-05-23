# Phase 15: Manufacturing-Line Mode - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A SafeStart PWA tab opened on a shared shop-floor Windows desktop renders a **desktop-optimised SOP walkthrough** (big-text, far-readable, seated at 22"+ HD monitor) with **voice Q&A grounded to the current SOP** and **sub-trade role tagging** on workers. Same PWA, no separate kiosk app, no separate route group — a viewport-aware layout variant plus net-new voice and role features.

Scoped as Phase 15a (the demo wedge to Bryce at Visy). Phase 15b (governance, lifecycle, training-record export, auth/PIN attribution, Discipline Leader role + approval workflow) is out of this phase entirely.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `15-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `15-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Desktop walkthrough layout (viewport-aware)
- Sequential walkthrough enforcement on both layouts
- Voice Q&A endpoint + UI on the walkthrough page (grounded to current SOP only)
- Sub-trade tags on workers + SOP-to-sub-trade assignment + admin UI
- Bundle-isolation verification for the mobile worker route

**Out of scope (from SPEC.md):**
- Auth / PIN / badge attribution on completion (POC has timestamp-only)
- Site tier in multi-tenancy (cancelled entirely from Phase 15)
- SOP governance & lifecycle, multi-step approval, Discipline Leader role → Phase 15b
- Training-record / competency export, Success Factors integration → Phase 15b
- Bulk SOP import tool (not in Phase 15 at all)
- Spoken/TTS playback of voice-Q&A answers (stretch only; text answer is core)
- Voice grounding across block library + global blocks (current SOP only in 15a)
- Dedicated kiosk application or locked browser shell (rejected)
- Touchscreen support (mouse + keyboard only)

</spec_lock>

<decisions>
## Implementation Decisions

### Layout switching mechanism

- **D-01:** Use a **runtime viewport-detection hook** (`useViewport` or equivalent based on `window.matchMedia`) that picks `DesktopWalkthrough` vs `MobileWalkthrough` component. Different DOM trees per variant — NOT a single component with CSS media queries.
- **D-02:** Each variant component is **code-split via dynamic import** so the mobile walkthrough does not download desktop code and vice versa. Honours SPEC requirement 6 (bundle isolation ≤ 2 KB growth on the mobile route).
- **D-03:** Breakpoint: viewport width **≥ 1024px** → desktop variant; otherwise mobile variant. No intermediate "tablet" mode. Resize crosses the breakpoint hot — viewport hook re-renders the swap.
- **D-04:** SSR-mismatch safety: initial server render emits the mobile variant; the viewport hook checks `window.matchMedia` on mount and swaps to desktop if applicable. A brief mobile-render flash on a desktop client is acceptable for v1 (operators won't notice on a hot-reload-free production load). If the flash is visible in QA, mitigate via a `data-initial-viewport` cookie set on first paint.

### Voice Q&A retrieval and accuracy

- **D-05:** **No retrieval layer.** The entire SOP (sections + sop_section_blocks with snapshotted block content) is packed into the Claude prompt as system context with explicit grounding instructions ("answer only from this content; cite the section you used"). Chosen over pgvector / FTS / pg_trgm because for SOP-sized documents (~5-15K tokens) full-context eliminates retrieval-miss failure modes entirely — non-negotiable for safety-critical content.
- **D-06:** **Adversarial verifier layer** (Phase 14 pattern applied here). Two-call architecture:
  1. **Answer call** — `claude-haiku-4-5` reads full SOP + question → returns answer + cited section IDs
  2. **Verifier call** — `claude-haiku-4-5` reads original SOP + answer + claimed citations → confirms each claim is present in the cited section. If any claim is ungrounded, returns "I'm not certain — please re-check the SOP directly" with the unverified claim flagged.
- **D-07:** Reuses `src/lib/parsers/verify-sop.ts` infrastructure with a new `mode: 'voice_qa'` parameter (parallel to the Phase 14 `mode: 'prompt'` extension). Same shape: `{ mode, transcript_or_prompt_or_question, parsed_answer }` → `VerificationFlag[]`. PROMPT_VERIFY_SYSTEM gets a sibling constant `VOICE_QA_VERIFY_SYSTEM`.
- **D-08:** **Claude model**: `claude-haiku-4-5-20251001` for BOTH the answer call and the verifier call. Latency target: ≤ 2s total (1s answer + 1s verifier) on a 10-15K-token SOP. Cost target: ≤ $0.005 per question.
- **D-09:** **pgvector / embeddings are explicitly deferred** to Phase 15b or later. They become necessary only if SOPs grow beyond ~200 pages (regulatory mega-docs) — Visy's `ENF4-03-031 Blank Side Hanger` is nowhere near that.

### Sub-trade tag schema

- **D-10:** **Junction-table schema**, NOT a `text[]` column or enum:
  - `sub_trades` table: `(id uuid pk, slug text unique, label text, sort_order int)` — controlled vocabulary, seeded with Operator, Fitter, Sparky, Maintainer, Other.
  - `users_sub_trades` junction: `(user_id uuid fk, sub_trade_id uuid fk, primary key (user_id, sub_trade_id))` — many-to-many; a worker can hold multiple sub-trades.
  - `sops_sub_trades` junction: `(sop_id uuid fk, sub_trade_id uuid fk)` — many-to-many; an SOP can target multiple sub-trades (or none, meaning "all workers").
- **D-11:** RLS extension: SOP visibility rule extends from `(role = 'worker' AND sop.role_assignment ∈ user_roles)` to also gate on `sops_sub_trades` when the SOP has any sub-trade rows. Empty `sops_sub_trades` for a SOP means "all workers regardless of sub-trade" (backward compat).
- **D-12:** Admin team-management UI gains a multi-select tag picker per worker — reuses Phase 13 `BlockPicker`-style multi-select component pattern if compatible, else builds a small standalone control. Admin SOP-assignment UI (`/admin/sops/[sopId]/assign`) gains a sub-trade multi-select alongside the existing role picker.
- **D-13:** Sub-trade seed list (initial controlled vocabulary): `operator`, `fitter`, `sparky`, `maintainer`, `other`. Migration includes the seed insert. Admins cannot edit the vocabulary in 15a — vocab changes require migration. (Custom vocab is 15b territory.)

### Voice UX placement and flow

- **D-14:** **Floating bottom-right pill** mic button. Position: `position: fixed; right: 1rem; bottom: 1rem;` with `env(safe-area-inset-bottom)` padding. Persistent across all walkthrough steps (mobile + desktop variants).
- **D-15:** Tap mic → opens a voice-input modal/sheet with: live waveform, transcribed text appearing as user speaks, Stop button. On Stop → spinner while voice query runs (answer call + verifier) → answer renders in the modal with cited section references. Modal stays open until user dismisses; multiple questions per modal session are allowed.
- **D-16:** ASR uses the existing Deepgram integration (`/api/voice/token` from Phase 12.5 VoiceNote block) — no second ASR endpoint. New endpoint `/api/voice/query` handles the SOP-grounded Q&A pipeline (receives the transcribed text + sopId, returns `{ answer, citations[], verifier_flags[] }`).
- **D-17:** Answer rendering: text + section/step citations inline. Citations are clickable — clicking a citation scrolls the underlying walkthrough to that section (modal stays open). No TTS playback in 15a (stretch goal).
- **D-18:** If verifier flags any ungrounded claim, the answer renders with a yellow "Verification flag" badge and the unverified phrase highlighted. User sees the flagged version, not the original — explicit safety bias toward "I'm not certain" over "wrong but confident."

### Sequential walkthrough enforcement

- **D-19:** **Explicit "I've done this — Next" button** gates every forward step advance. Single primary button at the bottom of each step card, large hit area (min-height 60px), distinct from secondary controls.
- **D-20:** Backward navigation (re-reading prior steps) is allowed via a smaller "Back" button. Forward-jump to step N+2 without acknowledging N+1 is blocked at the route layer: any deep-link to a step past the highest acknowledged step redirects to the highest acknowledged step.
- **D-21:** Acknowledgement state is tracked per session in `completionStore` (extends the existing Phase 12 / 12.5 Zustand walkthrough store). On completion sign-off (no auth in 15a), the full acknowledgement trace is included in the completion record (timestamps of each step click) as evidence of sequential reading.

### Claude's Discretion

The planner / executor decide on:
- Specific component naming (`DesktopWalkthrough`, `MobileWalkthrough`, `WalkthroughVoiceButton`, etc.)
- Endpoint shape details for `/api/voice/query` (validation schema, error envelope, rate-limit middleware)
- Per-question rate limit / concurrency policy (suggest: max 1 concurrent voice query per session; reject second call with 429 until first resolves)
- Voice modal accessibility (keyboard escape, focus trap, screen-reader announcements)
- Exact prompt-engineering for `claude-haiku-4-5` answer call + `VOICE_QA_VERIFY_SYSTEM` constant
- Migration file numbering for sub_trades + junction tables (next sequential: `00030_sub_trades.sql`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 15 inputs
- `.planning/phases/15-manufacturing-line-mode/15-SPEC.md` — **Locked requirements** — MUST read before planning
- `.planning/research/customer-interviews/2026-05-05-visy-findings.md` — Source customer research for Phase 15
- `.planning/research/customer-interviews/2026-05-05-visy-transcript.md` — Raw interview transcript (search this for specific quotes if questions arise about scope intent)
- `.planning/research/customer-interviews/README.md` — Index of customer interviews

### Prior phase context (load before planning)
- `.planning/phases/12.5-blueprint-redesign/12.5-CONTEXT.md` — Paper/ink design tokens, blueprint primitives (`blueprint-frame`, `pill`, `mono`, `evidence-btn`), voice infrastructure (Deepgram integration, `/api/voice/token`)
- `.planning/phases/12-builder-shell-blank-page-authoring/12-CONTEXT.md` — Puck builder architecture, walkthrough route shape, Zustand `walkthroughStore` pattern
- `.planning/phases/13-reusable-block-library/13-CONTEXT.md` — Block junction-table pattern (`sop_section_blocks`), org-vs-global RLS pattern (template for sub_trades RLS extension)
- `.planning/phases/14-ai-drafted-sops/14-CONTEXT.md` — Adversarial verifier pattern (D-02, D-04), `verify-sop.ts` mode-parameter extension pattern, `parse_jobs` FSM
- `.planning/STATE.md` — Current project state, carried UAT items, milestone position

### Code references (for implementation patterns)
- `src/lib/parsers/verify-sop.ts` — **Extend with `mode: 'voice_qa'` parameter** following the Phase 14 `mode: 'prompt'` pattern. Add sibling constant `VOICE_QA_VERIFY_SYSTEM` for the verifier system prompt
- `src/components/admin/ParseJobStatus.tsx` — STAGE_SETS map pattern (reference for adding a `voice_qa` stage set if voice queries get long-running async treatment in future)
- `src/app/(protected)/sops/[sopId]/page.tsx` — Existing walkthrough route — split into mobile/desktop variants via useViewport hook
- `src/app/(protected)/sops/CmdKProvider.tsx` — Existing cmdk surface scoped to `/sops/*` — voice button stays separate from cmdk in 15a (per D-14)
- `src/stores/walkthrough.ts` — Extend acknowledgement tracking (D-21)
- `src/lib/supabase/admin.ts` — Admin client for sub_trades seed migration
- `src/types/sop.ts` — Type definitions for SOP and sections (extend ParseJob-like patterns for voice query response shape)

### Design system
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — Auto-load via CLAUDE.md routing; blueprint design tokens, primitives, immersive walkthrough patterns, voice state machine
- `src/styles/blueprint-theme.css` — Paper/ink token definitions
- `CLAUDE.md` — Project conventions, technology stack, customer-interview routing pointer

### Anthropic SDK
- `@anthropic-ai/sdk` (already installed for Phase 14) — `claude-haiku-4-5-20251001` for both answer and verifier calls
- Existing prompt-caching pattern in Phase 14 `gpt-parser.ts` / `verify-sop.ts` should be reused for the full-SOP context payload (SOP content cached across questions in the same modal session)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 14 verifier** (`src/lib/parsers/verify-sop.ts`) — already supports `mode` parameter (`'transcript' | 'prompt'`). Adding `'voice_qa'` as a third mode is the established extension pattern. New system prompt constant `VOICE_QA_VERIFY_SYSTEM` follows the same shape as existing `PROMPT_VERIFY_SYSTEM`
- **Deepgram ASR pipeline** (`/api/voice/token` route + Phase 12.5 VoiceNote block) — same token-issuing endpoint serves the new voice-Q&A flow; no new ASR vendor or endpoint needed
- **Phase 12.5 Zustand walkthrough store** (`src/stores/walkthrough.ts`) — extend acknowledgement state for sequential gate (D-21)
- **Phase 12.5 paper/ink primitives** (`blueprint-frame`, `pill`, `mono`, `evidence-btn`, `--ink-*`, `--paper`) — desktop walkthrough variant uses these directly; no new design tokens needed
- **Phase 13 block-junction pattern** (`sop_section_blocks` table) — template for `sops_sub_trades` and `users_sub_trades` junctions
- **Phase 14 Anthropic SDK + prompt caching** (`@anthropic-ai/sdk`, `OPENAI_API_KEY` available) — reuse for answer + verifier calls; cache the SOP content payload across questions in the same modal session
- **`/admin/sops/[sopId]/assign` route** — existing assignment UI; gains a sub-trade multi-select alongside the role picker (D-12)
- **`completionStore` + completion sign-off route** — extend completion records with `step_acknowledgement_trace: { step_id, timestamp }[]` field for sequential evidence

### Established Patterns

- **Server actions for mutations** (`src/actions/`) — sub_trades assignment server action follows existing `assignSopToRoles` pattern. New action: `assignSopToSubTrades(sopId, subTradeIds[])`
- **Zod validation schemas** (`src/lib/validators/`) — `voiceQuerySchema` (question text, sopId, max 500 chars) follows the `aiPromptSchema` (Phase 14) shape
- **Worktree-isolated parallel executors** — Phase 15a is ~5 plan groups; consider parallel waves: (1) schema + types, (2) desktop walkthrough layout, (3) voice endpoint + verifier, (4) sub-trade UI, (5) integration + bundle-isolation CI
- **Code-split worker bundles** — Phase 12.5 set the pattern: dynamic-import any admin-only or rarely-used components. Apply the same to `DesktopWalkthrough` and `WalkthroughVoiceModal` (only loads when mic is opened)
- **`PaperThemeMount` is dead** (removed in Phase 14.5 cleanup) — body always ships `data-theme="paper"` at SSR; no per-route theme mount needed for desktop walkthrough

### Integration Points

- **Walkthrough route `src/app/(protected)/sops/[sopId]/page.tsx`** — splits into mobile/desktop variants via `useViewport` hook + dynamic import. Both variants render inside the existing CmdK provider; voice mic button lives at the layout level, not inside variants
- **New API route `src/app/api/voice/query/route.ts`** — POST handler. Receives `{ sopId, question }`. Fetches full SOP + sections + sop_section_blocks. Calls Anthropic Claude Haiku answer call → verifier call. Returns `{ answer, citations[], verifier_flags[] }`
- **Migration `supabase/migrations/00030_sub_trades.sql`** — creates `sub_trades` table, seeds initial vocab, creates `users_sub_trades` + `sops_sub_trades` junctions, extends RLS on `sops` to gate on sub-trade assignment
- **Database types extension** (`src/types/database.types.ts`) — manual extension for sub_trades + junctions following Phase 14 learning (no auto-regen)
- **Admin team UI** (`src/app/(protected)/admin/team/page.tsx`) — adds sub-trade picker per worker row
- **Admin SOP assign UI** (`src/app/(protected)/admin/sops/[sopId]/assign/page.tsx`) — adds sub-trade multi-select

</code_context>

<specifics>
## Specific Ideas

- **Demo wedge target SOP**: `ENF4-03-031 Blank Side Hanger` (partner mentioned at interview timestamp [00:08:11]). Treat this as the seed SOP for the Bryce demo — voice Q&A is tested against it specifically before phase verification. Recommend importing this real Visy SOP into a dev/staging instance for the verification + demo.
- **Question to ground 15a verification on**: "What PPE do I need for this procedure?" — partner mentioned heat-resistant gloves as a hazard. Voice answer should cite the Hazards section.
- **Adversarial test question**: "Can I use leather gloves instead?" — SOP doesn't say. Verifier should catch any hallucinated "yes/no" and return "I'm not certain — please check with your supervisor."
- **Visy hardware constraint** (locked in SPEC): Windows OS, browser zoom 90-100%, seated at HD monitor, mouse+keyboard. NO touch. The PWA shares the desktop with other software — voice button must not interfere with Alt-Tab / browser controls.
- **Phase 14.5 residual** (role-aware home + global Cmd+K) is bundled into Phase 15a's plan groups but is NOT a top-level Phase 15 SPEC requirement. The planner can defer the residual to Phase 15b if it threatens the demo-wedge ship date.

</specifics>

<deferred>
## Deferred Ideas

These came up during the Visy interview or Phase 15 discussion but are explicitly NOT in Phase 15a:

### Phase 15b candidates
- Auth / PIN / NFC badge attribution on completion (decided after POC sign-off)
- SOP governance & lifecycle (review-due cadence, stale-grey-out)
- Multi-step approval chain with Discipline Leader role
- Training-record export + Success Factors HRIS integration
- Bulk SOP import tool
- Voice grounding across block library + global blocks (expand retrieval scope)
- TTS playback of voice-Q&A answers
- Site tier in multi-tenancy (CANCELLED entirely, not just deferred — revisit only if demand proves real)

### Phase 16+ or backlog
- pgvector embeddings for retrieval — only when SOPs exceed ~200 pages OR users explicitly demand cross-SOP knowledge
- Voice Q&A across the org's full block library (15b extension)
- Custom sub-trade vocabulary (admin-editable) — backlog
- "Last 7 days completion records" supervisor view tied to voice activity — backlog

### Reviewed Todos (not folded)
None — no pre-existing todos surfaced as relevant to Phase 15a scope.

</deferred>

---

*Phase: 15-manufacturing-line-mode*
*Context gathered: 2026-05-12*
*Source research: `.planning/research/customer-interviews/2026-05-05-visy-findings.md`*
*Next step: `/gsd-plan-phase 15` — research and plan the implementation*
