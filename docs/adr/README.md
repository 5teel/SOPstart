# Architecture Decision Records

Short, numbered records of decisions that shape how SafeStart is built. An accepted ADR is binding:
code, plans and phases follow it until a later ADR supersedes it.

## Rules

1. **Read before you plan or build.** Every `/gsd-plan-phase`, `/gsd-execute-phase` and `/gsd-quick` run reads this index first. A plan or change that contradicts an accepted ADR stops and asks Simon — it does not proceed and does not quietly work around it.
2. **Write one when you decide something structural.** A choice about runtime shape (where work runs, what triggers it), data ownership, security boundaries, external services or infrastructure gets an ADR in the same commit as the change. Phase-local UI and naming choices stay in the phase's CONTEXT.md.
3. **Never edit an accepted ADR's decision.** To change course, write a new ADR with `Supersedes: ADR-NNNN` and set the old one's status to `Superseded by ADR-MMMM`.
4. **Enforce it where you can.** If an ADR can be checked mechanically, add a guard under `tests/lint/` (registered in a Playwright project) and name it in the ADR's `Enforced by` line.
5. Template: `0000-template.md`. Number sequentially; file name `NNNN-kebab-title.md`.

## Index

| # | Title | Status | Enforced by |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | this README · CLAUDE.md § Architecture Decisions |
| [0002](0002-no-scheduled-jobs.md) | No scheduled jobs — work runs when it is needed | Accepted | `tests/lint/no-scheduled-jobs.spec.ts` |
| [0003](0003-site-templates.md) | Site templates are code; a layout records which one it came from | Superseded by ADR-0005 | `tests/phase57/rooms.spec.ts` (retired in ADR-0005) |
| [0004](0004-design-principles.md) | Design principles — attention follows the objectives | Accepted | `tests/lint/design-principles.spec.ts` · `tests/lint/design-tokens.spec.ts` |
| [0005](0005-library-map-replaces-rooms.md) | The library map replaces rooms | Accepted | `tests/lint/no-rooms.spec.ts` |
| [0006](0006-typography.md) | Typography: Inter for reading, Saira for labels | Accepted (caps-label rule superseded by ADR-0007) | `tests/lint/typography.spec.ts` |
| [0007](0007-design-base.md) | The design base — colour for safety, shared controls, sentence-case headings | Accepted (hazard/PPE colours superseded by ADR-0013) | review only |
| [0008](0008-ledger-every-action.md) | Every action a person takes is written to the decision ledger | Accepted | `tests/lint/ledger-every-action.spec.ts` |
| [0009](0009-site-map-pictures.md) | The site map may carry pictures | Accepted | review only |
| [0010](0010-tiered-site-map.md) | A tiered site map, packed by the org's choice | Accepted | `tests/phase63/site-tiers.spec.ts` |
| [0011](0011-desktop-home-map-centre.md) | Desktop home: map centre, list right, Read folds both | Accepted | `tests/evals/home.eval.ts` HOME-03 |
| [0012](0012-read-and-run-one-view.md) | Reading and doing a SOP are one view; the start merge marks the first record | Accepted | `tests/evals/start.eval.ts`, `tests/phase63/fuse-wiring.spec.ts` |
| [0013](0013-safety-sign-colours.md) | Step kinds wear the AS 1319 safety sign colours and shapes | Accepted | `tests/lint/design-tokens.spec.ts` |
| [0014](0014-site-map-colours.md) | The site map stays off the safety sign colours | Accepted | `tests/lint/design-tokens.spec.ts` · `tests/phase57/departments.spec.ts` |
| [0015](0015-direct-and-clear-versions.md) | Every SOP has a direct translation (the record) and a clear version workers see once an admin approves it | Accepted | `tests/evals/clear-version.eval.ts` |
| [0016](0016-lists-delineated-and-stepped.md) | Lists are framed rows; long lists are stepped into (areas or types, then SOPs) | Accepted | `tests/phase63/sop-list.spec.ts`, `tests/evals/home.eval.ts` HOME-02 |
| [0017](0017-hosting-sydney.md) | The app is hosted on Fly.io in Sydney, next to the Supabase database | Accepted | `fly.toml`, `.github/workflows/fly-deploy.yml` |
| [0018](0018-new-accounts-need-approval.md) | Every new account waits for a SOPstart admin's approval (access-token gate) | Accepted | `supabase/migrations/00081_user_approval.sql`, `src/actions/user-approval.ts` |
| [0019](0019-training-lanes.md) | Training is shown as lanes, not a matrix of pills | Accepted | `tests/phase63/training-lanes.spec.ts` · `tests/evals/home.eval.ts` HOME-04 |
| [0020](0020-people-chart.md) | People opens on one org chart that collapses and answers every People question | Accepted | `tests/phase63/org-chart.spec.ts` · `tests/evals/office.eval.ts` |
| [0021](0021-job-roles-on-the-chart.md) | Job roles are edited on the People chart | Accepted | `tests/phase63/job-roles.spec.ts` · `tests/evals/office.eval.ts` |
| [0022](0022-jev-checks-the-clear-version.md) | Jev checks the clear version first; the LLM check settles its flags | Accepted | `tests/lint/jev-one-door.spec.ts` · `tests/evals/clear-version.eval.ts` |
