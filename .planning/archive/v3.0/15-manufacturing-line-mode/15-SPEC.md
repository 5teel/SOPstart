# Phase 15: Manufacturing-Line Mode — Specification

**Created:** 2026-05-12
**Ambiguity score:** 0.19
**Requirements:** 6 locked

## Goal

A SafeStart PWA tab opened on a shared shop-floor Windows desktop renders a **desktop-optimised SOP walkthrough** (big-text, far-readable for a seated operator at a 22"+ HD monitor) with **voice Q&A grounded to the current SOP** and **sub-trade role tagging** on workers — delivered as Phase 15a (the demo wedge to take to Bryce at Visy). Phase 15b — governance, lifecycle, training-record export, auth/PIN attribution, Discipline Leader role and approval workflow — is scoped separately after the POC sign-off.

## Background

Visy Packaging (Pratt family, ~100 AU/NZ industrial sites — glass, cans, cardboard) is the named near-term buyer. Customer interview 2026-05-05 (`.planning/research/customer-interviews/2026-05-05-visy-findings.md`) surfaced the real-world consumption pattern: operators read SOPs at **shared Windows desktops next to the line** — NOT phones — between line tasks, with the SafeStart PWA running in a regular browser tab alongside other corporate software (not a dedicated kiosk app).

Today's state:
- Worker walkthrough `/sops/[sopId]` exists with a 6-tab interface (Phase 12.5), immersive step cards optimised for ≤430px mobile, list-mode for desktop. The desktop list-mode exists but is NOT optimised for the 22"+ seated-reading distance — it uses standard 14-16px body text and assumes a phone-style scroll
- Voice infrastructure: Deepgram ASR is integrated for VoiceNote block authoring (Phase 12.5). No RAG / voice-Q&A over an SOP exists. No `/api/voice/query` endpoint
- Worker role is a single flat enum: `worker | supervisor | admin | safety_manager`. No sub-trade tags. SOP-to-role assignment uses the flat role only
- SOP authoring covers ~10 sample SOPs Simon has on hand for incremental upload via existing Phase 2/14 flows; no bulk-import tool needed
- The recently-deleted PaperThemeMount + SiteThemeProvider stack means body always ships `data-theme="paper"` at SSR — desktop-walkthrough layout work happens on a clean theme baseline

## Requirements

1. **Desktop walkthrough layout**: SOP walkthrough adapts to desktop viewports with big-text, far-readable rendering optimised for a seated operator at a 22"+ HD monitor.
   - Current: `/sops/[sopId]` desktop layout uses standard 14-16px body text, phone-style scroll; immersive step card is mobile-only (≤430px CSS media query)
   - Target: When viewport width ≥ 1024px AND no `?embed=` query param, the walkthrough tab renders a desktop-optimised step view: minimum 24px body text, 18px secondary text, single step per viewport (no list), warnings/hazards visually amplified, "Next" button minimum 60px tall with explicit "I've done this — Next" copy
   - Acceptance: Loading any published SOP in a 1920×1080 Chromium viewport renders the desktop walkthrough variant with computed `font-size` ≥ 24px on step body text; loading the same SOP in a 390×844 viewport renders the existing immersive mobile card unchanged

2. **Sequential walkthrough enforcement**: Workers cannot skip ahead in the walkthrough on either layout.
   - Current: Mobile immersive walkthrough has prev/next controls; desktop list mode allows clicking any step out of order
   - Target: Both layouts gate the "Next" advance on the current step being explicitly acknowledged ("I've done this — Next" click). Backward navigation is allowed (review prior steps), but forward-jump is blocked. No skip option in either layout
   - Acceptance: With a 5-step SOP, the "Next" button advances from step 1→2→3→4→5 only via sequential acknowledgement; attempting to navigate directly to step 4 without acknowledging 2 and 3 routes back to the highest acknowledged step

3. **Voice Q&A over current SOP**: An operator can press a microphone button on the walkthrough surface, speak a question, and receive a text + spoken answer grounded in the SOP they are currently reading.
   - Current: No `/api/voice/query` endpoint; no SOP-RAG infrastructure. Deepgram ASR is integrated only for VoiceNote block authoring
   - Target: A microphone button on the walkthrough page (visible in both desktop and mobile layouts) opens a voice-input UI; on transcription completion, the question is sent to a RAG layer that pulls relevant chunks from THIS SOP's structured content (sections, blocks including hazards/PPE/steps) and synthesises an answer via Anthropic Claude with explicit citations (section + step references). The answer renders as text in-page; spoken playback is a stretch goal for 15a
   - Acceptance: Recording the question "what PPE do I need" on a SOP whose Hazards section lists heat-resistant gloves returns an answer mentioning heat-resistant gloves with a citation to the Hazards section; recording the same question on a SOP with no PPE content returns a "no PPE specified for this procedure" answer (no hallucinated PPE)

4. **Voice grounding scope is restricted to current SOP**: The RAG retrieval must not pull content from other SOPs, the block library, or global blocks.
   - Current: N/A — no RAG exists
   - Target: The RAG index for a voice query is scoped to the single SOP being viewed. Retrieval source = sections + sop_section_blocks for that SOP only. No cross-SOP, no block-library-wide retrieval
   - Acceptance: Recording a question that has a clear answer in a DIFFERENT SOP's content returns "I can't find that in this procedure" (not the other SOP's answer); confirmed by a test where the voice-query endpoint is given a question whose answer exists only in a different SOP and the answer indicates not-found

5. **Sub-trade tags on workers**: A worker user can have one or more sub-trade tags (Operator, Fitter, Sparky/Electrician, etc.) in addition to their flat role.
   - Current: `users.role` is a single flat enum: `worker | supervisor | admin | safety_manager`. No sub-trade concept exists in the schema or UI
   - Target: A new `users.sub_trade_tags` text[] column (nullable, default `{}`) plus a controlled vocabulary table (or enum) covering Operator, Fitter, Sparky, Maintainer, plus an "other" free-text option. Admin team management UI gains a multi-select tag picker for each worker. SOPs gain an optional `sub_trade_tag` assignment field so admins can filter "this SOP is for fitters only"
   - Acceptance: An admin can assign tags `["fitter", "sparky"]` to a worker via the team management UI and the assignment persists; an admin can assign a SOP to sub-trade `fitter`; workers with `fitter` tag see that SOP in their library and workers without `fitter` tag do not

6. **Desktop walkthrough does not bloat mobile bundle**: The desktop-specific walkthrough variant must not increase First Load JS for the existing mobile worker route.
   - Current: Mobile worker walkthrough First Load JS baseline measured at last Phase 12.5 build (exact KB number to be captured at Phase 15 spec time; the spec locks "no growth" not a specific number)
   - Target: After Phase 15a ships, `next build` reports First Load JS for `/sops/[sopId]` is ≤ the baseline within a 2 KB tolerance. Desktop-specific code (big-text layout, voice-query client) must be code-split (dynamic import gated on viewport detection or media query) so mobile users do not download it
   - Acceptance: CI script (or manual `next build` comparison) shows `/sops/[sopId]` First Load JS within 2 KB of the pre-Phase-15 baseline; voice-query client chunk appears as a separate dynamically-loaded asset in the build manifest

## Boundaries

**In scope (Phase 15a — the demo wedge):**
- Desktop walkthrough layout (viewport-aware)
- Sequential walkthrough enforcement on both layouts
- Voice Q&A endpoint + UI on the walkthrough page (grounded to current SOP only)
- Sub-trade tags on workers + SOP-to-sub-trade assignment + admin UI
- Bundle-isolation verification for the mobile worker route

**Out of scope (Phase 15a — explicitly NOT in the demo wedge):**
- **Auth/PIN/badge attribution on completion** — POC ships with timestamp-only completion records, no per-operator attribution. Auth decisions resolved after Bryce signs off the POC (Phase 15b)
- **Site tier in multi-tenancy** — cancelled entirely from Phase 15. Visy pilots single-org; site overlays revisited later only if real demand surfaces
- **SOP governance & lifecycle** — review-due cadence, stale-SOP grey-out, multi-step approval chain → Phase 15b
- **Discipline Leader role** — dropped from 15a; only sub-trade tags ship. Discipline Leader returns in 15b as part of approval workflow
- **Training-record / competency export** — Phase 15b
- **Success Factors HRIS integration** — Phase 15b (deferred until Visy provides API access during POC)
- **Bulk SOP import tool** — not in Phase 15 at all. Visy uploads incrementally via existing Phase 2/14 flows
- **Spoken/TTS playback of voice-Q&A answers** — stretch goal only; text answer is the core deliverable for 15a
- **Voice grounding across block library + global blocks** — restricted to current SOP only in 15a (deliberate scope restriction to keep RAG simple and grounded)
- **Dedicated kiosk application or locked browser shell** — explicitly rejected; Phase 15 ships as a layout adaptation to the existing PWA running in a regular Windows desktop browser tab alongside other software
- **Touchscreen support** — terminals are mouse + keyboard only per the Visy hardware constraint
- **Role-aware home + global Cmd+K (residual from Phase 14.5)** — bundled into Phase 15a's plan group covering the same surfaces, but not a top-level requirement here; spec'd at discuss time

## Constraints

- **Terminal hardware target**: Windows OS, standard HD resolution (1920×1080 or 1366×768), browser zoom 90–100%, seated operator, mouse + keyboard only, reliable Ethernet. PWA installed in regular browser; NOT a dedicated kiosk app
- **PWA runs alongside other corporate software** — the SafeStart tab does not own the screen; layout must work as a regular browser tab, not a fullscreen kiosk takeover
- **Voice transcription**: must use the existing Deepgram integration (`/api/voice/token` already exists for Phase 12.5 VoiceNote block); no second ASR vendor
- **Voice answer synthesis**: must use the existing Anthropic Claude integration from Phase 14 (`@anthropic-ai/sdk`); no second LLM vendor for this phase
- **No new database extension dependencies** — RAG retrieval uses Postgres full-text search or pg_trgm at most; pgvector / external vector DB are out of scope for 15a (revisit in 15b if relevance is poor)
- **Mobile worker walkthrough behaviour must remain byte-identical** for the existing immersive step card — Phase 12.5 UAT already passed for this surface; any regression in mobile behaviour blocks the phase
- **Sub-trade tags vocabulary** — controlled list (Operator, Fitter, Sparky/Electrician, Maintainer) plus "other" free-text option. No unbounded free-form taxonomy
- **Bundle isolation** — desktop-walkthrough code and voice-query client must be code-split so mobile First Load JS does not grow more than 2 KB

## Acceptance Criteria

- [ ] Loading any published SOP in a 1920×1080 viewport renders the desktop walkthrough variant with computed `font-size` ≥ 24px on step body text
- [ ] Loading the same SOP in a 390×844 viewport renders the existing immersive mobile card unchanged (no visual regression from Phase 12.5)
- [ ] On both layouts, attempting to jump forward to step N+2 without acknowledging step N+1 routes back to the highest acknowledged step
- [ ] The microphone button on the walkthrough page opens a voice-input UI; transcription appears within 3 seconds of user finishing speaking on the test SOP
- [ ] Recording "what PPE do I need" on a SOP whose Hazards section mentions heat-resistant gloves returns an answer containing "heat-resistant gloves" with a citation to the Hazards section
- [ ] Recording a question with an answer in a DIFFERENT SOP returns "I can't find that in this procedure" (or equivalent not-found phrasing), confirming voice grounding is restricted to current SOP
- [ ] An admin can assign sub-trade tags `["fitter", "sparky"]` to a worker via team management UI; the assignment persists and is visible in the worker's profile
- [ ] An admin can assign a SOP to sub-trade `fitter`; workers with the `fitter` tag see that SOP in their library, workers without the `fitter` tag do not
- [ ] `next build` reports First Load JS for `/sops/[sopId]` within 2 KB of the pre-Phase-15 baseline; voice-query client chunk appears as a separate dynamically-loaded asset
- [ ] One real Visy SOP (`ENF4-03-031 Blank Side Hanger` from the partner interview) is loaded into a SafeStart instance, rendered on desktop walkthrough, voice-asked a question, answered with citation — demonstrably ready for a Bryce demo

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                              |
|--------------------|-------|------|--------|--------------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Single concrete deliverable for 15a, with 15b scoped separately    |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit in/out-of-scope lists; 15a vs 15b split is sharp          |
| Constraint Clarity | 0.75  | 0.65 | ✓      | Hardware, ASR vendor, LLM vendor, bundle-isolation all locked      |
| Acceptance Criteria| 0.75  | 0.70 | ✓      | 10 pass/fail criteria, including the Visy-demo readiness check     |
| **Ambiguity**      | **0.19** | ≤0.20| ✓   | Gate passed at end of Round 2 (Researcher + Simplifier)            |

## Interview Log

| Round | Perspective              | Question summary                                         | Decision locked                                                       |
|-------|--------------------------|----------------------------------------------------------|-----------------------------------------------------------------------|
| 1     | Researcher               | Terminal hardware specification?                          | Windows, HD res, mouse+keyboard, seated, Ethernet, PWA NOT a kiosk    |
| 1     | Researcher               | Existing SOP migration approach?                         | Incremental upload via existing flows; ~10 sample SOPs to start       |
| 1     | Researcher (Simplifier)  | Phase ship sequence?                                      | Demo wedge (15a) first → full phase (15b) after POC sign-off          |
| 2     | Simplifier               | What's the irreducible 15a wedge?                        | Reading + extended roles (sub-trade tags). Drop Discipline Leader     |
| 2     | Boundary Keeper          | Is site tier necessary at all?                           | Cancelled entirely from Phase 15 — Visy pilots single-org             |
| 2     | Boundary Keeper          | PIN vs badge for completion sign-off?                    | No auth at all in 15a — attribution decided after POC sign-off        |
| 2     | Seed Closer              | Voice grounding scope?                                   | This SOP only — cross-SOP/library retrieval out of 15a                |
| 2     | Seed Closer              | Discipline Leader semantics in 15a?                      | Dropped — only sub-trade tags ship in 15a                             |

---

*Phase: 15-manufacturing-line-mode*
*Spec created: 2026-05-12*
*Source research: `.planning/research/customer-interviews/2026-05-05-visy-findings.md`*
*Next step: `/gsd-discuss-phase 15` — implementation decisions (layout breakpoint mechanism, voice RAG retrieval pattern, sub-trade tag schema details)*
