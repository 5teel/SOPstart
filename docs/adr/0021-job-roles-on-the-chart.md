# ADR-0021: Job roles are edited on the People chart

- **Status:** Accepted
- **Date:** 2026-10-16
- **Decided by:** Simon ("yes build the add a role action")
- **Supersedes:** ADR-0020 rule 4 in part (the chart is no longer read-only for job roles; every other write still lives elsewhere)
- **Enforced by:** `tests/phase63/job-roles.spec.ts`, `tests/phase63/org-chart.spec.ts`, `tests/lint/ledger-every-action.spec.ts`, `tests/evals/office.eval.ts` (the job roles case)

## Context
The People chart shows each department's job roles with filled-of-planned seats, but Phase 59 deleted the only role write actions, so no role could be added, renamed, resized or filled. An empty seat could only invite a new person.

## Decision
1. Four actions in `src/actions/org-model.ts`: `createRole`, `updateRole` (name, seats), `removeRole`, `setRoleSeat` (seat or take out one person). Admin and safety manager (`requireAdminContext`), the organisation from the session on every write, zero rows is a failure, every change logged as `department_change` with the action in the details (ADR-0008).
2. A job role is not the access level and never changes `organisation_members.role` or department membership.
3. Removing a role or a seat re-materialises SOP access (role-subject grants follow role membership).
4. On the chart: "+ Add a role" (name, seats) inside an open department; Edit on a role (rename, seats, Take out, Remove role on a second click that says how many people leave it); an empty seat seats someone from the department or offers "Invite someone new".

## Consequences
- Seats can be filled from the chart; vacancies are real again.
- Removing a role cannot be undone; the second click names the people it affects.

## How to comply
- Change roles only through these four actions; never write `roles` or `role_members` from elsewhere.
