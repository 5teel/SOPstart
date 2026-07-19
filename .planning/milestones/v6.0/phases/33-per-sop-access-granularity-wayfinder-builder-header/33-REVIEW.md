---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
reviewed: 2026-07-19T04:11:12Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - scripts/assert-phase33-sop-target-schema.ts
  - src/actions/departments.ts
  - src/actions/grants.ts
  - src/actions/sops.ts
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageStepper.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/OrientationStrip.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
  - src/app/(protected)/admin/sops/page.tsx
  - src/app/api/sops/ai-prompt/route.ts
  - src/components/admin/wiring/AccessAnswerPanel.tsx
  - src/components/admin/wiring/SelectionStrip.tsx
  - src/components/admin/wiring/WiringPatchBay.tsx
  - src/components/admin/wiring/WiringPatchBayShell.tsx
  - src/lib/journeys/journeys.ts
  - src/lib/org-model/__tests__/resolve-sop-access.test.ts
  - src/lib/org-model/resolve-sop-access.ts
  - src/lib/uat/tests.ts
  - src/styles/blueprint-theme.css
  - src/types/org-model.ts
  - supabase/migrations/00050_access_grants_sop_target.sql
  - tests/phase30/list-rows.spec.ts
  - tests/phase32/banner-slot-stability.spec.ts
  - tests/phase32/wire-up-mode.spec.ts
  - tests/phase32/wiring-at-scale.spec.ts
  - tests/phase33/plain-language-access.spec.ts
  - tests/phase33/sop-drilldown.spec.ts
  - tests/phase33/sop-grant-materialization.spec.ts
  - tests/phase33/sop-grant-schema.spec.ts
  - tests/phase33/teams-ladder.spec.ts
  - tests/phase33/wayfinder-header.spec.ts
findings:
  critical: 1
  warning: 10
  info: 4
  total: 15
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-07-19T04:11:12Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 33 (per-SOP access granularity + Wayfinder builder header) is structurally sound where it matters most: the SOP-target grant arm self-enforces org scope on every new write path (createGrant sopId guard, revokeGrant org check, assignSopDepartments cross-org guard), the dual-write sweep is complete (the ONLY remaining `sop_departments` insert in `src/` is inside the grant materializer), `member_id` id-spaces are consistent (`auth.users.id` across role_members / sop_access_people / person-grant subject_id), the 00050 XOR constraint + replacement unique index are correct, every referenced CSS token is declared (2026-07-14 class clean), and the phase33 specs are registered and assert wiring rather than token presence.

One Critical survives from an earlier phase in a file this phase touched: `deleteSop` performs service-role cascading deletes with zero org scoping — the exact recurring cross-tenant admin-client class this project has now hit three times. The warnings cluster around: a provably-dead `source_type === 'ai_prompt'` comparison (the DB CHECK makes that value impossible), a one-way `all_departments` ratchet in the override materializer, swallowed errors under replace-write semantics, an unscoped cross-org `member_departments` read, and a `journeys.ts` group typo that silently drops a journey from /pathways.

Pathways-map check (CLAUDE.md trigger #3): no routes were added/removed this phase; `journeys.ts` was updated for the access-map/wayfinder flows — but see WR-07 for a rendering-defeating group mismatch.

## Critical Issues

### CR-01: `deleteSop` — cross-tenant service-role delete, no org scoping on any of six writes

**File:** `src/actions/sops.ts:340-355`
**Issue:** `deleteSop` authenticates via `requireAdminContext()` but never verifies the SOP belongs to the caller's organisation. Every subsequent write uses `createAdminClient()` (bypasses RLS) filtered only on `sop_id`:

```ts
const ctx = await requireAdminContext()
if ('error' in ctx) return ctx
const admin = createAdminClient()
await admin.from('sop_sections').delete().eq('sop_id', sopId)   // no org check
...
const { error } = await admin.from('sops').delete().eq('id', sopId)  // no org check
```

A server action is a directly-invokable POST endpoint: any admin of **any** org can pass an arbitrary `sopId` and permanently destroy another organisation's SOP plus its sections, parse jobs, assignments, video jobs, and notifications. This is the exact class documented in CLAUDE.md [2026-06-15] and [2026-06-26] ("service-role writes MUST self-enforce `row.organisation_id === caller.organisationId` on every path") — and it is reachable from this phase's new ToolsMenu (`DeleteSopButton` in `BuilderStageShell`). Introduced pre-Phase-33 (`fba1f7b`), but the file was modified this phase (`93f571e`) and the hole ships with it.
**Fix:**
```ts
export async function deleteSop(sopId: string): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return ctx
  if (!ctx.organisationId) return { error: 'No organisation' }

  const admin = createAdminClient()
  const { data: sopRow } = await admin.from('sops').select('id, organisation_id').eq('id', sopId).maybeSingle()
  if (!sopRow) return { error: 'SOP not found' }
  if (sopRow.organisation_id !== ctx.organisationId) return { error: 'SOP belongs to another organisation' }
  // ... existing deletes unchanged
}
```
Per rule #5 (fix the scope, not the instance): audit the other admin-client callers in `sops.ts` — `createVideoUploadSession`/`createUploadSession`/`createSopFromWizard` derive org from session (safe); `reparseSop`/`restructureSop` read the SOP via the RLS session client first (safe). `deleteSop` is the only unguarded one in this file.

## Warnings

### WR-01: `source_type === 'ai_prompt'` is dead code — the DB CHECK constraint makes that value impossible

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx:192` (same pattern: `src/lib/governance/publish-core.ts:75`, `src/actions/sop-section-blocks.ts:539`)
**Issue:** Migration 00020 constrains `sops.source_type` to `('uploaded','blank','ai','template')`, and the only AI writer (`api/sops/ai-prompt/route.ts:68`) inserts `source_type: 'ai'`. So `isAiPrompt = ((initialSop as any).source_type ?? rawType) === 'ai_prompt'` is **always false** — no row can ever carry `'ai_prompt'`. The intended AI-draft bypass of the verify gate therefore rides entirely on the `!sourceFilePath` arm — which is also defeated, because the ai-prompt route writes a truthy synthetic path (`source_file_path: 'ai-prompt/${userId}/${Date.now()}'`, route.ts:65). Net effect: for AI-prompt SOPs `showVerifyGate === true` both client-side and in the server publish gate; combined with `hasSourceDoc === false` (no Review stage exists to verify blocks in), any AI SOP whose verify checklist has `totalCount > 0` is an unpublishable dead-end, and the shell's demote-effect (line 331-335) will bounce it off the Publish stage forever. The comment "Source-less / AI-prompt SOPs bypass the verify gate" (line 317) describes behavior the code cannot deliver via the source_type arm.
**Fix:** Compare against the value that actually exists — `source_type === 'ai'` — in all three call sites (BuilderStageShell, publish-core, sop-section-blocks), and repoint `tests/.../publish-gate.integration.test.ts`'s pinned `'ai_prompt'` literals in the same commit (the [2026-07-13] stale-guard class). Alternatively treat the synthetic `ai-prompt/` path prefix as "no real source doc".

### WR-02: Override materializer forces `all_departments=false` but re-follow never restores it — one-way visibility ratchet

**File:** `src/actions/grants.ts:514-517` (with `src/lib/org-model/resolve-sop-access.ts`)
**Issue:** When a SOP gains its first SOP-target grant, `materializeSopAccessForOrg` sets `all_departments = false` (correct — closes the 00035 bypass). But when the **last** SOP-target grant is revoked, the "emergent re-follow" path only rebuilds `sop_departments` from collection grants; `all_departments` stays `false` forever. For a pre-Phase-32 org-wide SOP (`all_departments = true`, collection with no grants — the common state for orgs that never opened the Access map), one wire-up + revoke round trip leaves the SOP with `all_departments=false` AND an empty replace-written `sop_departments` — **invisible to every worker**, silently. The AccessAnswerPanel's promise ("Remove all named people and this SOP follows its collection again") is true only when the collection actually carries grants.
**Fix:** Either snapshot/restore the pre-override `all_departments` value (a column or derive-from-history), or at minimum detect the "re-follow resolves to zero departments AND zero people" outcome in `materializeSopAccessForOrg` and refuse/warn instead of silently writing empty visibility (mirror the CR-02 skip-guard's philosophy for the post-revoke case).

### WR-03: `assignSopDepartments` with `allDepartments=true` is silently vetoed when any other-tier SOP-target grant exists — the code comment claims this can't happen

**File:** `src/actions/departments.ts:539-543`
**Issue:** The comment asserts "setting the flag here first and re-inserting grants after cannot conflict with that rule." It can: the function only deletes **dept-subject** SOP-target grants (line 528-534, by design). If a person/role/org/area-subject SOP-target grant exists (written by the wiring surface), the trailing `materializeSopAccess` sees `sopTargetGrants.length > 0` → overridden → forces `all_departments` back to `false`, silently discarding the admin's explicit `allDepartments=true` choice with a `{ success: true }` return. Given the locked override rule the resulting *state* is arguably correct, but the caller gets no signal that their org-wide choice did not take effect (wizard/AI-route callers surface nothing).
**Fix:** Detect the condition and return it: after the delete, check for remaining non-department SOP-target grants when `allDepartments === true` and return an explanatory error (or a `{ success: true, overriddenBy: 'named-people' }` signal). At minimum correct the comment — it currently documents a false invariant.

### WR-04: `orgScopedDeptIds` swallows query errors — replace-write semantics turn a transient read failure into silent access narrowing

**File:** `src/actions/departments.ts:338-346` (affects `assignMemberDepartments`, `assignBlockDepartments`, `assignSopDepartments`)
**Issue:** `const { data } = await admin.from('departments')...` ignores `error`; on any failure (transient network, malformed UUID in the `.in()` list → Postgres `22P02`) it returns `[]`. Every caller has already executed its destructive delete (junction rows or dept-subject grants) before this read, so a failed read completes as "delete everything, insert nothing, return success". For `assignSopDepartments` that means the admin's picked departments are silently dropped and the SOP falls back to (or off) its collection.
**Fix:**
```ts
const { data, error } = await admin.from('departments').select('id')
  .eq('organisation_id', organisationId).in('id', ids)
if (error) throw new Error(`department scope check failed: ${error.message}`)
```
…and have callers propagate `{ error }` instead of proceeding. (Bonus: validate ids as UUIDs at the boundary so a bad id is a 400, not a wipe.)

### WR-05: ai-prompt route reads `departmentIds`/`allDepartments` from the raw body (no Zod) and ignores the assignment result

**File:** `src/app/api/sops/ai-prompt/route.ts:50-51, 82-84`
**Issue:** `aiPromptSchema` validates `promptText`/`categoryTag`/`detailLevel`, but the department fields bypass it: `const departmentIds: string[] = Array.isArray(body.departmentIds) ? body.departmentIds : []` — elements are unvalidated (non-string/non-UUID values flow into `.in('id', ids)`, feeding WR-04's silent-`[]` path). Then `await assignSopDepartments(...)` discards the result entirely — a failure leaves the SOP with wrong/no department visibility while the route returns success. `createSopFromWizard` at least logs the same failure; this call site doesn't.
**Fix:** Extend `aiPromptSchema` (or a local schema) with `departmentIds: z.array(z.string().uuid()).max(20).default([])`, `allDepartments: z.boolean().default(false)`; check the result and log/propagate the error (`console.error('[ai-prompt] assignSopDepartments failed', ...)` at minimum, matching the wizard).

### WR-06: `member_departments` fetched with zero scoping — cross-org rows shipped to the client on every Access view load

**File:** `src/app/(protected)/admin/sops/page.tsx:186-188`
**Issue:** `member_departments` has a `using(true)` SELECT policy (00035 recursion-avoidance pattern), so `supabase.from('member_departments').select('member_id, department_id')` returns **every organisation's** rows. They're passed as the `deptMembers` prop into the client `WiringPatchBayShell`, i.e. serialized into the RSC payload of another tenant's admin page. The code comment acknowledges this and relies on client-side filtering ("only indexes department ids present in the caller's own tree"). Even accepting the "UUID pairs are non-sensitive" position from the 00031/00046 migrations, this leaks cross-tenant membership cardinality/ids to the browser and scales with the global table, not the org.
**Fix:** Scope the read server-side to the caller's departments — the tree is already fetched in the same `Promise.all`, but a two-step isn't needed: filter by an org-scoped subquery via a `.in('department_id', deptIds)` after `listOrgTree()` resolves (it's already a dependent-read section, mirroring the sop_collections join at line 216), or add an org-scoped SECURITY DEFINER view.

### WR-07: `journeys.ts` — `machine-qr` journey assigned to non-existent group `'Follow a SOP'`, silently dropped from /pathways

**File:** `src/lib/journeys/journeys.ts:304, 40-48`
**Issue:** The `machine-qr` journey declares `group: 'Follow a SOP'`, but `JOURNEY_GROUPS` contains no such entry (`'Getting started' | 'Worker' | ...`). `journeysByGroup()` iterates `JOURNEY_GROUPS` and filters — so this journey never renders on /pathways. Nothing errors; the QR flow just vanishes from the map, defeating the file's single-source-of-truth contract (CLAUDE.md § Pathways Map Maintenance).
**Fix:** `group: 'Worker'` (its persona is Worker), or add `'Follow a SOP'` to `JOURNEY_GROUPS`. Consider typing `group: (typeof JOURNEY_GROUPS)[number]` on the `Journey` interface so the compiler catches this class permanently.

### WR-08: `collectionId` typed `string` but null for every SOP-target grant — type lie in two shared interfaces

**File:** `src/actions/grants.ts:114, 142`; `src/types/org-model.ts:70`
**Issue:** `GrantRow.collectionId: string` and `AccessGrant.collectionId: string`, but after 00050 every SOP-target row has `collection_id = null` (the XOR arm). `listGrants` returns these rows verbatim, and `WiringPatchBay` already defends at runtime (`if (!g.collectionId) continue`) — but the compiler believes the field is always a string, so the next consumer that does `grantsByCollection[g.collectionId]` on a mixed list will bucket every SOP-target grant under the key `"null"`-adjacent `undefined` behavior with zero type error. The doc comment on `AccessGrant.sopId` even describes the XOR while the sibling field's type contradicts it.
**Fix:** `collectionId: string | null` in `GrantRow`, the `listGrants` row cast (grants.ts:142), and `AccessGrant` (org-model.ts) — the existing runtime null-checks then compile as required narrowing rather than dead guards.

### WR-09: Equivalence script's "sop_id stays null" assertion is vacuous — the verify re-read never selects `sop_id`

**File:** `scripts/assert-phase33-sop-target-schema.ts:150-159, 191-193`
**Issue:** `fetchAccessGrants()` selects an explicit column list **without** `sop_id`, and `--verify` reuses it for the post-migration read. Line 193's `(a as ... & { sop_id?: ... }).sop_id ?? null` therefore always evaluates to `null` — the check "pre-existing rows must have sop_id null — 00050 never backfills it" (line 191) passes even if every row had been backfilled with a sop_id. The row-identity comparison for the other columns is real; the sop_id claim is not.
**Fix:** In `--verify`, re-read with `select('..., sop_id')` (the column exists post-push; on `--capture` keep the old list or tolerate the column's absence) so the `sop_id === null` assertion actually inspects the database value.

### WR-10: Multi-collection SOPs — `sopParentCollection` keeps one arbitrary parent, so the "Who can see this?" answer undercounts

**File:** `src/components/admin/wiring/WiringPatchBay.tsx:183-188, 677-702`
**Issue:** 00050's own rationale states "A SOP can live in multiple collections via sop_collections." But `sopParentCollection` is a `Map<string, string>` — for a SOP in N collections, the last-iterated collection wins. Consequences: (a) `panelData` for a non-overridden SOP reports `peopleCount = collectionPeople(thatOneCollection)` — it should be the union across **all** its collections, so the plain-language "N people can see this SOP" headline (the surface's core trust promise, per UAT `blast-radius-trust`) undercounts; (b) "In the {name} collection" may name the wrong parent; (c) `rightEndpoint` anchors wires to the arbitrary parent even when the user is looking at the SOP's row under a different expanded collection.
**Fix:** Make it `Map<string, string[]>`; for the panel, union `collectionPeople` across all parents; for `rightEndpoint`, prefer the expanded parent (fall back to the first). Small diff — the memos already have all inputs.

## Info

### IN-01: Dead `grantCount` prop chain

**File:** `src/components/admin/wiring/SelectionStrip.tsx:28, 35-42`; `WiringPatchBay.tsx:617-622, 910`
**Issue:** `SelectionStrip` declares `grantCount` in its props interface but the destructure omits it and nothing renders it (the 33-09 copy sweep removed the "via N grants" text). Upstream, the `focusGrantCount` memo (WR-05-era logic, ~6 lines) now feeds only this dead prop.
**Fix:** Delete `grantCount` from the interface, the call site, and the `focusGrantCount` memo — or render it if the count is still wanted. Repoint `tests/phase32/wire-up-mode.spec.ts:78-79` (which pins `grantCount={...}`/`focusGrantCount`) in the same commit.

### IN-02: `AccessAnswerPanel` keys lists by title; "One SOP inside is narrower" reads wrong for 2+

**File:** `src/components/admin/wiring/AccessAnswerPanel.tsx:103-108, 121-133`
**Issue:** `key={s.title}` / `key={c.title}` — duplicate SOP/collection names produce React key collisions (real orgs duplicate SOP titles across versions). And with multiple narrower SOPs the panel prints "One SOP inside is narrower: X" per row.
**Fix:** Pass ids through `narrowerSops`/`collections`/`sops` for keys; pluralize the lead-in ("{n} SOPs inside are narrower:" when n > 1).

### IN-03: Unreachable SOP-focus branches in `WiringPatchBay`

**File:** `src/components/admin/wiring/WiringPatchBay.tsx:385, 620`
**Issue:** `focus` can never be a SOP id — every SOP row's `onClick` is `enterWireUp`, never `setFocus`. So `visibleSopEdges`' `e.sopId === focus` filter, `focusGrantCount`'s `sopById.has(focus)` branch, and `focusLabel`'s `sopById.get(focus)` lookup are dead paths (the panel handles the connecting case via `panelTargetId = activeSopId` instead).
**Fix:** Either drop the dead branches, or (better UX) make a plain click on a SOP row focus it and require a second affordance to enter choose-mode — currently there is no way to *inspect* a SOP's wires without entering edit mode.

### IN-04: `callerOrgId` duplicated verbatim in two action files

**File:** `src/actions/grants.ts:61-68`; `src/actions/departments.ts:355-362`
**Issue:** Identical "authoritative org from live membership row" helper copy-pasted (the header comment even says "mirror … verbatim"). Divergence risk on the next auth-idiom sweep (the [2026-07-13] getSessionContext consistency pass had to chase 8 copies of `requireAdmin`).
**Fix:** Move to `src/lib/auth/guards.ts` (beside `requireAdminContext`) and import from both.

---

_Reviewed: 2026-07-19T04:11:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
