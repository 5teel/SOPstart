# Phase 46: Capability Matrix - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 9 (1 doc, 1 guard, 4 action/route edits, 3 test files) + 1 config edit
**Analogs found:** 9 / 9

RESEARCH.md already pins exact target code (new guard body, RLS SQL diff, call-site list) with HIGH confidence — this map points each target file at its closest existing sibling so the planner can diff against real precedent instead of RESEARCH's proposed snippets alone.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/auth/guards.ts` (add `requireSopEditAccess`) | middleware/guard | request-response | same file, `requireAdminContext()` (lines 19-26) | exact — extend in place |
| `src/actions/sections.ts` (swap guard in 4 fns) | service (server action) | CRUD | same file's existing `requireAdminContext()` call sites | exact |
| `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` (add guard) | route (API) | request-response | `src/app/api/sops/[sopId]/publish/route.ts` (admin-gated PATCH pattern) | role-match |
| `src/actions/sop-section-blocks.ts` (swap `requireAdmin()`→guard) | service (server action) | CRUD | same file's existing `requireAdmin()`→`requireAdminContext()` call sites | exact |
| new RLS migration (extend 3 policies) | migration | CRUD (RLS) | `supabase/migrations/00062_*` and `00061_*` (owner-OR-role-inside-org-AND fix precedent) | exact |
| `.planning/codebase/CAPABILITY-MATRIX.md` | config/doc | — | none (new doc type) — structure borrowed from `.planning/codebase/CONVENTIONS.md` table style | no analog, new artifact |
| `tests/phase46/capability-matrix-doc.spec.ts` | test | source-contract | `tests/lint/rls-org-scope.spec.ts` (parses files, asserts required content present) | role-match |
| `tests/phase46/sop-edit-owner-access.spec.ts` | test | live-Supabase probe | `tests/phase34/observation-read-role-scope.spec.ts` (ephemeral org/member fixture + positive/negative probes) | exact |
| `tests/phase46/sop-edit-guard-wiring.spec.ts` | test | source-contract (grep) | `tests/builder/builder-review-flow.spec.ts` style guard-wiring grep (per 2026-07-13 relocation learning) — or simpler: `tests/lint/rls-org-scope.spec.ts` grep shape | role-match |
| `playwright.config.ts` (register `phase46` project) | config | — | existing `phase34`/`phase37`/`phase40` project entries in same file | exact |

## Pattern Assignments

### `src/lib/auth/guards.ts` — add `requireSopEditAccess(sopId)`

**Analog:** same file, `requireAdminContext()` (lines 1-26, full file)

**Full existing pattern to extend from:**
```typescript
import { getSessionContext } from './session-context'
import type { SessionContext } from './session-context'

export interface AdminContext {
  supabase: SessionContext['supabase']
  user: { id: string }
  role: string
  organisationId: string | null
}

export async function requireAdminContext(): Promise<AdminContext | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  return { supabase, user: { id: userId }, role, organisationId }
}
```

**Add alongside it** (RESEARCH.md's full proposed body is correct and directly consistent with this file's existing style — same return shape `{ ... } | { error: string }`, same `getSessionContext()` destructure). Key deltas from `requireAdminContext()`:
- Takes a `sopId: string` param (object-level check, not just role-level — ASVS V4).
- Falls through to an admin-client (`createAdminClient()`) fetch of `sops` filtered by `.eq('id', sopId).eq('organisation_id', organisationId)` — organisationId sourced from session, never from the fetched row (2026-06-15/26 pattern).
- Returns success if `sop.owner_user_id === userId`.

Import `createAdminClient` the same way `src/actions/versioning.ts` / `src/actions/governance.ts` do (check their import line for the exact path, e.g. `@/lib/supabase/admin`).

---

### `src/actions/sections.ts` — swap 4 call sites

**Analog:** same file's own `requireAdminContext()` usages (verified present at `reorderSections`, `updateSectionLayout`, `updateSectionTitle`; `createSection` currently has **no** app-level guard at all).

**Pattern:** replace `const ctx = await requireAdminContext()` with `const ctx = await requireSopEditAccess(sopId)` at the 3 existing call sites, and **add** a new guard call to `createSection` (which today relies on RLS only). Keep the existing `if ('error' in ctx) return { error: ctx.error }` early-return idiom unchanged — only the guard function name changes.

---

### `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` — add guard

**Analog:** `src/app/api/sops/[sopId]/publish/route.ts` (admin-gated API route pattern — uses `requireAdmin()`/`assertPublishGates()` before any write).

**Pattern:** this legacy PATCH route currently has zero app-level guard (RLS-only). Add `const ctx = await requireSopEditAccess(sopId)` as the first check in the handler, mirroring how the publish route gates before touching Supabase, and return a 403-equivalent JSON error on `{ error }`.

---

### `src/actions/sop-section-blocks.ts` — swap `requireAdmin()` sites

**Analog:** same file's existing `requireAdmin()` → `requireAdminContext()` wiring at `addBlockToSection`, `removeBlockFromSection`, `setBlockPinMode`.

**Pattern:** swap to `requireSopEditAccess(sopId)` at every user-triggered call site. **Do not touch** the `serviceRole` parser-invocation bypass (non-user-triggered, different trust boundary — RESEARCH.md Pitfall 3 flags this explicitly). This file writes via the **admin/service-role client**, so RLS extension does nothing here — the app-level guard is the only enforcement point (verified in RESEARCH.md § SOP Edit Path Inventory).

---

### RLS migration — extend `admins_can_manage_sections` / `_steps` / `_images`

**Analog:** `supabase/migrations/00062_*` and `00061_*` (the two most recent fixes to this exact OR-widening-inside-org-AND shape on `public.sops`-family tables — same bug class this migration must avoid repeating).

**Pattern (from RESEARCH.md, verified against 00003_sop_schema.sql's existing policy shape):**
```sql
drop policy if exists "admins_can_manage_sections" on public.sop_sections;
create policy "admins_can_manage_sections" on public.sop_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.sops
      where sops.id = sop_sections.sop_id
        and sops.organisation_id = public.current_organisation_id()
        and (
          public.current_user_role() in ('admin', 'safety_manager')
          or sops.owner_user_id = auth.uid()
        )
    )
  );
-- repeat identically for admins_can_manage_steps (join via sop_sections)
-- and admins_can_manage_images (join via sops directly)
```

**Critical rule (Pitfall 1/2 from RESEARCH.md, sourced from CLAUDE.md 2026-08-04 learning):** the owner-OR-role predicate must live **inside** the existing policy's `USING` clause — never as a sibling `CREATE POLICY` (permissive policies OR together at the top level; a sibling narrowing arm without full org-scope becomes a hole). If this migration or any future one adds an explicit `WITH CHECK`, it must restate the full `org AND (role OR owner)` predicate — an incomplete `WITH CHECK` silently narrows access back to admin-only (the exact 00062 bug class). **Do not touch** `admins_can_update_sops` or `admins_can_delete_sops` — out of CAP-02 scope.

Verify the current exact policy text with a fresh grep at plan/implementation time — this schema area moved twice in the last month (00061, 00062).

---

### `.planning/codebase/CAPABILITY-MATRIX.md` — new document

**No direct analog** (first capability matrix in the repo). Structure requirement from CONTEXT.md (D1, obligation ≠ access):
- Rows: org role axis only (`worker`, `supervisor`, `admin`, `safety_manager`) — see RESEARCH.md § Role Inventory for the 3 independent axes and which one is the row axis.
- Columns: capability groups from RESEARCH.md § Capability Inventory Sweep (worker walkthrough, completion/sign-off, self-add, observations, SOP creation, SOP builder editing, publish, version history, governance queue, approval chains, team mgmt, departments/org model, blocks library, AI settings, competency/training, assessor governance, exports, profile).
- Cells: distinguish shipped-and-enforced / shipped-but-unenforced (gap) / planned (with phase ref, e.g. "Phase 44b").
- Footnote row for `platform_admin` (orthogonal Potenco-level axis — do not conflate with org roles).
- Must be referenced from `CLAUDE.md` (add a line under an existing section, e.g. near "Auto-load routing" or a new "## Capability Matrix" pointer, mirroring how the Pathways Map is referenced).

---

### `tests/phase46/capability-matrix-doc.spec.ts`

**Analog:** `tests/lint/rls-org-scope.spec.ts` (parses a target file/set of files, asserts required content substrings present; no live Supabase needed).

**Pattern:** `fs.readFileSync` the matrix doc + `CLAUDE.md`, assert the doc contains each required role/capability row heading and that `CLAUDE.md` contains a reference string pointing at the doc's path (mirrors how `journeys.ts`/pathways references are asserted elsewhere in the project's doc-consistency tests).

---

### `tests/phase46/sop-edit-owner-access.spec.ts`

**Analog:** `tests/phase34/observation-read-role-scope.spec.ts` (full file structure — read completely, reuse verbatim per that file's own comment: "mirrors observation-cross-org-isolation.spec.ts and observation-immutability.spec.ts verbatim — no shared test-utils module exists for this pattern").

**Imports pattern (lines 1-25):**
```typescript
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
```

**Env-loading + client helpers (lines 49-85) — copy verbatim:**
```typescript
function loadEnv(): void {
  try {
    const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {}
}
loadEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const LIVE_ENV_READY = !!(SUPABASE_URL && SERVICE_KEY && ANON_KEY)

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}
async function mintAccessToken(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed: ${error?.message}`)
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed: ${ve?.message}`)
  return vd.session.access_token
}
function asUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
```

**Fixture helpers (lines 87-120+, extend the pattern):** `createEphemeralOrg`, `createEphemeralMember(admin, orgId, role)` (add `'admin'` to the role union alongside `'worker'|'supervisor'`), `createEphemeralSop(admin, orgId, uploaderId)` — copy verbatim, extend `createEphemeralSop` to accept/set `owner_user_id`, and add cleanup arrays (`cleanupOrgIds`, `cleanupUserIds`) exactly as this file does, with an `afterAll` teardown (read the rest of the phase34 file for the teardown block before writing this spec — not yet in context, non-overlapping read needed at implementation time).

**Required probe set (per CONTEXT.md's explicit CAP-02 test shape + 2026-07-20 learning):**
1. Positive: ephemeral SOP owner (role=`worker`, `owner_user_id` = self) can write a section update → succeeds.
2. Negative: a different `worker` in the same org, NOT the owner → write rejected (both RLS and/or app guard).
3. Regression: `admin`/`safety_manager` in the org, not the owner → write still succeeds (universal edit unchanged).

---

### `tests/phase46/sop-edit-guard-wiring.spec.ts`

**Analog:** the guard-relocation source-contract pattern established by the 2026-07-13 learning ("prefer guards that assert the behaviour WHERE IT LIVES plus that the caller still CALLS it") — closest concrete precedent is `tests/lint/rls-org-scope.spec.ts`'s file-parsing + substring-assertion shape, adapted to grep TypeScript call sites instead of SQL.

**Pattern:** `fs.readFileSync` each of the enumerated call-site files (`src/actions/sections.ts`, `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts`, `src/actions/sop-section-blocks.ts`) and assert each contains `requireSopEditAccess(` — proving both that the guard exists (import present) AND that it's wired at the call site, not just defined and unused (the exact class of bug the 2026-06-05 "dead feature" and 2026-06-08 AddMenu learnings describe).

---

### `playwright.config.ts` — register `phase46` project

**Analog:** existing `phase34`/`phase37`/`phase40` project entries in the same file (grep for `testMatch: /tests\/phase34` etc. to copy the exact block shape).

**Pattern:** add one project entry:
```typescript
{
  name: 'phase46',
  testDir: '.',
  testMatch: /tests\/phase46\/.*\.(spec|test)\.ts$/,
  // ...same use/timeout config as sibling phaseNN projects
}
```
**Verification step (mandatory per 2026-05-25 learning):** after adding, run `npx playwright test --list --project=phase46` and confirm all 3 new spec files appear — an unregistered spec silently never runs.

## Shared Patterns

### Session/role resolution
**Source:** `src/lib/auth/session-context.ts` via `getSessionContext()`
**Apply to:** `requireSopEditAccess` (new guard) — same destructure (`supabase, userId, role, organisationId`) as `requireAdminContext()`.

### Admin-client self-enforced org-scope fetch
**Source:** pattern used throughout `src/actions/versioning.ts`, `src/actions/sections.ts` (`updateSectionTitle`) — admin (service-role) client + explicit `.eq('organisation_id', organisationId)` sourced from session, never trusting the fetched row.
**Apply to:** `requireSopEditAccess`'s SOP-ownership lookup.

### RLS OR-inside-AND (not sibling policy)
**Source:** `supabase/migrations/00061_*`, `00062_*` (the two live fixes for this exact bug class on `sops`/`organisation_members`).
**Apply to:** the 3 policy migrations this phase adds.

### Ephemeral-org live-probe test fixture
**Source:** `tests/phase34/observation-read-role-scope.spec.ts` (and its siblings `observation-cross-org-isolation.spec.ts`, `observation-immutability.spec.ts`).
**Apply to:** `tests/phase46/sop-edit-owner-access.spec.ts` — copy verbatim, no shared test-utils module exists for this pattern in the codebase (confirmed by the source file's own comment).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/codebase/CAPABILITY-MATRIX.md` | doc | — | First matrix document of this kind in the repo; structure specified directly in CONTEXT.md/RESEARCH.md rather than copied from an existing doc. |

## Metadata

**Analog search scope:** `src/lib/auth/`, `src/actions/sections.ts`, `src/actions/sop-section-blocks.ts`, `src/app/api/sops/`, `supabase/migrations/` (00061-00062), `tests/phase34/`, `tests/lint/`, `playwright.config.ts`
**Files scanned:** RESEARCH.md's own direct-read list (13 files) + 2 additional direct reads this pass (`src/lib/auth/guards.ts` full, `tests/phase34/observation-read-role-scope.spec.ts` lines 1-120)
**Pattern extraction date:** 2026-08-25
