# Stack Research

**Domain:** Competency/training-record layer (matrix, observations, CSV/register export, refresher scheduling) added to an existing Next.js 16 + Supabase PWA
**Researched:** 2026-07-19
**Confidence:** HIGH (verified directly against this repo's `package.json`, existing cron route, and existing date-cadence helper — not a greenfield ecosystem survey)

## Bottom Line

**No new npm packages are needed for v7.0.** Every new feature (training matrix, competency states, observations, CSV/register export, refresher cadence) is a data-modeling + UI-composition problem on top of infrastructure this project already has working in production: Supabase/Postgres tables + RLS, Next.js Route Handlers, native `Response` for file downloads, the existing `src/lib/governance/cadences.ts` date-math module, and the existing Railway Cron + bearer-secret pattern (`src/app/api/agent-layer/synthesis-sweep/route.ts`). This research exists to confirm that, not to introduce libraries.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| *(none — no new core technology)* | — | — | Matrix, observations, and exports are Postgres tables + server components + Route Handlers, all patterns already proven in this codebase (departments Phase 25, governance queue Phase 28, agent-layer sweep Phase 26.5). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none required)* | — | — | See "What NOT to Use" — CSV, matrix grid, and cron scheduling are all covered by stdlib/native platform features + already-installed deps below. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing Playwright suite | Source-contract + integration tests for new tables/routes | Same `phase15-stubs`/`phaseNN` project pattern already used — register new spec files per the 2026-05-25 lint-guard learning. |

## Installation

```bash
# Nothing to install. All four v7.0 stack needs below are solved with
# code already in the repo (Postgres, Next.js Route Handlers, existing
# lib/governance/cadences.ts, existing Railway Cron config).
```

## Per-Feature Breakdown (why the existing stack suffices)

### 1. Training matrix (people × required-SOPs × status)
- **Data:** a Postgres view or query joining `access_grants`/materialized junctions (Phase 32–33) → `sop_completions`/sign-off chains (Phase 4/23) → new `competency_states` table. Pure SQL, no ORM needed (this project uses the Supabase JS client directly throughout).
- **Rendering:** a plain HTML `<table>` with `position: sticky` headers (CSS, native) — Tailwind 4 already handles sticky/overflow utility classes. **Default the matrix view to department-scoped** (Phase 25 departments already exist as a first-class filter and the milestone spec itself calls for "per-department and per-worker cuts") — this naturally bounds a single render to tens of workers × tens-to-~100 SOPs, not the theoretical 500×500 org-wide worst case.
- **Scale reality check:** 50–500 SOPs is the *org's total library*; the milestone explicitly wants the matrix cut by department, not one flat unfiltered grid. A department-scoped `<table>` with a few thousand cells renders and scrolls fine with zero virtualization.
- **Verdict:** no grid/table library needed at ship time.

### 2. Competency states + observation records
- New Postgres tables (`competency_states`, `sop_observations`) with RLS mirroring the existing `member_departments`/`sop_departments` junction pattern (org-scoped, service-role writes where RLS would otherwise recurse — see CLAUDE.md 2026-06-15 learning). Server actions in `src/actions/`, same as every other mutation in this codebase.
- **Verdict:** no new package. This is schema + server actions, not a library problem.

### 3. Per-worker training-record CSV export + document-code register export
- CSV generation from tabular data is a ~15-line utility: join fields with `,`, wrap any field containing a comma/quote/newline in `"..."` with `""`-escaped quotes, join rows with `\n`, return via `new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="..."' } })` from a Route Handler. This is exactly what `text/csv` was designed for and Excel/Sheets open it natively — matches the locked v6.0 decision "Training records = CSV export only" (no HRIS integration surface).
- **Verdict:** no CSV library (no `papaparse`, no `csv-stringify`). Those exist to *parse* untrusted/malformed CSV input or handle exotic dialects — this is a *write-only, own-format* export where a hand-rolled RFC 4180 writer is fewer lines than importing and learning a library API. Add `papaparse` or similar only if a future feature needs to *import* worker/HR CSV data (not in scope for v7.0).

### 4. AI-prioritized maintenance schedule + AI-reviewer completeness rubric
- Both reuse the existing provider-agnostic AI adapter (Phase 26.5/27) and the existing AI reviewer job pipeline (Phase 21). New rubric = new prompt/schema, not new infrastructure. New maintenance-schedule logic = new scoring function over existing staleness/usage/flag signals, surfaced through the existing governance queue (Phase 28).
- **Verdict:** no new AI SDK, no new provider client — `@anthropic-ai/sdk` and `openai` are already installed and already used by the adapter.

### 5. Refresher re-walkthrough cadence (scheduled due-dates)
- This is due-date math (`lastCompletedAt + cadenceMonths → dueAt`) exactly like the existing SOP review-cadence system. **Extend `src/lib/governance/cadences.ts`** (already has `resolveCadenceMonths`/`computeReviewDueDate` using native UTC `Date` methods — no `date-fns`/`dayjs` in this codebase, and none needed for month-add arithmetic) rather than adding a date library.
- **Scheduling mechanism:** copy the `synthesis-sweep` pattern exactly — a new Route Handler (e.g. `/api/governance/refresher-sweep`) authenticated by the same `CRON_SECRET` bearer-token, timing-safe-equal pattern, exempted in `src/lib/supabase/middleware.ts`'s public-route list, batch-capped like `MAX_SOPS_PER_SWEEP`, invoked by a **Railway Cron** schedule (a platform feature — configured in the Railway dashboard/`railway.json`-adjacent cron service, not an npm dependency). Railway Cron's minimum interval is 5 minutes; daily is more than sufficient for refresher due-date surfacing.
- **Verdict:** no queue/scheduler library (no BullMQ, no node-cron, no Agenda). This is a single-process Railway deploy (per CLAUDE.md PM2/Railway learnings) — an in-process `setInterval` scheduler is explicitly the wrong pattern here (the synthesis-sweep code comment says so directly); Railway's own cron trigger + a stateless authenticated endpoint is the right one and is already proven in production.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Plain `<table>` + department-scoped default view | `@tanstack/react-virtual` (~18KB gzip, same vendor as already-installed `@tanstack/react-query`) | Only if a real org's unfiltered "all departments" matrix view is measured as sluggish (rule of thumb: >150 rendered rows becomes noticeably janky on a low-end Android tablet). Cheap to add later — do not pre-install. |
| Hand-rolled CSV writer | `papaparse` / `csv-stringify` | Only if v-next adds CSV/XLSX *import* (e.g. bulk HR roster upload) — those libraries earn their keep on parsing malformed/quoted input, not on writing your own well-formed rows. |
| Railway Cron + authenticated Route Handler (existing pattern) | `node-cron` / `BullMQ` + Redis | Only if job volume grows to need retries, backoff, distributed locking, or sub-5-minute scheduling — none of which apply to a daily/weekly refresher-due sweep over ≤500 SOPs. Adding a queue+Redis here would be new infra for a problem the existing pattern already solves. |
| CSV export (`text/csv`) | `exceljs` / `xlsx` for a "real" `.xlsx` register | Only if a customer explicitly needs multi-sheet workbooks, cell formatting, or formulas in the export — plain CSV already satisfies the locked "CSV export only, no HRIS integration" decision and opens natively in Excel. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| An LMS/training platform (TalentLMS, Docebo, etc.) or any HRIS/SuccessFactors API integration | Explicitly out of scope per PROJECT.md v7.0 anti-goals ("no HRIS API integration yet — CSV export only — SuccessFactors is a 'Later' target") | New Postgres tables + CSV export, as above |
| A grid library (AG Grid, react-table with virtualization, MUI DataGrid) for the training matrix | Massive dependency (AG Grid Enterprise-class features) for a problem a department-scoped HTML `<table>` already solves at this project's real per-view scale | Plain `<table>` + CSS sticky headers, department-scoped default |
| `date-fns` / `dayjs` / `moment` for refresher-cadence math | Duplicates `src/lib/governance/cadences.ts`, which already does correct UTC month-add math for the identical review-cadence problem | Extend the existing `cadences.ts` module |
| `node-cron`, `BullMQ`, in-process `setInterval` schedulers | Violates the single-process Railway deploy constraint (CLAUDE.md PM2/Railway learnings) — in-process timers don't survive restarts/deploys and this project has an established, working alternative | Railway Cron hitting a `CRON_SECRET`-authenticated Route Handler, exactly like `synthesis-sweep` |
| A disciplinary/workflow engine for competency enforcement | Explicit anti-goal — "no disciplinary workflow (records exportable, enforcement stays human)" | Data + export only; no gating logic |
| Gating worker SOP access on competency status | Explicit anti-goal — "worker's read/walkthrough access is never gated by competency status" | Competency states are read-only signal to admins/supervisors, never an access check in worker-facing code paths |

## Stack Patterns by Variant

**If the org-wide (all-departments) matrix view is requested as a first-class feature (not just a filter default):**
- Add `@tanstack/react-virtual` for that one view only, keep department-scoped views on the plain table
- Because virtualizing every matrix render for a case that mostly won't need it is premature; virtualize only the view that can actually hit hundreds of rows

**If document-code register export needs to be handed to auditors/WorkSafe as a formatted document (not raw data):**
- Generate CSV as the data export (as recommended) and let the org open/format it in Excel/Sheets themselves, OR add a lightweight PDF pass later using a tool already proven elsewhere in the org's workflow
- Because building PDF/report generation into the app is a different (and larger) problem than "export training evidence" — CSV satisfies the audit/evidence need without a new rendering pipeline

## Version Compatibility

Not applicable — no new packages introduced. All new code targets the stack already pinned in `package.json` (Next.js 16.2.1, React 19.2.4, TypeScript 5, Supabase JS `^2.99.3`, Tailwind 4, Zod `^4.3.6`).

## Sources

- Direct repo inspection — `C:\Development\SOPstart\package.json` (current dependency set, confirms no CSV/grid/date/cron library present)
- Direct repo inspection — `C:\Development\SOPstart\src\app\api\agent-layer\synthesis-sweep\route.ts` (existing Railway Cron + `CRON_SECRET` bearer pattern to replicate for refresher scheduling)
- Direct repo inspection — `C:\Development\SOPstart\src\lib\supabase\middleware.ts` (public-route exemption pattern required for any new cron-invoked route)
- Direct repo inspection — `C:\Development\SOPstart\src\lib\governance\cadences.ts` and `__tests__\classify.test.ts` (existing native-`Date` UTC cadence math to extend, not replace)
- `C:\Development\SOPstart\.planning\PROJECT.md` — v7.0 milestone scope, locked decisions (CSV-only training records, governance-never-blocks-workers north star), build-on list

---
*Stack research for: SafeStart v7.0 Competency & Training Layer*
*Researched: 2026-07-19*
