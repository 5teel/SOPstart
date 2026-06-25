---
phase: 23-ai-field-layer-version-supersede
plan: "06"
subsystem: completions, auth, kiosk
tags: [kiosk, roster, signatures, AFL-VER-05, D-11, D-10, D-09, append-only]
dependency_graph:
  requires: ["23-01"]
  provides: ["roster_worker_id attribution", "recordSignature", "kiosk login route", "supervisor counter-sign"]
  affects: ["src/actions/completions.ts", "src/lib/validators/completions.ts", "src/app/(auth)/login/kiosk", "src/components/auth/RosterSelector.tsx", "src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx"]
tech_stack:
  added: ["/api/roster route (GET, admin client, auth.users email-based display names)"]
  patterns: ["service-role + org-scope self-enforcement (CLAUDE.md 2026-06-15)", "sessionStorage for kiosk attribution (not Supabase session)", "append-only signature chain via createAdminClient"]
key_files:
  created:
    - src/app/(auth)/login/kiosk/page.tsx
    - src/components/auth/RosterSelector.tsx
    - src/app/api/roster/route.ts
  modified:
    - src/lib/validators/completions.ts
    - src/actions/completions.ts
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
    - tests/phase23/completion-roster.spec.ts
    - src/lib/journeys/journeys.ts
decisions:
  - "D-11 kiosk account model: per-org kiosk account (role=worker) established once by admin (RESEARCH Option A); auto-provisioning deferred"
  - "roster_worker_id validated via organisation_members before write (T-23-06-01 cross-tenant guard)"
  - "recordSignature uses createAdminClient + org-scope self-enforcement (CLAUDE.md 2026-06-15 junction-write rule)"
  - "RosterSelector stores roster_worker_id in sessionStorage (NOT Supabase session — kiosk account session unchanged)"
  - "worker_id on sop_completions remains user.id (kiosk account uid — RLS key); roster_worker_id is attribution only (D-11)"
  - "supervisor counter-sign in handleApprove is best-effort non-fatal: signOffCompletion already commits the approval"
  - "Display names derived from auth.users email local-part (no user_profiles table — CLAUDE.md 2026-04-04 pattern)"
  - "Runtime signature insert test marked test.fixme routed to Task 4 UAT on sopstart.com (CLAUDE.md 2026-06-15 T-23-06-07)"
  - "journeys.ts updated with kiosk-login journey for /login/kiosk (CLAUDE.md pathways maintenance)"
metrics:
  duration: "8m"
  completed_date: "2026-06-26"
  tasks_completed: 3
  files_modified: 9
---

# Phase 23 Plan 06: Kiosk Roster Login + Sign-off Chain Summary

Roster name-select kiosk login (D-11), worker self-signature at completion, and supervisor counter-signature (AFL-VER-05/D-10) via append-only `sop_completion_signatures` using the service-role client with self-enforced org-scope. Zero RLS rewrite — the kiosk account is a valid org member.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | submitCompletion roster_worker_id + recordSignature | 4f5ebb1 | completions.ts, validators/completions.ts |
| 2 | Kiosk login route + RosterSelector + /api/roster | 0b6b30c | kiosk/page.tsx, RosterSelector.tsx, api/roster/route.ts |
| 3 | Supervisor counter-sign + spec assertions | 938ebb0 | CompletionDetailClient.tsx, completion-roster.spec.ts |
| — | journeys.ts kiosk-login entry | bad572b | journeys.ts |

## Artifacts

- **`/login/kiosk/page.tsx`** — Server component under `(auth)/`; reads `?org=<orgCode>`; renders RosterSelector. Redirects admin/safety_manager/supervisor away (T-23-06-02 escalation guard).
- **`RosterSelector.tsx`** — Client component; fetches `/api/roster`, renders large glove-friendly name buttons (paper/ink tokens). Stores `roster_worker_id` in `sessionStorage` on selection.
- **`/api/roster/route.ts`** — GET endpoint; admin client fetches `organisation_members` (role=worker); derives display names from `auth.users` email local-part (no user_profiles table).
- **`src/lib/validators/completions.ts`** — `SubmitCompletionSchema` extended with optional `rosterWorkerId`; `RecordSignatureSchema` added (completionId, role, rosterUserId).
- **`src/actions/completions.ts`** — `submitCompletion` validates rosterWorkerId via `organisation_members` (T-23-06-01) before writing `roster_worker_id` (worker_id: user.id unchanged). New `recordSignature` action: `createAdminClient` + org-scope self-check + append-only insert into `sop_completion_signatures`.
- **`CompletionDetailClient.tsx`** — `handleApprove` calls `recordSignature(completionId, 'supervisor', rosterUserId)` as best-effort counter-sign (D-10).

## Test Results

```
13 passed, 1 skipped (fixme)
```

All source-contract assertions for AFL-VER-05 pass live:
- `completions.ts` exports `recordSignature`
- `recordSignature` uses `createAdminClient`
- `submitCompletion` validates org-membership before writing `roster_worker_id`
- `recordSignature` self-enforces org-scope check
- `/login/kiosk/page.tsx` exists and renders `<RosterSelector`
- Migration 00038 contains `roster_worker_id` + `sop_completion_signatures`
- `CompletionDetailClient` calls `recordSignature(` with `role: 'supervisor'`

Runtime signature insert test: `test.fixme` routed to Task 4 UAT on sopstart.com (CLAUDE.md 2026-06-15 T-23-06-07).

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Missing Route] Added `/api/roster` route**
- RosterSelector (Task 2) needed a server endpoint to fetch the org worker roster. No existing endpoint served this.
- Created `src/app/api/roster/route.ts` using admin client + auth.users email-based display names (consistent with `getTeamMembersWithEmails` pattern).
- Commit: `0b6b30c`

**2. [Rule 2 - journeys.ts] Added kiosk-login journey entry**
- CLAUDE.md `## Pathways Map Maintenance` rule: any new route must update `journeys.ts` in the same change. `/login/kiosk` is a new route.
- Commit: `bad572b`

**3. [Decision - supervisor roster id] Best-effort supervisor counter-sign**
- `handleApprove` uses `sessionStorage.getItem(ROSTER_STORAGE_KEY) ?? workerId` for the supervisor's roster identity. On kiosk devices, the supervisor's name would also be stored in sessionStorage; on non-kiosk devices, `workerId` (the supervisor's actual uid) is used as the roster identity.
- This is acceptable because: (a) signOffCompletion already commits the legal approval; (b) the counter-sign failure is non-fatal and logged only; (c) full supervisor roster-select UI is a future UX refinement.

## Known Stubs

- **Runtime signature insert test** — `tests/phase23/completion-roster.spec.ts:296` — `test.fixme` pending Task 4 UAT on sopstart.com. Requires live Supabase instance with migrations 00038 applied.
- **Kiosk account auto-provisioning** — Manual one-time admin setup required per org (RESEARCH Open Question #1). Auto-provisioning is deferred. Documented in `kiosk/page.tsx` and `RosterSelector.tsx` headers.
- **Supervisor name-select on approval** — `handleApprove` uses sessionStorage roster id for supervisor identity. A dedicated supervisor roster-select modal before approval (matching D-11 full intent for supervisors) is deferred.

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`:
- `/login/kiosk` — already in threat model as T-23-06-02 (escalation guard implemented)
- `/api/roster` — returns only org-scoped worker-role members; authenticated session required (401 if no session); org-scope derived from JWT
- `recordSignature` — T-23-06-04 mitigated: createAdminClient + completion.organisation_id check + rosterUserId membership check

## Blocked at Task 4 (checkpoint:human-verify)

Task 4 requires human verification on sopstart.com:
1. One-time kiosk account setup per org
2. Deploy + verify `/login/kiosk?org=<code>` renders roster
3. Complete SOP → verify `roster_worker_id` written; `sop_completion_signatures` worker row exists
4. Supervisor approve → verify `sop_completion_signatures` supervisor row exists
5. RLS isolation: kiosk sees only this org's SOPs; cannot reach admin surfaces

## Operational Note

**Kiosk account setup (one-time admin action per org):**
1. In Supabase Dashboard → Authentication → Users: create `kiosk+{short_org_name}@safestart.internal`
2. Add to `organisation_members`: `user_id = <new uid>`, `organisation_id = <org id>`, `role = 'worker'`
3. Sign the kiosk device into this account and leave it authenticated
4. Navigate to `/login/kiosk` — workers select their name; no password required per session

## Self-Check: PASSED

- `src/app/(auth)/login/kiosk/page.tsx` — FOUND
- `src/components/auth/RosterSelector.tsx` — FOUND
- `src/app/api/roster/route.ts` — FOUND
- `src/actions/completions.ts` contains `recordSignature` — FOUND
- `src/lib/validators/completions.ts` contains `RecordSignatureSchema` — FOUND
- Commits `4f5ebb1`, `0b6b30c`, `938ebb0`, `bad572b` — verified in git log
- 13/14 spec assertions pass (1 fixme for UAT)
- `npx tsc --noEmit` clean
