# Architecture Research — v7.0 Competency & Training Layer

**Domain:** Integration of a competency/training layer into an existing multi-tenant Next.js + Supabase SOP platform
**Researched:** 2026-07-19
**Confidence:** HIGH (all findings verified directly against live source files, not training-data assumption)

This is an integration-architecture doc, not greenfield domain research. Every recommendation below is anchored to a specific existing file, table, or pattern already in this codebase — the mandate is "extend the established shapes," not invent new ones. (Supersedes the stale 2026-03-29 v2.0 video-pathways version of this file, which no longer reflects the shipped architecture.)

## System Overview — where the new layer sits

```
┌───────────────────────────────────────────────────────────────────────────┐
│  REQUIREMENTS SIDE (who must know what)         EVIDENCE SIDE (what's proven) │
│  ───────────────────────────────────────        ─────────────────────────── │
│  access_grants (Phase 32/33)                     sop_completions (D-17)      │
│    → materializeSopAccess()                      completion_sign_offs       │
│    → sop_departments (junction)                  sop_completion_signatures  │
│    → sop_access_people (junction)                  ▲                        │
│  member_departments (Phase 25)                     │ NEW                    │
│         │                                          │ sop_observations       │
│         ▼                                          │ (supervisor-initiated) │
│  ┌──────────────────────────────────────────────────┴──────────────────┐   │
│  │   NEW: classifyCompetencyState() — pure function, mirrors            │   │
│  │   classifyGovernanceRow() (src/lib/governance/classify.ts)           │   │
│  │   input: required(worker,sop) + latest completion + latest sign-off  │   │
│  │          + latest observation + sop.version vs completion.sop_version│   │
│  │   output: 'not_started' | 'read' | 'supervised' | 'competent'        │   │
│  └──────────────────────────────────────────────────┬──────────────────┘   │
│                                                       ▼                     │
│         NEW: getTrainingMatrix() — bulk composed read (src/actions/training.ts) │
│         mirrors listGovernanceQueue() shape exactly: N bulk queries in     │
│         Promise.all → one .map() reduce → array of computed rows          │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼────────────────────┐
                    ▼               ▼                     ▼
        /admin/team (3rd view    /admin/sops?view=      /activity
        mode: Training matrix)   attention (rollup       (supervisors log
                                  chip, SOP-level only)   observations,
                                                          sign off completions)
```

## Existing Pieces This Layer Reuses (do not rebuild)

| Piece | File | What it gives the competency layer |
|-------|------|-------------------------------------|
| Materialized access junctions | `src/actions/grants.ts` → `sop_departments`, `sop_access_people` | The "requirements side" — who must know each SOP. Already resolves org/area/department/role/person tiers + SOP-target overrides. Read-only for this layer; never re-resolve `resolveEffectiveAccess` per worker at matrix time. |
| Member→department roster | `member_departments` (00035) | Joins a `worker_id` to the department set used to test matrix membership. |
| Completion evidence | `src/actions/completions.ts` → `sop_completions`, `completion_photos` | `submitted_at`, `sop_version`, `status`, `worker_id`/`roster_worker_id` — the primary "did this person do the walkthrough" signal. |
| Sign-off chain | `completion_sign_offs` (D-17, append-only) | Supervisor approve/reject decision per completion — feeds the "competent-signed-off" state. |
| Legal signature | `sop_completion_signatures` (00038, append-only) | Worker + supervisor signature rows — precedent for how `sop_observations` should be shaped (append-only, service-role insert, `reviewed_by = auth.uid()`-style check). |
| Cadence + due-date math | `src/lib/governance/cadences.ts` → `resolveCadenceMonths()`, `computeReviewDueDate()` | Pure functions already computing "due date = anchor date + N months by category, org-configurable, with a default fallback." Reuse verbatim for refresher due-dates — different anchor date, same function. |
| Governance composed-read pattern | `src/actions/governance.ts` → `listGovernanceQueue()` | The exact shape to copy for `getTrainingMatrix()`: bulk reads via `Promise.all`, then a single `.map()` through a pure classifier (`classifyGovernanceRow`). No caching, no stored "queue" table — computed live on every page load, same choice Phase 30 already made for governance. |
| Governance queue host page | `src/app/(protected)/admin/sops/page.tsx` (`?view=attention`) | SOP-level rollup surface — extend with a `refresher_due` aggregate chip, do not duplicate the person-level matrix here. Note: `/admin/governance` itself is now only a redirect shim (Phase 30 folded it into `/admin/sops`). |
| Team/org page | `src/app/(protected)/admin/team/page.tsx` + `TeamViewShell` | Already has a client-side view-mode toggle (⊞ Chart / ▤ Columns). Natural third mode for the training matrix — reuse the toggle component, don't build a new page shell. |
| AI adapter + agent metadata | `src/lib/ai/`, `src/lib/agent-layer/synthesis.ts` | Provider-agnostic model calls, already org-scoped. Reuse for the AI maintenance schedule and the completeness rubric — do not add a second AI client. |
| AI reviewer jobs | `src/lib/parsers/ai-reviewer/` (Phase 21) | Existing job orchestrator (5 jobs today) — completeness rubric is a 6th job, not a new subsystem. |
| Cron pattern | `src/app/api/agent-layer/synthesis-sweep/route.ts` + `src/lib/supabase/middleware.ts` (`isCronRoute`) | Bearer-secret auth + middleware exemption — copy exactly for any new sweep endpoint; **must** add the new route to the middleware exemption list or it 307-redirects to `/login` (2026-07-05 learning, already bit this codebase once). |
| Admin auth guard | `src/lib/auth/guards.ts` → `requireAdminContext()` | Every new server action in this layer uses this, not a hand-rolled role check. |
| Service-role org self-enforcement | Pattern used identically in `grants.ts`, `governance.ts`, `departments.ts` | Every new write (`sop_observations` insert, cadence upsert) goes through `createAdminClient()` only where the table has no authenticated write policy, and self-enforces `organisation_id` from `getSessionContext()`, never from client input — the CLAUDE.md 2026-06-15/2026-06-26/2026-07-05 cross-tenant class of bug. |

---

## 1. Data Model

### 1.1 Competency state — DERIVED, not stored

**Decision: no `competency_states` table.** Compute state at read time via a pure function, mirroring `classifyGovernanceRow`.

**Why derived wins over stored here (explicit trade-off):**

| | Stored (`competency_states` table, one row per person×SOP) | Derived (pure function over existing tables) |
|---|---|---|
| Consistency | Needs an invalidation trigger/re-write on every `submitCompletion`, `signOffCompletion`, and new `sop_observations` insert — a second source of truth that can drift (exactly the class of bug the 2026-07-05 "best-effort pipelines null-clobber on partial failure" and 2026-07-07 "layout_data must be re-emitted by every insert path" learnings warn about: every write path that can produce evidence must remember to also touch the derived table, or it silently rots). | No invalidation surface. State is *always* a live function of the evidence tables — cannot go stale because there is nothing to go stale. |
| Query cost at 500×200 | O(1) read per cell once written, but write amplification on every completion. | Recompute per matrix load — but the matrix is a bounded admin-only bulk read (see §2), not a per-worker realtime need. Cheap because the underlying evidence sets per org are small (hundreds of completions/sign-offs/observations, not millions). |
| Precedent in this codebase | None — nothing else in the app stores a derived "status" column separately from its source rows (governance flags, approval `awaiting_approval`, ownership flags are ALL computed live). | Matches `classifyGovernanceRow` (governance flags), `resolveSopAccess` (access override), and the `sop_completions.status` transition pattern — one canonical event stream, state computed from it. |
| Why materialization WAS used for grants (`sop_departments`/`sop_access_people`) but should NOT be used here | Grants materialization exists because access resolution is a 5-tier union (org/area/department/role/person) recomputed from a *different, mutable* graph (org chart) that changes independently of any single write, and workers need it under RLS on every SOP read (hot path, every walkthrough load). Competency state is read only by admins on an admin-only matrix page (cold path, infrequent), and its inputs (completions, sign-offs, observations) are already flat evidence rows, not a graph needing resolution. | — |

So: `classifyCompetencyState({ required, latestCompletion, latestSignOff, latestObservation, currentSopVersion })` → returns one of:

```
'not_started'         // required but no completion at all
'read'                // has a completion, no approving sign-off and no 'consistent' observation
'supervised'          // has ≥1 observation (any outcome) but not yet competent
'competent'           // latest completion is signed_off AND (no observation required OR latest observation outcome = 'consistent')
```

Lives in `src/lib/competency/classify.ts` (new file, same directory convention as `src/lib/governance/classify.ts`).

Also derived, same function, using existing columns — no new storage:
- **Trained-on-outdated-version flag** — `latestCompletion.sop_version < sops.version` (or `sops.superseded_by is not null` chain, 00008 precedent) — pure comparison of two integers already on hand.
- **Refresher due-date** — `computeReviewDueDate(latestCompletion.submitted_at, resolveCadenceMonths(sop.category, orgCadences))`, i.e. reuse `src/lib/governance/cadences.ts` verbatim with a different anchor date (worker's last completion instead of SOP's last review). **Trade-off flagged**: this reuses the *same* `sop_review_cadences` org+category months config for both "content review due" (SOP-level, Phase 28) and "worker refresher due" (person-level, new). That is the lazy-correct default — v7.0 scope does not ask for separate cadences, and North Star favors avoiding an extra admin settings surface. If Simon later wants a shorter refresher interval than content-review interval for hazardous tasks, split into a second `training_refresher_cadences` table with the identical shape — a small change given the helper functions are already generic over "months by category."

### 1.2 New table: `sop_observations` (stored — this one has no derivable source)

Naming follows the existing `sop_`-prefixed evidence-table convention (`sop_completions`, `sop_completion_signatures`). Append-only, mirrors `completion_sign_offs`/`sop_review_events` RLS shape exactly (both already reviewed and hardened against the cross-tenant/tampering classes):

```sql
create table public.sop_observations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  sop_id           uuid not null references public.sops(id) on delete cascade,
  worker_id        uuid not null references auth.users(id),        -- the person observed (organisation_members.user_id, same identity as sop_completions.worker_id / member_departments.member_id)
  observer_id      uuid not null references auth.users(id),        -- the supervisor who logged it (mirrors completion_sign_offs.supervisor_id)
  outcome          text not null check (outcome in ('consistent','needs_reset')),
  note             text,
  created_at       timestamptz not null default now()
);
-- RLS: SELECT org-scoped, three-tier (workers see own / supervisors see supervised via supervisor_assignments / safety_managers see all) — copy sop_completions' three policies verbatim.
-- INSERT: role in ('supervisor','safety_manager'), observer_id = auth.uid(), organisation_id = current_organisation_id() — copy sop_review_events_insert_admin shape.
-- NO update/delete policy — append-only legal evidence (D-17/COMP-07 precedent, third instance of this exact shape in the codebase).
```

Independent of the matrix and of access grants — can be built and shipped standalone (see §4 build order).

### 1.3 Other net-new stored columns (additive, no new tables)

- `sops.document_code text`, `sops.risk_priority text` — additive `ALTER TABLE`, same shape as the Phase 28 `owner_user_id`/`review_due_at` migration (00043 precedent: `add column if not exists`, index if queried, ride the existing `admins_can_update_sops` RLS policy, zero new policies).
- Assessor capability: **no new column.** "Trainer must be signed off" is a *check*, computed at the point `sop_observations` or `completion_sign_offs` is inserted (does the observer/supervisor's own role + optionally their own competency state qualify them) — folds into the existing G-04 stale-role work already tracked in governance, not a new state machine.

---

## 2. The Matrix Query — 500 SOPs × 200 workers under RLS

**Do not compute per-cell.** Follow `listGovernanceQueue()`'s shape: a fixed small number of bulk queries via `Promise.all`, reduced in one JS pass.

**Requirements side (who needs what) — 3-4 bulk reads, already materialized:**
1. `sop_departments` (sop_id, department_id) — all rows for the org's SOPs (Phase 32/33 output, already exists).
2. `sop_access_people` (sop_id, member_id) — same.
3. `member_departments` (member_id, department_id) — worker → department roster (Phase 25, already exists).
4. `sops.all_departments` flag per SOP (already selected in `listGovernanceQueue`, same query can be shared/extended).

Reduce to `Map<workerId, Set<sopId>>` in JS: a worker requires a SOP if `sop.all_departments`, or the worker's department ∈ that SOP's `sop_departments`, or the worker ∈ that SOP's `sop_access_people`. This is the exact same union logic `resolveSopAccess` already encodes for materialization — here it's applied to *already-materialized* rows, so no re-resolution of the 5-tier grant graph is needed, just a set-membership join.

**Evidence side (what's proven) — 3 bulk reads:**
5. Latest `sop_completions` per (worker_id, sop_id) for the org. Supabase-js has no `DISTINCT ON`; use a `SECURITY DEFINER` SQL function (`latest_completions_for_org(p_organisation_id uuid)` using `select distinct on (worker_id, sop_id) ... order by worker_id, sop_id, submitted_at desc`), called via `createAdminClient().rpc(...)`. **Must** `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT TO service_role` — this is a parameter-trusting RPC (takes `p_organisation_id`), the exact shape the 2026-07-05 `match_sop_agent_metadata` cross-tenant hole was built and fixed under. Never expose it to `authenticated`.
6. `completion_sign_offs` filtered `.in('completion_id', latestCompletionIds)` — small (bounded by #completions returned in step 5, not the full history table).
7. `sop_observations` filtered `.in('sop_id', requiredSopIds).in('worker_id', requiredWorkerIds)` or, simpler at this org scale, all observations for the org (an org's total row count here is small — training records get CSV-exported, not paginated at DB scale) reduced client-side to latest-per-pair.

All 7 reads run inside one `Promise.all` (2026-07-13 "independent server-page fetches belong in Promise.all, not serial" learning already logged in CLAUDE.md — applies here identically). Then one `.map()`/reduce pass over the required-pairs Map (not the full 500×200 cross-product — most workers aren't assigned most SOPs, so the real cell count is bounded by department/role fan-out, typically a small fraction of 100,000) builds the matrix rows through `classifyCompetencyState`.

**Rendering:** don't ship one 100k-cell payload to the client. `/admin/team`'s Training view groups by department (mirrors the existing Columns roster grouping) and paginates/lazily-expands per department — server action accepts an optional `departmentId` filter so the first paint is one department's worth of rows, not the whole org.

---

## 3. Which Existing Surfaces Host the New Views

| New view | Host | Why here, not a new route |
|---|---|---|
| **Training matrix** (people × required-SOPs × status) | `/admin/team` — third mode on `TeamViewShell`'s existing ⊞ Chart / ▤ Columns toggle | `AdminNav` is locked at 5 tabs (Phase 30 UX-02 decision — governance was *folded into* `/admin/sops` rather than given a 6th tab; same consolidation instinct applies here). `TeamViewShell` already owns the "how do I look at my people" surface and already has a working mode-toggle pattern — extend it, don't build a new page shell. |
| **Per-worker training record + CSV export** | Drill-down from a Columns roster row (`RoleAssignmentTable`) or a matrix cell → `/admin/team/[userId]` (new sub-route, not a new nav item) | The roster already lists every person; adding a "Training record" link per row is a smaller diff than a new top-level page. CSV export is a server action returning a blob, same shape as any existing export action — no new route needed for the export itself. |
| **Supervisor observations** ("watched worker do X — consistent/needs reset") | `/activity` (existing supervisor completion-review surface, `signOffCompletion`'s home) | Supervisors already land here to sign off completions for their assigned workers (`supervisor_assignments`-scoped, same RLS this new table reuses). Add "Log observation" as a lightweight action beside the existing sign-off UI rather than a new supervisor-facing page — same audience, same trust boundary, same page load. |
| **Refresher-due rollup** | `/admin/sops?view=attention` (governance queue) — new SOP-level aggregate chip only (e.g. "12 SOPs have overdue refreshers"), linking through to the Training matrix filtered to that SOP | Governance stays SOP-level (document signal: ownership/review/approval). Person-level refresher-due detail belongs in the Training matrix, not duplicated into `GovernanceRow`. Keeps `classifyGovernanceRow`'s existing per-SOP contract intact — extending it with per-worker data would break its shape and force a second bulk-fetch it doesn't otherwise need. |
| **AI maintenance schedule** | `/admin/sops?view=attention` — an AI-scored `priority` sort/badge added to the *already-fetched* `GovernanceRow[]`, not a separate page or stored queue | Phase 30 already chose live-computed-not-cached for governance. The maintenance schedule is a ranking layer on top of rows that already exist in memory at that point — call the AI adapter with the computed rows (staleness + usage + flags already on hand), get back a priority order/score, sort. If per-page-load AI cost becomes a concern, cache the score keyed by a flags+staleness hash and refresh via the *existing* `synthesis-sweep` cron (add one more job to it) rather than standing up a second cron endpoint. |
| **Completeness rubric** | AI reviewer job pipeline (`src/lib/parsers/ai-reviewer/`), surfaced wherever reviewer flags already render (publish gate side-by-side panel, Phase 21) | 6th job in the existing orchestrator, not a new subsystem or new page. |
| **Document codes + register export** | `/admin/sops` list — new column + filter, CSV export action alongside the training-record export | Additive `sops` columns, same list page, same export utility reused for both training records and the register (write one `toCsv()` helper, use it twice — ladder rung 2). |

---

## 4. Build Order

Dependency graph (arrows = "must exist before"):

```
sop_observations (independent) ──────┐
                                       ├──► classifyCompetencyState() ──► getTrainingMatrix() ──┬──► Training matrix UI (/admin/team)
access grants materialization (done) ─┘         │                                                ├──► Per-worker record + CSV export
completions/sign-offs (done) ─────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  └──► refresher due-date (reuses cadences.ts) ──► Governance rollup chip
                                                  └──► assessor capability check (needs states to exist)

document_code/risk_priority columns (independent) ─┐
completeness rubric (independent, extends Phase 21) ├── can run in parallel with all of the above
AI maintenance schedule (needs governance rows,     ┘   done in Phase 28; optionally consumes competency
  done in Phase 28) — soft dependency on matrix        rollups once they exist, so sequence last among AI items
  for a richer priority signal, not a hard blocker
```

**Recommended sequence:**

1. **`sop_observations` table + `recordObservation` action + "Log observation" UI on `/activity`.** Zero dependencies on new work — pure append to the evidence side using patterns already proven three times (`completion_sign_offs`, `sop_completion_signatures`, `sop_review_events`). Fast, standalone win; also the RLS/append-only shape this whole layer leans on.
2. **`classifyCompetencyState()` pure function + the bulk-read plumbing (`latest_completions_for_org` RPC, requirements-side reducer).** Depends on (1) existing as a data source, plus already-shipped grants/completions. This is the load-bearing piece — get it right once, everything else consumes it.
3. **Training matrix UI** (`/admin/team` third mode) + **per-worker training record + CSV export.** Both consume the output of (2); can be built in parallel with each other once (2) lands, since both are just different groupings of the same evidence fetch.
4. **Refresher due-dates**, reusing `cadences.ts`. Bundle with (3) — needs `classifyCompetencyState`'s "latest completion date" output, and the cadence-config decision (§1.1 trade-off) should be made explicit at this point, not deferred.
5. **Assessor capability gating.** Needs (2) to exist if the check is "assessor must themselves be competent-signed-off on something" — sequence after states exist. Folds into the existing role/G-04 stale-role work rather than a new gate mechanism.
6. **Document codes + risk-priority columns + register export** and **completeness rubric AI-reviewer job** — fully independent of 1–5, can be done any time in parallel (good filler work for a second workstream, low risk, additive columns / additive reviewer job only).
7. **AI maintenance schedule.** Lowest urgency per North Star (ease-of-use first; this is a prioritization aid, not a blocking gate) and benefits from competency rollups existing (a maintenance signal like "many workers overdue for refresher" is stronger with (2)–(4) shipped) — do last, extend the existing `synthesis-sweep` cron rather than adding a new one.

---

## Anti-Patterns to Avoid (specific to this integration)

### Anti-Pattern 1: A stored `competency_states` table with a sync trigger
**What people do:** Add a table with one row per (person, SOP) and a Postgres trigger or app-level write on every completion/sign-off/observation insert to keep it current.
**Why it's wrong:** Every future evidence-producing write path must remember to also touch this table — the exact "materialize on every mutation path" trap that bit this codebase twice already (2026-07-07 `layout_data` omitted on non-DOCX insert paths; 2026-06-15 junction tables needing re-materialization on every org-chart mutation, CR-03). Competency state has no need for this cost — see §1.1.
**Do this instead:** Derive it live via a pure function, same as governance flags.

### Anti-Pattern 2: Recomputing `resolveEffectiveAccess` per worker for the matrix
**What people do:** Re-run the 5-tier grant resolution graph (org/area/department/role/person) for each of 200 workers × 500 SOPs to figure out "who needs this."
**Why it's wrong:** That resolution already ran once at grant-write time and its output is sitting in `sop_departments`/`sop_access_people`. Recomputing it at matrix-read time duplicates expensive graph logic that Phase 32/33 already paid for.
**Do this instead:** Read the materialized junctions + `member_departments`, join in memory (§2).

### Anti-Pattern 3: A parameter-trusting RPC for the bulk-completions read
**What people do:** Write `latest_completions_for_org(p_organisation_id uuid)` as `SECURITY DEFINER` and leave it callable by `authenticated`.
**Why it's wrong:** Every Postgres function is auto-exposed at `POST /rest/v1/rpc/<name>`; a caller-supplied org-id parameter on a `SECURITY DEFINER` function is a cross-tenant read hole regardless of who's "supposed" to call it — this exact bug shipped to prod once already (`match_sop_agent_metadata`, 2026-07-05, CR fixed via `REVOKE`/`GRANT service_role`).
**Do this instead:** `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role`, call only via `createAdminClient()` inside an already-`requireAdminContext()`-gated server action.

### Anti-Pattern 4: A new nav tab or new cron route for every new feature
**What people do:** Add "Training" as a 6th `AdminNav` item, or a second cron endpoint for the maintenance schedule.
**Why it's wrong:** Phase 30 already made the opposite call (fold governance into `/admin/sops` rather than grow the nav) and the codebase already has one working cron+bearer+middleware-exemption pattern that a second one would duplicate (and risk the exact 2026-07-05 "forgot the middleware exemption → 307 to /login" bug on a second route).
**Do this instead:** Extend existing surfaces (`TeamViewShell` mode toggle, `synthesis-sweep` cron with one more job) per §3.

---

## Sources

- Direct source reads (HIGH confidence, no training-data inference used for any table/file name below):
  - `src/actions/grants.ts` — access-grant CRUD + materialization fanout (Phase 32/33)
  - `src/actions/completions.ts` — completion submit/sign-off/signature actions (Phase 4/23, D-17)
  - `src/actions/governance.ts` + `src/app/(protected)/admin/sops/page.tsx` — governance queue composed-read pattern, folded-into-sops surface (Phase 28/30)
  - `src/app/(protected)/admin/team/page.tsx` — org model + roster host page (Phase 32-07), `TeamViewShell`
  - `supabase/migrations/00050_access_grants_sop_target.sql`, `00010_completion_schema.sql`, `00038_phase23_schema.sql`, `00035_departments_schema.sql`, `00008_sop_versioning.sql` — schema precedents for RLS shape, append-only pattern, versioning columns
  - `.planning/milestones/v6.0/phases/28-ownership-review-lifecycle-governance-queue/28-01-PLAN.md` — migration/cadence/audit-event precedent this layer copies
  - `src/app/api/agent-layer/synthesis-sweep/route.ts` + `src/lib/supabase/middleware.ts` — cron auth pattern
  - `.planning/PROJECT.md` — v7.0 milestone scope, North Star, build-on list
  - `CLAUDE.md` Learnings section — cross-tenant RLS/service-role class of bugs (2026-06-15, 2026-06-26, 2026-07-05), Promise.all serial-fetch learning (2026-07-13), materialization-must-be-re-triggered class (2026-07-07)

---
*Architecture research for: SafeStart (SOPstart) v7.0 Competency & Training Layer*
*Researched: 2026-07-19*
