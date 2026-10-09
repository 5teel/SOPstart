# Handoff — 2026-10-09 (end of the Phase 63 + typography session)

Pick up here in a fresh context. Read CLAUDE.md, docs/adr/README.md (ADR-0004, 0005, 0006 are new and binding), and this file. Master is at `12db1d8b` or later; Railway deploys from master.

## Where things stand

### Shipped and live on sopstart.com
- **Phase 63 — SOP-first home, library site map and the SOPstart start** (21 plans, `.planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/`). Deployed eval 98/98 (`63-EVAL.md`), verification `63-VERIFICATION.md` (gaps 1, 2, 4 closed in `250bdbfd`; gap 3 = tool search is exact-name only, accepted limit). ADR-0005 (library map replaces rooms) supersedes ADR-0003.
- **Typography — ADR-0006 "Typography: Inter for reading, Saira for labels"** (`7fd3ebe8`, `22725e54`, `28db4997`, `f86d4871`, `12db1d8b`):
  - Inter is now actually loaded via `next/font` (before, CSS named it but nothing loaded it — every device showed its system font). Learning logged in CLAUDE.md.
  - Saira Semi Condensed replaces JetBrains Mono for every label, tag and data line; JetBrains Mono removed. Tokens `--font-label` (Saira), `--font-reading` (Inter); `font-mono` → `font-label` at call sites; the `.mono` class name was kept (~160 call sites) but now renders Saira (500; `.mono.uppercase` 700 + 0.06em).
  - Size floor: `--text-micro` 10 → 12 px, `--text-meta` 11 → 13 px. Data lines in `.mono`/`font-label` at `text-ink-600`.
  - Guard: `tests/lint/typography.spec.ts` (phase15-stubs), mutation-proven.
  - Rule from the verdict: Saira only for short strings (labels, tags, counts, data lines), never step instructions or long text; caps only for labels/tags.

### Not yet verified live (do first, cheaply)
1. `28db4997` (darker data lines) has no deployed eval run. Run once (wait for `/api/version` = HEAD):
   `npx playwright test --project=evals --workers=1 --retries=0 tests/evals/home.eval.ts tests/evals/sop-focus.eval.ts tests/evals/office.eval.ts` with `EVAL_BASE_URL=https://sopstart.com` — sop-focus was not re-run after its `font-mono` → `font-label` selector fix.
2. Read live screenshots of **Sign-offs, My record, Manage SOPs** (desktop 1440 + phone 390) — the bigger 12/13 px labels have not been looked at there. Check row-height ceilings (`getBoundingClientRect` limits in evals) and fixed-width segmented controls for clipping (CLAUDE.md 2026-10-06 (7)).

## Open decisions for Simon (ask, don't assume)
1. **Signage colour system (sketch 011)** — https://claude.ai/artifact/CXFn17ssSFfb3t9xAZwkhR. Proposal: four AS/NZS 1319 / ISO 7010 safety colours each with a shape (danger ▲ red #B91C1C, mandatory ● blue #1D4ED8 = **PPE moves from amber to blue**, caution ◆ amber #B45309, safe ■ green #15803D), ordinary steps in ink, brand tape yellow only in the wordmark (never a flat fill), muted area colours for the map (no pure red/blue/amber/green), radius vocabulary squared (2 px chips, 4 px controls/cards, 12 px sheets), type scale 15 × 1.25 (12 · 15 · 19 · 23 · 29 · 37 · 46). Not approved yet. If approved: a new ADR (accent set refines ADR-0004 rule 8 — check whether it supersedes), token renames in `src/styles/blueprint-theme.css`, a sweep phase with a deployed eval; drop the dead `--accent-voice`, merge `--accent-measure` into step.
2. **Department colours** — the home and map colour areas by `--area-N` (name order), so the colour swatch set on a department in Manage › Site & departments shows nowhere. Retire the swatch, or feed `departments.colour` into the map?
3. **Self-host full Inter** to get the safety glyphs (`cv05` tailed l, `cv08` serifed I, `zero` slashed zero) — Google's Inter strips them; only `tnum` is on. Small job; needs its own ADR (external font service vs self-hosted asset). Check the bundle gate (fonts are CSS, not counted, but verify).
4. **Tool search** matches an exact tool name only (array containment in `src/hooks/useSopSearch.ts`); make it partial/case-insensitive?

## Small follow-ups (no decision needed)
- **Invite-email leg** of `tests/evals/office.eval.ts` is unproven twice (mailer "email rate limit exceeded"). Run that one case once in a quiet hour, no other invite runs in the prior hour.
- **Saira has no tabular digits.** A `figures` utility (Inter, tabular) exists for number columns; apply it wherever numbers must align in a column (training matrix counts, any table of times) — nothing uses it yet.
- **Training default** now opens on the department with the most people — untested against an org with real department members.
- `tests/phase26/konva-worker-isolation.spec.ts` has a permanently self-skipping case — delete it.
- Deferred items list: `.planning/phases/63-*/deferred-items.md`.

## Process notes for the next session
- GSD: Phase 63 is executed + verified (gaps closed). Run `/gsd-progress` to see the roadmap position; Phases 61/62 were moved out of GSD into a Claude Doc and their room-shaped items are superseded by Phase 63.
- Executors ran sequentially on the main tree; keep doing so for anything that pushes and runs a deployed eval.
- Bundle baselines: `/page` 831, `/sops/[sopId]/page` 802 (tolerance 2); moves are orchestrator decisions recorded in `.bundle-baseline.json` history and the ROADMAP Phase 63 "Bundle decisions" line — never re-captured.
- Design artifacts this session: wordmark showcase https://claude.ai/artifact/Peh4t3Z2yNYVip4R6eLqU9 · wordmark comparison https://claude.ai/artifact/WxeZykiefpJr4XDyPgfbrz · type (Inter + Saira) https://claude.ai/artifact/7jaBTLUH8SF5eouHqjsaT4 · signage sketch 011 https://claude.ai/artifact/CXFn17ssSFfb3t9xAZwkhR
