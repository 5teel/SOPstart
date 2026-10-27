# Phase 69 — Critical controls

**Goal:** an officer can see, from records the site already makes, that the controls for its critical risks are being used. This is the duty in the NZ Health and Safety at Work Amendment Act 2026 (in force 1 April 2027). The phase has four parts:
1. **Critical controls.** An admin marks a step as a critical control for a critical-risk type.
2. **Officer view.** "Critical controls verified", built from existing completion records, photos and sign-offs.
3. **Reviews.** SOPs with a critical control get a shorter review interval.
4. **Hierarchy of controls.** Jev tags each hazard's controls. The authoring check flags hazards controlled only by PPE or administrative steps.

**Depends on:** Phase 68. **Scope agreed:** Simon, 2026-10-27, all four parts. **Plan written:** 2026-10-27, without GSD.

## Facts this plan rests on
- **Steps:** they live in `sop_focus_steps`, with kind `hazard | ppe | step | check` (`src/lib/sop/focus.ts`). The editor and `scripts/convert-sops-to-steps.ts` write them.
- **Runs:** a run is a `sop_walks` row. `acks` and `done` are maps keyed by step id, and `photos` is a list of `{stepId,…}`. A submitted walk becomes a `sop_completions` row with the same id, and its sign-off is in `completion_sign_offs`. Every input the officer view needs is already stored, so no new capture is needed.
- **Reviews:** `sops.review_due_at` comes from `resolveCadenceMonths(category, orgCadences, perSopOverride)` in `src/lib/governance/cadences.ts`, and is set when a review is recorded (`src/actions/governance.ts`). It is computed on the event, so ADR-0002 already holds.
- **Jev:** `src/lib/ai/jev.ts` is the only door to Jev. Authoring checks run after parsing in `src/lib/parsers/jev-checks.ts` (`checkSteps` → `StepNote`), and the notes appear in `ClearView`.
- **Schedule 1A:** legislation.govt.nz returns 403 to fetches. Secondary sources ([ThinkSafe](https://www.thinksafe.co.nz/blog/post/163241/schedule-1a-critical-risks/), Gifford Devine, Downie Stewart) give the entries from the bill:
  - hazardous substances, asbestos, mining, quarrying, major hazard facilities, petroleum and geothermal, adventure activities, amusement devices;
  - plus the General Risk and Workplace Management Regulations (working at height, confined spaces and others);
  - and a catch-all: anything likely to cause death, a notifiable injury or illness, a notifiable incident or an occupational disease.

  For a manufacturing site, the catch-all carries most of the weight. **Open:** Simon reads the enacted Schedule 1A in a browser before D-02's list ships (step 1).

## Decisions
- **D-01 Critical control is one nullable column.** `sop_focus_steps.critical_risk text null`, holding a key from a fixed list in a new pure module, `src/lib/sop/critical-risks.ts`. A null value means the step is not a critical control. Any step kind can carry it, though it is mostly `step` or `check`.
  - No new table, and no per-org list. ponytail: a fixed list. Add per-org risk types when a site asks.
- **D-02 The risk list** (plain words, metric NZ terms):

  | Key | Label |
  |---|---|
  | `isolation` | Isolation and lockout |
  | `height` | Working at height |
  | `mobile_plant` | Mobile plant and forklifts |
  | `machinery` | Moving machinery and guarding |
  | `confined_space` | Confined space |
  | `hazardous_substances` | Hazardous substances |
  | `hot_work` | Hot work and molten material |
  | `lifting` | Lifting and suspended loads |
  | `electrical` | Electrical |
  | `pressure` | Stored pressure |
  | `other` | Other critical risk |

  The list is checked against Schedule 1A and the catch-all in step 1.
- **D-03 How it looks** (ADR-0007, ADR-0013, "visual, no new symbols"). The step wears a `.tag` reading **Critical control · Isolation and lockout** in ink. It gets no new colour and no glyph: red stays for danger and failures, and yellow and blue stay for the signs. A worker sees the tag in read and run. The step itself stays where it is in the walk order.
- **D-04 Marking it.** In the SOP editor, a step's existing step menu gets "Mark as critical control…", which opens a popup with the risk list (focused-decision popup pattern). It is saved by `setStepCriticalRisk` in `src/actions/`. That action:
  - checks admin or safety_manager, plus aal2 (ADR-0028);
  - filters the update by org from the session;
  - ends in `.select('id')`;
  - logs `recordDecision()` (ADR-0008).

  Authoring stays quiet (ADR-0004): the app never prompts anyone to add a critical control.
- **D-05 The officer view** is a new section in Office for admin and safety_manager, under the heading **Critical controls**. It is computed on read with no stored rollup (ADR-0002), grouped by risk type. Each row is one critical-control step, showing:
  - its SOP;
  - the number of runs in the last 90 days;
  - how many of those runs were **verified**: the step was acked or done, its required photo is present, and the run was signed off;
  - the date it was last verified.

  The supporting states are plain words and position: "Not run in 90 days" and "Runs not signed off". Red is used only for a run that was rejected. Each row links to its records.
  - **Don't sell the worker out** (Visy): the view counts controls, not people. Individual names appear only inside the existing record pages, which already show them to these roles.
  - **ponytail:** a server-side query over the last 90 days of walks. Add a rollup table if a site runs more than about 10k walks a quarter.
- **D-06 Shorter review interval.** A SOP with any critical-control step uses `min(normal months, the org's critical cadence)`. The critical cadence is a `sop_review_cadences` row with category `critical`, and defaults to 6 months when absent. It is applied in `resolveCadenceMonths` (one new argument), so every caller gets it. Marking the first critical control also pulls an existing `review_due_at` forward when the new date is earlier. That happens on the event, in `setStepCriticalRisk`.
- **D-07 Hierarchy of controls via Jev.** After parsing, and in the existing authoring check, one Jev `choice` question per control step linked to a hazard:
  - the answer is one of `eliminate | substitute | engineer | administrative | ppe`;
  - it is stored in `sop_focus_steps.control_level text null`, with confidence ≥ `FACT_BAR` or else null.

  The check adds one `StepNote` problem, `ppe_or_admin_only`, when every control for a hazard is `administrative` or `ppe`. It appears with the other notes in `ClearView`: quiet, and never blocking publish.
  - A hazard's controls are found by position. They are the steps of the hazard's own section, or of the whole SOP for a "Before you start" hazard. ponytail: the heuristic is position only, and explicit hazard-to-control links come in when sites ask.
  - Jev failing gives no notes and is logged; a fail-open outage reports as an error (learning: all jobs erroring at $0 is an outage).
- **D-08 New ADR-0031: critical controls.** It covers the column-based marking, the fixed risk list, the officer view computed on read, the critical review cadence and Jev control levels.

## Steps
1. **Confirm the list.** Simon opens the enacted Schedule 1A on legislation.govt.nz. Adjust the D-02 labels if a manufacturing-relevant entry is missing. Read `.planning/research/customer-interviews/` for any critical-control or officer mentions, and load `Skill("sketch-findings-SOPstart")` before the UI.
2. **Migration 00089:**
   - add `sop_focus_steps.critical_risk` and `control_level`, each with a check constraint on the keys;
   - existing RLS on `sop_focus_steps` covers it (admin plus aal2 writes since 00087), and the step confirms that.
3. **Pure modules:**
   - `src/lib/sop/critical-risks.ts` (list and labels);
   - `src/lib/sop/critical-verified.ts`, which turns walks, sign-offs and steps into rows, with a small assert-based unit test;
   - add the `critical` cadence to `resolveCadenceMonths`, with a unit test.
4. **Action** `setStepCriticalRisk` (D-04, D-06), and an editor popup with the step tag in read, run and editor (D-03).
5. **Officer view** in Office (D-05), with its server read in `src/actions/` and the role and aal2 checks.
6. **Jev control levels** in `jev-checks.ts` and their `ClearView` note (D-07).
   - Re-run the analogue eval (`.autoresearch/analogue/`) on three real SOPs from `SOPstart - Raw SOPs/`. Check the levels by eye before trusting `FACT_BAR`.
7. **Same-commit duties:**
   - `journeys.ts` gets the officer view and mark-control flows (`/pathways` shows 0 not-mapped);
   - `src/lib/uat/tests.ts` gets one plain-words test;
   - `CAPABILITY-MATRIX.md` gets the new action and view;
   - ADR-0031 and the `docs/adr/README.md` row.
8. **Gates:** `npx tsc --noEmit`, `npm run build` (exit code and bundle gate: `/sops/[sopId]` and `/` baselines; diff chunk lists if they move), and the local lint suite once.
9. **Deployed eval** `tests/evals/critical-controls.eval.ts`, using the aal2 admin session:
   - mark a fixture step, which makes the tag show for the worker;
   - the worker runs it with a photo, and the supervisor signs off;
   - the officer view shows it verified with today's date;
   - a PPE-only fixture hazard shows the note;
   - review due date ≤ 6 months.

   Run it once with `npm run eval -- --phase 69` after the Fly workflow for HEAD completes. Read the screenshots.
10. **Outcome section** here, with a learnings entry if one is earned, and a HANDOFF update.

## Out of scope
- Per-org risk types and explicit hazard-to-control links (D-01, D-07 ponytails).
- Contractor-specific views. The duty extends to contractors, but contractors are not a role yet.
- Prompts to add critical controls (ADR-0004).

## After this: the homepage modules (Simon, 2026-10-27: "build them")
These are separate phases, each with its own PLAN.md written when it is reached. The homepage keeps listing all four until then. The order follows the research and the shared parts:

| Phase | Module | Minimum that makes the homepage line true | Reuses |
|---|---|---|---|
| 70 | Lockout / tagout | Isolation points per machine; a LOTO run that records each point locked and verified, with photos | Machines, the run/walk engine, critical control `isolation` |
| 71 | Permits to work | Requested → approved → active → closed, on a machine or place, with an approver and an expiry checked on read | Sign-off inbox, decisions ledger |
| 72 | Safety meetings | A toolbox talk with topic, attendees ticked on a phone and an optional linked SOP | People, records |
| 73 | PMs | A task per machine, due by interval and computed on read (ADR-0002, no cron), done as a run with sign-off | Review-cadence maths, the run engine |
