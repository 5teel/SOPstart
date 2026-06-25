---
status: issues_found
phase: 23-ai-field-layer-version-supersede
depth: standard
reviewed: 2026-06-26
reviewer: gsd-code-reviewer
files_reviewed: 23
critical: 4
warning: 9
info: 7
---

# Phase 23: Code Review Report

Phase 23 ships the AI field layer (registry, tiered approval gate, read/write API routes), version-supersede/clone/restore flows, kiosk roster login (D-11), and the `sop_completion_signatures` append-only chain. Overall security architecture is sound — the `gateWrite` A6 fail-safe defaults to high-stake, admin-client org-scoping is mostly self-enforced, and `cloneSopAsDraft` correctly avoids setting `superseded_by` on the source. Several concrete defects span security, correctness, and maintainability.

## Finding Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| Warning | 9 |
| Info | 7 |
| **Total** | **20** |

## Critical

### CR-01: `applyAiWrite` trusts client-supplied `sopIsPublished` — A6 fail-safe only protects the route path, not direct server-action calls
**File:** `src/actions/ai-fields.ts:48-63`, `src/app/api/ai-fields/write/route.ts:91-114`
`applyAiWrite` is a server action reachable directly from the client. It re-validates the JWT org claim but blindly trusts the `sopIsPublished` value arriving in `context`. The write route resolves `sopIsPublished` from the DB, but a direct action invocation can pass `sopIsPublished:false` to force the low-stake auto-apply path on any `stakeLevel:'low'` field regardless of actual SOP status. The action is the security boundary; the route's enrichment is only an optimisation.
**Fix:** `applyAiWrite` must independently look up `sop.status` when `context.sopId` is present and derive `sopIsPublished` itself, never trusting the supplied value.

### CR-02: `atob` used to decode Base64URL JWT payload across 10+ server callsites — crashes on any non-ASCII claim
**Files:** `src/actions/ai-fields.ts` (×3), `src/actions/completions.ts` (×3), `src/actions/versioning.ts` (×3), `src/actions/sops.ts`, `src/app/api/ai-fields/read/route.ts`, `src/app/api/roster/route.ts`, `src/app/(auth)/login/kiosk/page.tsx`
The pattern `JSON.parse(atob(token.split('.')[1]))` decodes standard Base64, but JWT payloads are Base64URL (`-`/`_`, no padding). Supabase JWTs usually work because payloads are ASCII, but any claim requiring `+`/`/` in Base64 throws `InvalidCharacterError`, crashing the action for that user. Systemic (rule #5).
**Fix:** Extract a `parseJwtPayload` helper to `src/lib/supabase/jwt.ts` that converts Base64URL→Base64 before `atob`, and import it at every callsite.

### CR-03: Roster `listUsers({ perPage: 1000 })` fetches only the first page — silently drops workers in large deployments + over-fetches all orgs
**File:** `src/app/api/roster/route.ts:65`
`listUsers` is paginated; `perPage:1000` returns one page only. With >1000 auth users project-wide, workers beyond the 1000th never appear on the kiosk roster, so their completions submit without `roster_worker_id` (lost attribution). The call also fetches every auth user across all orgs and filters client-side (data minimisation concern).
**Fix:** Paginate until `total` reached, or join via `organisation_members` to fetch only org members.

### CR-04: `signOffCompletion` status update not org-scoped for `safety_manager` — cross-org completion status mutation
**File:** `src/actions/completions.ts:163-212`
The org-scope check only runs inside the `role === 'supervisor'` branch. A `safety_manager` (which skips that branch) can sign off a completion from another org: the admin-client fetch returns any completion by id, the `!completion` guard passes, and the status update filters only on `.eq('id', completionId)`. Matches the CLAUDE.md 2026-06-15 cross-tenant-write learning.
**Fix:** Add an explicit `completion.organisation_id !== organisationId` guard immediately after fetch (before the role branch), and add `.eq('organisation_id', organisationId)` to the update.

## Warnings

### WR-01: `FieldDescriptor.write()` has no enforced auth contract for high-stake fields
`write()` fires only from `acceptProposal` for high-stake fields; future descriptor authors could omit auth checks relying on the gate. Add JSDoc stating `write()` implementations MUST include their own auth/org checks. (`src/lib/ai-fields/registrations/index.ts`)

### WR-02: `cloneSopAsDraft` section ID map matched by `sort_order` — silent corruption when two sections share a `sort_order`
No UNIQUE constraint on `(sop_id, sort_order)`; duplicate `sort_order` makes `find` map two old sections to one new section, mis-assigning steps/blocks. **Fix:** match by array index (both lists ordered `sort_order ASC`, RETURNING preserves insert order). (`src/actions/versioning.ts:405-409`)

### WR-03: `cloneSopAsDraft` step ID map matched by `(section_id, step_number)` — same silent-corruption pattern as WR-02
Images re-point to the wrong new step when `step_number` repeats within a section. **Fix:** index-based match within each section group. (`src/actions/versioning.ts:447-454`)

### WR-04: `acceptProposal` reconstructs `fieldContext` without `sopIsPublished`
Stored proposal context includes `sopIsPublished` but it's dropped on accept; latent risk if a future `write()` branches on it. **Fix:** include `sopIsPublished` in the reconstructed context. (`src/actions/ai-fields.ts:173-183`)

### WR-05: `CompletionDetailClient` falls back to `workerId` as the supervisor roster id — corrupts the sign-off chain on non-kiosk devices
When `sessionStorage` is empty, `supervisorRosterId = ... ?? workerId` records the supervisor signature with the WORKER's uid. **Fix:** pass the supervisor's own `user.id` from the server component as the fallback. (`CompletionDetailClient.tsx:108`)

### WR-06: `rejectProposal` does not detect 0-rows-updated — false success on phantom/already-resolved ids
**Fix:** `.select('id')` after update; return not-found when empty. (`src/actions/ai-fields.ts:244-252`)

### WR-07: `uploadNewVersion` derives org from the SOP row, not the JWT — inconsistent with `cloneSopAsDraft`'s explicit JWT check
**Fix:** extract JWT org and assert `oldSop.organisation_id === jwtOrgId` before use. (`src/actions/versioning.ts:33-43`)

### WR-08: Version diff page aligns sections by array index — false-positive diffs when sections are reordered/removed
**Fix:** align by `sort_order` or `title` with index fallback. (`versions/diff/page.tsx:67-72`)

### WR-09: `kiosk/page.tsx` / roster route accept an `org` query param that the server ignores — dead param could mislead into a future cross-org leak
**Fix:** document as display-only or remove from both. (`login/kiosk/page.tsx`, `api/roster/route.ts`)

## Info

- **IN-01:** JWT `atob` decoding duplicated 10+ sites — extract shared util (pairs with CR-02).
- **IN-02:** `sop_completion_signatures` lacks UNIQUE `(completion_id, role)` — duplicate signatures insertable; add index + treat 23505 as idempotent success.
- **IN-03:** `gateWrite` stores `sopIsPublished` in proposal JSONB but accept never reads it (pairs with WR-04).
- **IN-04:** "Updated" badge never shows for never-completed SOPs — intentional per D-09, flag for UAT.
- **IN-05:** diff page passes raw search-param ids without UUID validation; error text surfaced to admin UI.
- **IN-06:** `sop.section.title` read relies on RLS alone, inconsistent with sibling's explicit org filter.
- **IN-07:** `cloneSopAsDraft` cleanup `.delete()` by PK only — add explicit org filter for defensive consistency.

_Reviewed: 2026-06-26 · Depth: standard_
