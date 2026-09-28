# Phase 54: Admin — Inbox, Floor Health, Library Table - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning
**Source:** Orchestrator-compiled from sketch 007 (Admin inbox tab + admin repaint of the Plant tab), the design contract `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md`, Phase 51/52 summaries, and Simon's 2026-09-28 decisions. No discuss-phase question round.

<domain>
## Phase Boundary

The admin's home is the work, not the list. `/governance` becomes a real route: an inbox of one-action rows with the same plant scene beside it repainted by library health. Admin `/sops` becomes the library as a plain table with a checks row. Everything the Phase 41 scope column and lenses did is either here or deleted — `AdminSopSurface.tsx`, its three lens files, `MillerPrimitives.tsx` and `SopWorkerBrowser.tsx` are removed, not hidden.

**In scope:** `/governance` route + inbox + floor health repaint + admin machine panel; admin `/sops` table with checks row and chips; deletion of the Miller/scope-column code and its specs; header links; `journeys.ts`; capability matrix; the rewritten `tests/evals/sop-surface.eval.ts`; deployed eval.

**Out of scope:** the worker desktop/phone homes (52/53), new governance rules (the inbox reads the existing governance queue, review cadence, approval chains and parse status), Access wiring (stays at its current route/lens — the contract says it belongs with Team; moving it is a follow-up, not this phase), v8.0 Phase 43 route-truth sweep (runs after this).
</domain>

<decisions>
## Implementation Decisions

### `/governance` (ADM-01)
- D-01: Route `src/app/(protected)/governance/page.tsx`, admin/safety_manager gated via `requireAdminContext()`; header "Governance" points here (no more `?view=attention`). The old `/sops?view=attention` deep link redirects to `/governance` (one line in the resolver, then deleted with the lens).
- D-02: Inbox rows are derived from EXISTING data, no new tables: `listGovernanceQueue` (Phase 28/29 flags: no owner, review overdue, awaiting approval), `parse_jobs` failed/stuck (existing "Still working" scope), and "machines with no procedures" (Phase 51 `site_machines` left-joined to `sop_machines`). Each row: severity dot (red no-owner/stuck · amber overdue · blue approve-me · grey housekeeping), title, machine · state · reason, age, and ONE action button: Assign owner (opens the existing owner picker), Review (→ builder), Approve (existing `approveStep`), Retry (→ the builder, whose parse-state panel owns retry — no inline extraction; research Q1), Finish (→ builder), Add (→ `/admin/sops/new` with the machine preselected if the creation flow supports it, else plain). Counted filter chips: All · No owner · Overdue · Approve · Stuck · Machines. Empty inbox = "All clear" state (this is the goal state, so it gets real weight, not an apology).
- D-03: The GovernanceQueueRow component and `approveStep` gating are preserved (APR-03/04 hard constraint from Phase 29/41): reuse `GovernanceQueueRow` or its logic for rows that come from the governance queue; do not re-implement approver gating.

### Floor health (ADM-02)
- D-04: Beside the inbox (right column, ~420 px on desktop; stacked below on phone) the org's scene renders through 52's `PlantStage` in a new **admin repaint** mode: pin = worst of `no owner` (red `!`) › `review overdue` (amber `↻`) › ok (small green dot) across the machine's SOPs; red/amber machines get the dashed tint; the health derivation is a pure function next to `derivePlantPins` in `src/lib/sop/worker-signal.ts` (or a sibling `src/lib/sop/admin-health.ts` — one module, unit-tested). Data comes from a new admin-gated action in `src/actions/site.ts` (or a sibling) that returns machines + per-SOP `{owner_user_id, review_due_at, status}` for the org.
- D-05: Clicking a pin opens the **admin machine panel** (52's `MachinePanel` gains an `admin` variant or a sibling component): sprite, department, name, SOP rows with `NO OWNER` / `REVIEW DUE` / `DRAFT` / `OK` badges, `owner · rev` line per SOP, `Open` (SOP page) and `Edit` (builder) per row, "Add one" when empty. No worker to-do badges here.
- D-06: Orgs with no site: the floor column shows a compact "Draw your site" card linking `/admin/site` — never blank.

### Admin `/sops` table (ADM-03)
- D-07: For admins (any width ≥1024; phone admins fall through to the worker phone home from 53), `/sops` renders a plain table: SOP · Machine (mono, from `sop_machines`) · Status (`LIVE` / `DRAFT` / `STUCK`) · Owner · **Checks** · Review. Checks = five 18 px circles, left→right: owner · reviewed within 12 months · approved (published, or no chain required) · assigned to someone (department or person grant) · converted cleanly (no failed parse); green ✓ / amber ! / red ×. Five greens = nothing to do. Row click → the SOP page; an `Edit` link → builder (one chain, as Phase 41 SUR-04 required).
- D-08: Chips above the table: Where (department, from the org's rows) · Status · Owner (me / none / person) · Checks (has a red / has an amber). Search = the existing toolbar input. Deep links `?departments=`, `?collection=`, `?status=`, `?owner=me` keep resolving onto the table (Phase 33/41 contracts). `?view=access` keeps opening the Access lens (out of scope to move).
- D-09: **Deletions**: `src/components/sop/AdminSopSurface.tsx`, `src/components/sop/lenses/AdminAttentionLens.tsx`, `AdminStatusLens.tsx` (the Access lens survives — see scope), `src/components/sop/MillerPrimitives.tsx`, `src/components/sop/SopWorkerBrowser.tsx` (its `topSignal` already moved to `worker-signal.ts` in 52; move any remaining shared helper out first), `src/components/admin/SopMillerBrowser.tsx` if nothing else imports it. A repo sweep spec fails on any import of, or href/query targeting, a deleted module or the `view=attention` parameter (a deletion guard asserts absence of REFERENCES, 2026-08-04). Every spec that pinned those files is repointed or deleted in the same commit (2026-07-13 stale-guard rule), including the phase28/30/33/41 source-contract specs that grep them — list them in the plan by grepping `tests/` for each filename first.
- D-10: Phase 53 executes BEFORE 54 on the main tree (sequential), so 53's phone home will exist — but the plan must not hard-depend on it: if `PhoneHome` is absent at plan time, workers `<1024` keep the extracted `WorkerSimpleList`. The worker phone list (`<1024`) is then 53's phone home; the worker desktop is 52's plant. After this phase, `sops/page.tsx` must contain no Miller frame at all. If an org has no site, workers get a simple list (the existing stacked list markup may be kept as `WorkerSimpleList`, extracted from `SopsSection`, or the 52 fallback path — whichever leaves the smallest page); admins always get the table.

### Nav, map, matrix, evals (ADM-04)
- D-11: `TopHeader.tsx`: Governance → `/governance`; SOPs stays `/sops`. `journeys.ts`: governance journey, admin `/sops` table journey; `/pathways` shows 0 not-mapped. `.planning/codebase/CAPABILITY-MATRIX.md`: inbox actions per role. `src/lib/uat/tests.ts` updated.
- D-12: `tests/evals/sop-surface.eval.ts` is REWRITTEN for the new surfaces (admin table with checks; deep links; worker desktop = plant or fallback; Governance inbox + floor + panel; access lens still reachable) and passes on the deployed site; `tests/evals/governance.eval.ts` covers the inbox in the eval-site org (seed: the fixture SOP with no owner → red pin on EVAL Press → Assign owner clears it; "EVAL Oven" with no procedures → Machines row). Screenshots read by the orchestrator.
- D-13a: **Marker self-validation (research, highest risk):** `scripts/check-bundle-size.ts` asserts every forbidden marker string exists SOMEWHERE in the build; deleting `SopMillerBrowser.tsx` / `AdminAttentionLens.tsx` removes their literals (`'Owner role gone'`, `'Pick another scope on the left.'`) and hard-fails `npm run build`. The deletion wave rewrites `GATED_ROUTES['/sops/page'].forbiddenMarkers` (and any other route's) to literals that exist in the surviving admin modules, in the SAME commit as the deletion, and proves it with `npm run build`.
- D-13b: `/governance` is not bundle-gated (no worker overlap); the governance eval resets the eval-site fixture SOP's `owner_user_id` to null in `beforeAll` and asserts it before relying on the red pin (research Q2/Q3).
- D-13: Bundle: admin surfaces stay out of worker routes (dynamic module gated on `useIsAdmin()` exactly as Phase 41 did); `/sops/page` and `/sops/[sopId]/page` within ±2 KB of the untouched baseline; deleting the Miller code should REDUCE the page chunk — record the numbers, never recapture.

### Claude's Discretion
- Whether the table is a plain `<table>` or a `role="grid"` div — plain `<table>` preferred (native semantics, tokens only).
- Whether the inbox and table share one query or two; keep it to what the admin needs per screen.
- Plan the deletions as the LAST wave so every earlier wave's specs keep running against real code.
</decisions>

<canonical_refs>
## Canonical References
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` (Admin inbox, floor health, library table, pins vocabulary, what to avoid)
- `.planning/sketches/007-plant-floor-navigation/index.html` (Admin tab: inbox rows, decks/chips, floor, table with checks; `health()` and admin `paint()` logic)
- Phase 41: `41-CONTEXT.md`, `41-0[1-8]-SUMMARY.md` (lenses, scope resolver, deep-link contracts, bundle seam, evals), `tests/phase41/*.spec.ts` (what will need repointing)
- Phase 28/29/30: governance queue (`listGovernanceQueue`, `GovernanceQueueRow`, `approveStep` gating), `tests/phase28/governance-queue.spec.ts`, `tests/phase29/queue-approve-action.spec.ts`, `tests/phase30/governance-fold.spec.ts`
- Phase 51/52: `src/actions/site.ts`, `src/actions/site-worker.ts`, `src/components/sop/plant/*`, `src/lib/sop/worker-signal.ts`, `src/lib/site/scene.ts`
- `CLAUDE.md` § Learnings: 2026-08-04 (deletion guards assert absence of references), 2026-07-13 (repoint stale guards in the same commit), 2026-09-13, 2026-09-27, 2026-09-28 ×3, 2026-09-29, 2026-07-24 (CSV export formula injection — if any export is added, none is planned)
- `.planning/codebase/CAPABILITY-MATRIX.md`, `src/lib/journeys/journeys.ts`, `tests/evals/sop-surface.eval.ts`
</canonical_refs>

<specifics>
## Specific Ideas
- Real prod data (2026-09-28): 33 SOPs, 27 drafts, 4 published, 2 stuck, ~19 with no owner — the inbox will open with a long "No owner" list; that is the point, not a bug.
- The "All clear" state copy from the sketch: `CLEAR · Nothing needs attention · Every SOP is owned, current, and correctly assigned.` — keep it, it finally sits on the right page.
</specifics>

<deferred>
## Deferred Ideas
- Moving Access wiring under Team; review-due calendar ("Coming up"); "SOPs you look after" side card (cheap, add if the inbox column has room); CSV export of the checks table.
</deferred>

---
*Phase: 54-admin-inbox-floor-health-library-table · Context gathered: 2026-09-29 (orchestrator-compiled)*
