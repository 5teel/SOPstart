---
phase: 43-dead-surface-removal-route-truth
reviewed: 2026-09-30T12:58:13Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - next.config.ts
  - playwright.config.ts
  - src/actions/blocks.ts
  - src/app/(protected)/admin/blocks/new/NewBlockForm.tsx
  - src/app/(protected)/admin/blocks/new/page.tsx
  - src/app/(protected)/admin/blocks/page.tsx
  - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
  - src/app/(protected)/admin/sops/new/blank/page.tsx
  - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
  - src/components/admin/PhotoScanner.tsx
  - src/components/admin/UploadDropzone.tsx
  - src/components/admin/wiring/WiringPatchBay.tsx
  - src/lib/blocks/block-kinds.ts
  - src/lib/blocks/create-block-core.ts
  - src/lib/journeys/journeys.ts
  - src/lib/parsers/__tests__/parser-creates-junctions.test.ts
  - src/lib/parsers/parsed-sop-to-layout-data.ts
  - supabase/migrations/00068_blocks_read_own_org.sql
  - tests/evals/dead-surface.eval.ts
  - tests/integration/scp-parse-pipeline.test.ts
  - tests/lint/no-dead-internal-hrefs.spec.ts
  - tests/phase28/governance-queue.spec.ts
  - tests/phase29/approval-chain-editor.spec.ts
  - tests/phase30/admin-nav.spec.ts
  - tests/phase30/create-entry.spec.ts
  - tests/phase30/governance-fold.spec.ts
  - tests/phase41/merged-surface.spec.ts
  - tests/phase41/nav-and-shim.spec.ts
  - tests/phase41/reference-sweep.spec.ts
  - tests/phase41/spec-repoint-inventory.spec.ts
  - tests/phase43/dead-controls.spec.ts
  - tests/phase43/new-block.spec.ts
  - tests/phase43/route-truth.spec.ts
  - tests/phase54/deletion-sweep.spec.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-09-30T12:58:13Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Reviewed the Phase 43 diff (`ef442176..HEAD`) against the four questions posed by the orchestrator, plus the security classes listed in CLAUDE.md `## Learnings`. Ran `phase43`, `phase15-stubs` (dead-href + RLS lints), `phase28/29/30/41/54`, `phase21-stubs` and the `parser-creates-junctions` unit project locally: all green (16 + 9 + 356 + 8 + 30 passed).

**Q1 — trust boundary into `insertBlockWithVersion` / `createBlockAsService`.** Clean. `createBlock` (`src/actions/blocks.ts:101-109`) runs `requireAdminContext()` unconditionally and passes only `ctx.organisationId` / `ctx.user.id`; the `serviceRole` wire field is gone from the action's input schema. `createBlockAsService` has exactly one importer (`parsed-sop-to-layout-data.ts:43`), reached through `materializeJunctionsForLayout`, whose five callers (`api/sops/{parse,ai-prompt,restructure,transcribe,youtube}/route.ts`) all take `organisationId` from `getSessionContext()`, never from the request body. No client component imports the core module. The remaining gap is that nothing *mechanically* prevents a future client import (WR-01).

**Q2 — `next.config.ts` redirects.** No open redirect: both destinations are fixed same-origin strings, `source` patterns are exact (`/admin/sops` does not swallow `/admin/sops/new`, `/admin/sops/builder/...`, `/admin/sops/[sopId]/versions`). Next evaluates `redirects()` before the proxy, so an unauthenticated hit now learns the destination path (the Phase 41 T-41-03b "never learns the destination shape" property is dropped — acknowledged in the config comment, and correct: `/governance` runs `requireAdminContext()` → `redirect('/dashboard')`, `/sops` is behind the proxy's claims check, and `/sops?view=attention` is carried on to `/governance` by `middleware.ts`). Query-string forwarding is now unfiltered where the old shim allow-listed seven params; none of the legacy params are sensitive, so no finding.

**Q3 — migration 00068.** The new policy is SELECT-only, `to authenticated`, a single org conjunct, no OR arm. It does not widen anything: `block_versions_read_via_blocks` (00019) still carries an `organisation_id is null` arm but only inside an EXISTS on `blocks`, which 00068 now gates to the caller's org. Two adjacent problems surfaced while tracing the policy set, neither introduced by this phase but both material to the "restored missing policy" story: three platform-admin write policies that migration 00037 *intended* to drop are still live because the drop used the pre-00026 names (WR-03), and the migration's stated root cause ("every existing app read goes through the admin client") is false — `listBlocks`, `getBlock`, `countFollowLatestUsages` all use the session client, so `/admin/blocks` and `/admin/blocks/[blockId]` had been reading empty since 00037 (WR-04).

**Q4 — repointed specs.** The three new `tests/phase43` specs are wiring-level (positional guard-before-insert, `PhotoScanner` importer count = 1, `onSubmit → validateAndAddFiles` regex, `seedBlockContent` round-trips through `BlockContentSchema`). The repo-wide dead-href lint is real (its non-vacuous test pins ≥250 targets / ≥60 shapes). The weakness is in the *repointed* legacy specs: six of them now assert `source: '/admin/sops',` and `destination: '/sops',` as two independent substrings of `next.config.ts`, which does not prove they belong to the same redirect entry (WR-05).

## Warnings

### WR-01: `create-block-core.ts` claims to be server-only but has no `server-only` guard

**File:** `src/lib/blocks/create-block-core.ts:1-31`
**Issue:** The module header says "Server-only parser entry point … reachable only by importing this module from server code", and it imports `createAdminClient` (service-role key). Nothing enforces that. The repo already uses the Next idiom for exactly this (`src/lib/journeys/routes.ts:1: import 'server-only'`), but neither this file nor its sibling `src/lib/builder/section-blocks-core.ts` does. `CreateBlockInput` is a tempting import for a future client form wanting client-side validation; that one import would drag `createAdminClient` into a client bundle. `new-block.spec.ts` guards only `NewBlockForm.tsx` (single `@/actions/` import), not the module itself.
**Fix:**
```ts
// src/lib/blocks/create-block-core.ts (and section-blocks-core.ts), first line
import 'server-only'
```
and add to `tests/phase43/new-block.spec.ts`: `expect(coreSrc).toMatch(/^import 'server-only'/m)`. If a client ever needs the input schema, move `CreateBlockInput` into `block-kinds.ts` (already client-safe) rather than importing the core.

### WR-02: PhotoScanner relabels every captured page as `image/jpeg`, defeating the intake HEIC conversion and type check

**File:** `src/components/admin/PhotoScanner.tsx:264-266` (wired live by `src/components/admin/UploadDropzone.tsx:709-717`)
**Issue:** `handleSubmit` builds `new File([page.blob], \`scanned-page-${i + 1}.jpg\`, { type: 'image/jpeg' })` regardless of `page.blob.type` (which was preserved from the camera file at `PhotoScanner.tsx:155`). `validateIntakeFile` (`src/lib/upload/file-intake.ts:119-175`) trusts `file.type`/extension: `isHeicFile()` decides whether to run `convertHeicToJpeg`, and the accept check tests `workingFile.type`. A HEIC/PNG/WebP capture (desktop browsers ignore `capture="environment"` and open a file picker; some Android OEM cameras emit non-JPEG) is therefore relabelled as JPEG, skips conversion, passes intake, and reaches the server as `.jpg` with non-JPEG bytes — the OCR/parse job fails with an opaque error instead of the friendly "Failed to convert" message. This code pre-dates the phase, but D-04 is what made the scanner reachable for the first time (the previous button opened "Scanner coming soon"), so the behaviour ships now.
**Fix:**
```ts
const EXT: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }
const files = pages.map((page, i) => {
  const type = page.blob.type || 'image/jpeg'
  return new File([page.blob], `scanned-page-${i + 1}.${EXT[type] ?? 'jpg'}`, { type })
})
```

### WR-03: Migration 00037 dropped policies by their pre-rename names — three platform-admin write policies on `blocks` / `block_versions` are still live, and the RLS lint cannot see them

**File:** `supabase/migrations/00068_blocks_read_own_org.sql:30-35` (context: `00026_rename_summit_to_platform.sql:45-55`, `00037_departments_rls_cleanup.sql:33-35`)
**Issue:** 00068 states "global/null-org blocks are retired per Phase 25 D-01 — no OR arm needed". That is true for SELECT, but the write side still has holes the phase's own reasoning assumes closed. 00026 renamed `blocks_summit_admin_global_write` → `blocks_platform_admin_global_write`, `blocks_summit_admin_global_update` → `blocks_platform_admin_global_update`, `block_versions_summit_admin_global_insert` → `block_versions_platform_admin_global_insert`. 00037 then ran `drop policy if exists "blocks_summit_admin_global_write" …` (old names) — silent no-ops. No later migration drops the new names, so anyone in `platform_admins` can still INSERT/UPDATE `organisation_id IS NULL` rows in `blocks` and INSERT their `block_versions` through PostgREST. Exposure is bounded (null-org rows are unreadable after 00068; it is an orphan-write, not a cross-tenant read) but it is exactly the "policy that looked dropped" class. `tests/lint/rls-org-scope.spec.ts` tracks creates and drops by name and does not follow `alter policy … rename`, so its model of the live set has believed these were gone since 00037 — the lint is vacuous on this table for the same reason the DB is wrong.
**Fix:**
```sql
-- 00069_drop_platform_admin_block_policies.sql
drop policy if exists "blocks_platform_admin_global_write"          on public.blocks;
drop policy if exists "blocks_platform_admin_global_update"         on public.blocks;
drop policy if exists "block_versions_platform_admin_global_insert" on public.block_versions;
```
Verify live with `select policyname from pg_policies where tablename in ('blocks','block_versions')`, and teach `rls-org-scope.spec.ts` to apply `alter policy "a" on t rename to "b"` to its map (re-key `t::a` → `t::b`) so the next renamed-then-"dropped" policy is caught.

### WR-04: 00068's root-cause narrative is wrong, and the phase adds no session-client proof for `blocks` reads

**File:** `supabase/migrations/00068_blocks_read_own_org.sql:20-28`; `src/actions/blocks.ts:271, 360, 437`
**Issue:** The migration (and `43-EVAL.md`) say the gap "went undetected because every existing app read of `blocks` … goes through the admin/service-role client". `listBlocks` (`blocks.ts:271`), `getBlock` (`:360`) and `countFollowLatestUsages` (`:437`) all call `createClient()` from `@/lib/supabase/server` — the cookie session client. So since 00037 the Content Library (`/admin/blocks`) rendered zero rows and `/admin/blocks/[blockId]` returned `null` for every session caller; the eval's `createBlock` 42501 was the first *assertion* on the path, not the first *use*. The fix is right; the explanation leads the next reader to believe the session read path was never exercised, and — more importantly — the only thing now proving `blocks` is readable/insertable through RLS is the deployed eval. There is no live probe in the suite (the `tests/phase51/site-model-rls-runtime.spec.ts` pattern) for `blocks` positive (in-org admin SELECT/INSERT … RETURNING) and negative (cross-org SELECT returns 0) cases.
**Fix:** Correct the comment to name the real reason (the pages rendered empty and nobody had a hand-authored block to miss), and add a live probe spec asserting: in-org admin `insert … select('*').single()` succeeds; in-org worker `select` returns own-org rows only; cross-org session `select` returns 0 rows.

### WR-05: Six repointed specs assert the redirect entry as two unrelated substrings

**Files:** `tests/phase28/governance-queue.spec.ts:73-77, 96-101`; `tests/phase30/governance-fold.spec.ts:68-71`; `tests/phase41/merged-surface.spec.ts:205-210`; `tests/phase41/nav-and-shim.spec.ts:41-45`; `tests/phase41/reference-sweep.spec.ts:98-102`; `tests/phase43/route-truth.spec.ts:86-93`
**Issue:** Each asserts `toContain("source: '/admin/sops',")` and, separately, `toContain("destination: '/sops',")` (same for `/admin/governance` → `/governance`). Those are satisfied by *any* two entries in the file — e.g. `{ source: '/admin/sops', destination: '/somewhere-else' }` plus an unrelated `{ source: '/x', destination: '/sops' }` still passes all six. The pre-phase shim specs were positional (guard index < redirect index); the replacements are token-presence, the CLAUDE.md 2026-06-05 class. The same check is also copy-pasted six times, so a future change has six places to drift.
**Fix:** Bind source and destination in one match, once, in `route-truth.spec.ts`, and have the five legacy specs assert only what is theirs (that they no longer read the deleted page):
```ts
const cfg = stripComments(read('next.config.ts'))
expect(cfg).toMatch(/source:\s*'\/admin\/sops',\s*destination:\s*'\/sops',\s*permanent:\s*false/)
expect(cfg).toMatch(/source:\s*'\/admin\/governance',\s*destination:\s*'\/governance',\s*permanent:\s*false/)
```

## Info

### IN-01: `insertBlockWithVersion` ignores the rollback result and has no transaction

**File:** `src/lib/blocks/create-block-core.ts:117-131`
**Issue:** On `block_versions` insert failure the compensating `delete` is fire-and-forget (its error is dropped), and a failure at the `current_version_id` update leaves a block + version with `current_version_id = null` (the `blocks_current_version_fk` is deferrable, so a single RPC would make this atomic). Pre-existing, moved verbatim.
**Fix:** Log the delete error, or wrap the three writes in a `create_block_with_version` plpgsql RPC and call it from both entry points.

### IN-02: `categoryTags` are not validated against `block_categories`

**File:** `src/lib/blocks/create-block-core.ts:39`; `src/app/(protected)/admin/blocks/new/NewBlockForm.tsx:63`
**Issue:** `CreateBlockInput.categoryTags` is `z.array(z.string())`; migration 00022 says the check happens "in the server-action layer via Zod against listBlockCategories()" — it does not. The new form only offers real slugs, but the action accepts any string. Pre-existing schema; the form is the first direct UI feeding it.
**Fix:** In `createBlock`, filter `categoryTags` to slugs returned by `listBlockCategories()` (or reject unknowns).

### IN-03: "New block" button opens a page titled "New content"

**File:** `src/app/(protected)/admin/blocks/page.tsx:88`; `src/app/(protected)/admin/blocks/new/page.tsx:11, 35`; `src/lib/journeys/journeys.ts:551`
**Issue:** The library CTA says "New block", the destination `<h1>`/metadata and the journeys step say "New content". Simon's standing instruction is that "block" is builder-internal jargon not to be shown to users. The eval (`dead-surface.eval.ts:66`) is keyed on the "New block" label, so renaming needs the eval updated in the same commit.
**Fix:** Rename the link text to "New content" and update the eval's `getByRole('link', { name: 'New content' })`.

### IN-04: `writer: any` erases the Supabase client type at the trust seam

**File:** `src/lib/blocks/create-block-core.ts:66`
**Issue:** The one parameter that decides whether RLS applies is untyped, so a caller can pass anything (the sibling `section-blocks-core.ts` has the same shape). Pre-existing eslint-disable pattern.
**Fix:** `writer: SupabaseClient<Database>` (both the session and admin clients satisfy it).

---

_Reviewed: 2026-09-30T12:58:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
