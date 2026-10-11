# ADR-0008: Every action a person takes is written to the decision ledger

- **Status:** Accepted
- **Date:** 2026-10-11
- **Decided by:** Simon ("all actions should be logged in the decision ledger")
- **Enforced by:** `tests/lint/ledger-every-action.spec.ts`

## Context
The ledger (`decisions`, Phase 56) recorded approvals, sign-offs, publishing, role changes, requests and objectives, but about forty other writes left no trace: supervisor links, departments, SOP access, SOP authoring, standards, the site map and settings. An auditor could not answer "who changed this, and when" for most of the app.

## Decision
1. Every `src/actions/*` export and API route handler that changes data calls `recordDecision()` after the write succeeds. Organisation and person come from the session, as before.
2. New kinds (migration `00076_ledger_every_action.sql`): `supervisor_linked`, `supervisor_unlinked`, `department_change`, `access_change`, `sop_created`, `sop_edited`, `sop_deleted`, `sop_version`, `standard_change`, `site_change`, `settings_change`. The ledger filter gains SOP changes, People and Site & settings groups.
3. **Autosaved edits coalesce:** `recordDecision(input, { coalesceMinutes: 10 })` writes one row per person, kind and subject per ten minutes, so typing in the editor is one "Edited a SOP" row, not one per keystroke.
4. **Not logged, deliberately:** pure reads; minting an upload URL (the attach that follows is logged); progress through a SOP before it is sent (the sent completion is logged as `sign_off`); marking a notification read; UAT feedback (about the app, not the site); joining a site with an invite or join code (the session has no organisation yet, and the invite is logged as `member_invited`); access rows recomputed from a logged change; the AI parse pipeline's own writes (the person's create, re-read or rebuild is logged); a call that changes nothing (a double-click, an existing link).

## Consequences
- Easier: every change has a who and a when in one place, with one filter UI.
- Harder: a new action is not done until it logs; the lint guard fails a write-bearing export without `recordDecision(` unless it is on the guard's exclusion list with a reason.
- The ledger grows faster; coalescing keeps the editor from flooding it.

## How to comply
```ts
const rec = await recordDecision({ kind: 'department_change', subject: { kind: 'department', id }, summary: 'Renamed a department', details: { name } })
return { success: true, logged: rec.ok }
```
Summaries are plain words from literals; free text (titles, names) goes in `details`.
