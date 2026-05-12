# Phase 15a — Bryce-at-Visy Demo Prep

**Phase:** 15-manufacturing-line-mode
**Target audience:** Bryce, Visy Packaging (manufacturing-line operator)
**Demo wedge SOP:** `ENF4-03-031 Blank Side Hanger`
**Duration target:** 5 minutes
**Hardware target:** Windows 11, Chrome at 1920×1080 (matches Visy shop-floor terminal)

This doc is the canonical script for taking Phase 15a in front of Bryce. It maps the SPEC.md acceptance criterion #10 (Visy demo readiness) into a step-by-step UAT run-through.

---

## 1. Prerequisites

- [ ] **Staging environment up:** `https://staging.sopstart.com` (or local production build per §3 below)
- [ ] **Admin login** for the Visy demo org — credentials in `1Password → SOPstart staging admin`
- [ ] **ENF4-03-031 SOP seeded** as `published` with three sections:
  - Overview
  - Hazards & PPE (mentions **heat-resistant gloves**)
  - Steps (≥ 3 sequential steps)
- [ ] **Test worker account** with NO sub-trade tags (so the SOP is visible by default)
- [ ] `ANTHROPIC_API_KEY` set in staging env (voice Q&A answer + verifier calls)
- [ ] `DEEPGRAM_API_KEY` set in staging env OR browser mic permission granted (ASR)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured (CLAUDE.md learning 2026-05-08 — **NOT** the `_ANON_KEY` form)

---

## 2. Seed the Visy SOP (one-time, idempotent)

The fixture lives at `tests/fixtures/visy-enf4-03-031.sql`. It's idempotent — re-running deletes the prior fixture rows before inserting.

**IMPORTANT:** Edit `\set org_id` at the top of the SQL to point at the actual Visy demo org id BEFORE running it.

### PowerShell, on Simon's laptop, in `C:\Development\SOPstart`:

```powershell
psql $env:DATABASE_URL -f tests\fixtures\visy-enf4-03-031.sql
```

If your local `psql` isn't on `PATH`, alternatively use the Supabase SQL editor: paste the file contents into the project's SQL editor at `https://supabase.com/dashboard/project/<project-ref>/sql` and Run.

After seeding, verify:

```powershell
psql $env:DATABASE_URL -c "select id, title, status from sops where id = 'aaaaaaaa-0000-4000-8000-000000000001';"
```

Expect one row: `ENF4-03-031 Blank Side Hanger | published`.

---

## 3. Build + start (local production, if not using staging)

Per CLAUDE.md learning 2026-05-08, **always use `next start` not `next dev`** on Windows — the dev server has a file-lock race on `.next/server/app-paths-manifest.json` that breaks rapid navigation during UAT.

### PowerShell, in `C:\Development\SOPstart`:

```powershell
npm run build; if ($?) { npm run start }
```

Wait for `Ready in <Xms>` then open Chrome at `http://localhost:4200`.

---

## 4. Demo flow — 5 minutes total

### Beat 1 — Desktop walkthrough (90 s)

1. Open Chrome at **1920×1080** (Visy terminal size). DevTools off — show the real surface.
2. Sign in as worker; navigate to `/sops`.
3. Click `ENF4-03-031 Blank Side Hanger` → Walkthrough tab.
4. **Expected:** big-text desktop variant renders — body ≥ 24px, "I've done this — Next" button ≥ 60px tall, single step per viewport.
5. Click **I've done this — Next** through steps 1 and 2 to demonstrate the sequential ack gate.
6. **Talking point:** "Bryce, this is the seated-reading layout — no squinting from across the line."

### Beat 2 — Voice Q&A happy path (90 s)

1. Tap the **mic pill** at bottom-right.
2. Voice modal opens; tap **Speak**.
3. Say: **"what PPE do I need"**.
4. **Expected outcome:**
   - Answer text references **heat-resistant gloves** (plus safety glasses + hi-vis vest from the Hazards section).
   - A **citation chip** labelled `[section: "Hazards & PPE"]` is rendered inline in the answer.
   - Clicking the chip scrolls the underlying walkthrough to the Hazards section (modal stays open).
   - `aria-live` region announces the answer for screen readers.
5. **Talking point:** "It's grounded to THIS SOP — not a generic AI answer. The chip proves it found the answer in your document."

### Beat 3 — Voice Q&A adversarial (90 s)

1. With the modal still open, tap **Speak** again.
2. Say: **"can I use leather gloves instead?"** (deliberately probes the model — the SOP doesn't authorise the substitution).
3. **Expected outcome:**
   - Answer is grounded uncertainty: *"I'm not certain"* / *"the SOP doesn't say"* / *"please check with your supervisor"* — NOT a confident yes/no.
   - If the verifier flagged a claim, a **yellow Verification flag** badge renders with the unverified phrase highlighted.
4. **Talking point:** "Safety bias toward 'I don't know' beats safety risk of 'wrong but confident'. This is the adversarial verifier earning its keep."

### Beat 4 (optional, only if there's time) — Sub-trade gate (60 s)

1. New tab: open `/admin/sops/<ENF4-03-031-id>/assign` as admin.
2. In the **Assign by sub-trade** section, click the **Fitter** pill.
3. Switch to the worker tab (worker WITHOUT `fitter` tag) → refresh `/sops` → SOP no longer visible.
4. In a second worker session WITH `fitter` tag → `/sops` → SOP visible.
5. **Talking point:** "One SOP can target Fitters only, or Sparkies + Maintainers, or be visible to everyone — your call per SOP."

---

## 5. Expected outcomes / pass criteria

Lift directly from SPEC.md acceptance criteria #10:

| Check | Pass condition |
| --- | --- |
| Desktop body text computed font-size | ≥ 24 px on `[data-testid="step-body"]` |
| Mic pill placement | `position: fixed; right: 1rem; bottom: 1rem;` |
| Voice answer cites Hazards section | citation chip with section title rendered |
| Adversarial returns grounded-uncertainty | No confident "yes" or "no" about leather gloves |
| Sub-trade gate enforced | Worker without `fitter` tag does NOT see the SOP |
| Bundle isolation | `npm run build` postbuild gate exits 0 |

---

## 6. Known-issue fallbacks (if the live demo wobbles)

- **Mic permission denied** → use the manual text-input fallback in the modal (already wired in Wave 2). Pre-type both questions.
- **Anthropic rate-limit (429)** → use a recent dry-run screenshot. Anthropic free-tier limits are aggressive; warm the cache with a single ENF4-03-031 question 5 minutes before the demo to seed `cache_creation_input_tokens`.
- **Cold-start delay on `next start`** → hit `/sops/<sop-id>` once to warm before Bryce is watching.
- **Voice modal can't access mic** → fall back to text input. Capture the workflow on video later for inclusion in the asynchronous follow-up.
- **DB push not applied** (Wave 1 migration 00030) → the sub-trade gate Beat 4 won't work; skip Beat 4 and just show Beats 1-3. Sub-trade gate is provable later via screenshots.

---

## 7. Post-demo capture

- [ ] Screenshot each of the 3-4 beats
- [ ] Note Bryce's reactions to each beat — particularly Beat 3 (the grounded-uncertainty response is the new behaviour vs. ChatGPT)
- [ ] Capture any Phase 15b asks (governance, training-record export, badge auth) for the backlog
- [ ] Update `15-VERIFICATION.md` with the screenshots + transcript

---

## 8. References

- **SPEC:** `.planning/phases/15-manufacturing-line-mode/15-SPEC.md` Acceptance Criterion #10
- **Validation map:** `.planning/phases/15-manufacturing-line-mode/15-VALIDATION.md` § Manual-Only Verifications
- **Fixture:** `tests/fixtures/visy-enf4-03-031.sql`
- **Source customer interview:** `.planning/research/customer-interviews/2026-05-05-visy-findings.md`
- **Voice Q&A endpoint:** `src/app/api/voice/query/route.ts`
- **Voice modal:** `src/components/sop/voice/WalkthroughVoiceModal.tsx`
- **Desktop walkthrough:** `src/components/sop/walkthrough/DesktopWalkthrough.tsx`

---

*Authored 2026-05-13 (Phase 15 Wave 4). Update after the live Bryce demo with actual outcomes.*
