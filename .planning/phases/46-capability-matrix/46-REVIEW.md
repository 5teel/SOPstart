---
phase: 46-capability-matrix
reviewed: 2026-08-25T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - CLAUDE.md
  - playwright.config.ts
  - scripts/apply-phase46-migration.mjs
  - src/actions/sections.ts
  - src/actions/sop-section-blocks.ts
  - src/app/api/sops/[sopId]/sections/[sectionId]/route.ts
  - src/lib/auth/guards.ts
  - supabase/migrations/00063_sop_content_owner_edit.sql
  - tests/phase46/capability-matrix-doc.spec.ts
  - tests/phase46/sop-edit-guard-wiring.spec.ts
  - tests/phase46/sop-edit-owner-access.spec.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-08-25
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Threat-model checks T1/T2/T3 pass: migration 00063's owner arm is conjoined INSIDE the org-scope AND of each policy's USING (verified against the original 00003 shapes — nothing dropped in recreation), no WITH CHECK is written (USING is reused as the check), and `requireSopEditAccess` derives org from `getSessionContext()` and filters the admin-client SOP fetch on the SESSION `organisationId`, never on a value read off the fetched row. `guards.ts` carries no `'use server'` directive, and the wiring spec asserts the guard is called inside each function body slice, not merely present in the file.

T4 fails twice. First, the `serviceRole` flag on `addBlockToSection` is a client-reachable full auth bypass — the input schema accepts it from the wire, the branch performs zero auth, and the action's endpoint ID ships in the client bundle. Second, the guard sweep granted owners edit access to "block junctions" (guards.ts A2) but migration 00063 never extended `sop_section_blocks`' admin-only write policy, so 4 of the 9 guarded call sites are dead for the owner persona — two of them returning silent false success (the exact CLAUDE.md 2026-07-20 "RLS silently empties" class), and the live-probe spec has no `sop_section_blocks` or `sop_images` probes to catch it.

## Critical Issues

### CR-01: `serviceRole: true` in `addBlockToSection` input is a network-reachable, unauthenticated, cross-tenant write bypass

**File:** `src/actions/sop-section-blocks.ts:86` (schema), `:104-109` (branch)
**Issue:** `sop-section-blocks.ts` is a `'use server'` module, so every export is a POST-reachable RPC endpoint. `AddBlockToSectionInput` accepts `serviceRole: z.boolean().optional()` from the wire, and the `data.serviceRole` branch does **no auth at all** — no session check, no org check — before switching to `createAdminClient()` (service-role, RLS bypass) and inserting into any `sop_section_blocks` row named by client-supplied UUIDs. `addBlockToSection` is imported by client components (`WizardClient.tsx:9`, `ReuseTier.tsx:5`), so its action ID is present in the shipped client bundle; any anonymous caller who replays it with `{ serviceRole: true, sopSectionId: <victim uuid>, blockId: <uuid> }` writes into another tenant's SOP. This is the recurring 2026-06-15/07-28 service-role class on a new surface (server-action parameter instead of RPC parameter). It predates Phase 46, but the phase's threat model (T4) explicitly targets the service-role paths in this file, and the new wiring spec (`sop-edit-guard-wiring.spec.ts:123-132`) now pins the bypass-before-guard ordering as a contract, cementing the hole.
**Fix:** The trust flag must never arrive over the wire. Extract the write into a non-`'use server'` core module and give the parser its own entry point:
```ts
// src/lib/sop/section-blocks-core.ts (plain module, NOT 'use server')
export async function addBlockToSectionCore(supabase: SupabaseClient, input: CoreInput) { /* current body */ }

// sop-section-blocks.ts ('use server') — serviceRole removed from the Zod schema entirely
export async function addBlockToSection(input) {
  const ctx = await requireSopEditAccess({ sectionId: input.sopSectionId })
  if ('error' in ctx) return { error: ctx.error }
  return addBlockToSectionCore(ctx.supabase, input)
}

// parsed-sop-to-layout-data.ts (server-only pipeline)
await addBlockToSectionCore(createAdminClient(), { ...item, serviceRole: true /* internal shape */ })
```
Then repoint the wiring spec's trust-boundary test (it currently asserts `data.serviceRole` precedes the guard inside the action body) and `parser-creates-junctions.test.ts:114` in the same commit (CLAUDE.md 2026-07-13 repoint rule).

### CR-02: Migration 00063 never extended `sop_section_blocks` RLS — owner block-junction edits are guard-approved but RLS-denied, two of them as silent false success

**File:** `supabase/migrations/00063_sop_content_owner_edit.sql` (missing table) / `src/actions/sop-section-blocks.ts:111, 215, 244, 310`
**Issue:** `guards.ts` A2 defines CAP-02 edit scope as "sections, steps, images, layout_data, **block junctions**", and Plan 46-03 swapped `addBlockToSection`, `removeBlockFromSection`, `setPinMode`, `reorderSectionBlocks` onto `requireSopEditAccess` — all four writing with the **session** client. But 00063 only recreated policies on `sop_sections`, `sop_steps`, `sop_images`. The junction table's only write policy is `ssb_admin_manage_own_org` (00019:273-288), admin/safety_manager-only in both USING and WITH CHECK, and `reorder_sop_section_blocks` is deliberately NOT SECURITY DEFINER (00024:7). For a worker-owner the guard says yes and then:
- `addBlockToSection` — INSERT fails 42501, visible error;
- `setPinMode` — UPDATE matches 0 rows, `.single()` errors;
- `removeBlockFromSection` — DELETE affects 0 rows, **no error, returns `{ success: true }`** while the block remains;
- `reorderSectionBlocks` — RPC runs as caller, UPDATEs 0 rows, **returns `{ success: true }`** with the order unchanged.

This is exactly the CLAUDE.md 2026-07-20 sibling finding ("RLS silently EMPTIES same-org writes a server action legitimately needs — feature dead for the primary persona, works for admins, so admin-run UAT masks it"), and the owner-access spec (WR-02) has no junction probe to surface it. Every phase gate is green because tsc/build/source-contract specs can't see RLS.
**Fix:** New migration extending `ssb_admin_manage_own_org` with the same shape as 00063 — and because this policy DOES carry a WITH CHECK, it must restate **every** predicate in both clauses (CLAUDE.md 2026-08-04 rule 1):
```sql
drop policy if exists "ssb_admin_manage_own_org" on public.sop_section_blocks;
create policy "ssb_admin_manage_own_org"
  on public.sop_section_blocks for all to authenticated
  using (exists (
    select 1 from public.sop_sections sec
    join public.sops sop on sop.id = sec.sop_id
    where sec.id = sop_section_blocks.sop_section_id
      and sop.organisation_id = public.current_organisation_id()
      and (public.current_user_role() in ('admin','safety_manager')
           or sop.owner_user_id = auth.uid())
  ))
  with check ( /* identical predicate — restated in full */ );
```
Append the new file to `MIGRATION_FILES` in `apply-phase46-migration.mjs` (2026-07-28 applier rule), and add owner-positive + non-owner-negative + cross-org junction probes to `sop-edit-owner-access.spec.ts`. Alternatively, if owner junction-edit is deliberately out of scope, the guard swap on these 4 functions must be reverted and A2's comment corrected — the current state is the worst of both: advertised access, silent no-op.

## Warnings

### WR-01: Applier post-apply assertions are substring checks that would print PASS on the exact T1 hole they exist to catch

**File:** `scripts/apply-phase46-migration.mjs:192-212`
**Issue:** The qual assertion only checks that all four tokens (`current_organisation_id`, `current_user_role`, `owner_user_id`, `auth.uid()`) appear somewhere in the deparsed USING. A regressed policy shaped `(org AND role) OR (owner_user_id = auth.uid())` — the top-level-OR cross-tenant hole 00061 fixed — contains all four substrings and passes green. The script's own header cites 2026-07-28 ("an assertion must pin EVERY security-relevant clause"), but token presence does not pin the conjunction structure.
**Fix:** Assert the nesting, not the tokens. Normalize whitespace on `qual` and require the org predicate to be AND-conjoined with the role/owner OR-group inside the EXISTS, e.g. `expect(normalized).toMatch(/organisation_id = current_organisation_id\(\)\) AND \(\(current_user_role\(\).*OR \(.*owner_user_id = auth\.uid\(\)/)` — or pin the entire normalized qual string per policy.

### WR-02: Live-probe spec skips one of the three recreated policies entirely (`sop_images`) and all junction-table writes

**File:** `tests/phase46/sop-edit-owner-access.spec.ts`
**Issue:** The header claims enumeration of "role x own/other x same-org/cross-org" per the 2026-07-20 rule, but `admins_can_manage_images` — recreated by 00063 — has zero probes (no positive owner write, no negative), `sop_steps` has only the positive half, and `sop_section_blocks` (which the guard layer now advertises to owners) has none — which is why CR-02 shipped invisible. One probe set per policy per branch is the stated bar; two of the surfaces changed by this phase don't meet it.
**Fix:** Add: owner-positive + same-org-non-owner-negative probes on `sop_images`; non-owner-negative on `sop_steps`; and the CR-02 junction probes.

### WR-03: PATCH route updates `sop_steps` by raw client-supplied `step.id` with no containment to the authorized section, and ignores per-step errors

**File:** `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts:58-66`
**Issue:** The guard authorizes edit on `sopId`, but the steps loop runs `.update(...).eq('id', step.id)` with no `.eq('section_id', ...)` / no membership check — `step.id` can name a step in a *different* SOP (RLS bounds it to org + admin-or-owned, but the route's own authorization claim is per-SOP, so the guard gives false assurance). The loop also discards every update's error and the route returns `{ success: true }` regardless; a partially-failed or fully-RLS-denied batch reports success. Body is additionally unvalidated (no Zod, contrary to project convention) — `step.text` could be any JSON type.
**Fix:** Fetch the section's step ids first and filter (`.in('id', ownIds)` or `.eq('section_id', sectionId)` per update... note `sop_steps.section_id` is the FK — add `.eq('section_id', sectionId)` to each update), check each `error`, and validate `body` with a Zod schema (`content: z.string().optional(), approved: z.boolean().optional(), steps: z.array({id: uuid, text: string}).optional()`).

### WR-04: Write actions report success on zero-affected-rows — RLS denials and stale ids are indistinguishable from real deletes/reorders

**File:** `src/actions/sop-section-blocks.ts:219-228` (removeBlockFromSection), `:314-323` (reorderSectionBlocks)
**Issue:** The owner-access spec's own header documents that "an RLS-denied UPDATE through PostgREST does not error — it silently affects zero rows," but the action layer doesn't apply the same discipline: `removeBlockFromSection` and `reorderSectionBlocks` return `{ success: true }` whether or not any row changed. Even after CR-02's migration lands, a stale `junctionId` or a future policy regression produces a lying success (CR-02 shows this is live today for owners).
**Fix:** For the delete, chain `.select('id')` and error when the returned array is empty. For the RPC, have `reorder_sop_section_blocks` return the affected row count (`GET DIAGNOSTICS n = ROW_COUNT; return n`) and error when it is less than `array_length(p_ordered_junction_ids, 1)`.

## Info

### IN-01: Stale comments contradicting shipped state

**File:** `tests/phase46/sop-edit-guard-wiring.spec.ts:17-19`; `src/actions/sections.ts:101-103`
**Issue:** The wiring spec header still says "All tests here are `test.fixme`" — they are all live. `sections.ts`'s reorderSections comment still says "defence-in-depth with the explicit admin role check below" — the check is now `requireSopEditAccess`, which is precisely not admin-only.
**Fix:** Update both comments; the second one actively misleads a future RLS auditor about what the defence-in-depth layer enforces.

### IN-02: PATCH route: unhandled `request.json()` and 403 for every guard error

**File:** `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts:13-18`
**Issue:** Malformed JSON throws before any response → unhandled 500. All guard failures (including "Not authenticated") map to 403; 401 would be correct for the unauthenticated case. Low impact — covered functionally by WR-03's validation fix.
**Fix:** Wrap `request.json()` in try/catch → 400; branch 401 on `ctx.error === 'Not authenticated'`.

### IN-03: Management-API fallback applies SQL without recording migration history

**File:** `scripts/apply-phase46-migration.mjs:123-131`
**Issue:** The raw-SQL fallback executes 00063 but does not insert into `supabase_migrations.schema_migrations`, so a later `db push` will re-apply it. Harmless here (drop-if-exists idempotent) and the MIGRATION_FILES ordering discipline from 2026-07-28 is correctly carried — but worth a comment so the next corrective-migration author knows re-application is expected.
**Fix:** One-line comment, or insert the version row after a successful fallback apply.

### IN-04: Capability-matrix doc assertions are weak token-presence checks

**File:** `tests/phase46/capability-matrix-doc.spec.ts:43-49`
**Issue:** `expect(doc).toContain('worker')` etc. match those words anywhere in prose — the role-token test cannot fail on any realistic markdown document, so it certifies almost nothing (2026-06-05 presence-vs-wiring class, low stakes since this guards a doc, not code).
**Fix:** Anchor on table-row shape, e.g. `expect(doc).toMatch(/\|\s*`?worker`?\s*\|/)`.

---

_Reviewed: 2026-08-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
