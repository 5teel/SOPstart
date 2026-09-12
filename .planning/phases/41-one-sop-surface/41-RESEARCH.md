# Phase 41: One SOP Surface - Research

**Researched:** 2026-09-13
**Domain:** Next.js 16 App Router — merging a client worker list route with a server admin list route into one permission-gated surface, under a hard CI bundle-isolation gate
**Confidence:** HIGH (all claims below are code-read, file:line cited — this is an internal-refactor phase with no external libraries to verify)

## Summary

Both `/sops` (worker, client component) and `/admin/sops` (admin, server component) already implement the **identical visual pattern** — sketch 005 variant C, a three-column Miller frame (scope | list | detail) — built independently four to six weeks apart. This is the single most important research finding: the merge is not "invent a shared layout," it is "pick one Miller shell and make the other side's scope column and detail pane a lens inside it." The two implementations differ in exactly the ways the phase needs them to: the worker side already isolates its list component behind `next/dynamic({ ssr: false })` for bundle reasons (`src/app/(protected)/sops/page.tsx:34-37`), and the admin side already keeps its heaviest sub-surfaces (`WiringPatchBayShell`, `GovernanceQueueRow`) as separately-mountable client components fed by server-fetched props.

A second major finding: **`AdminNav.tsx` does not exist.** It was deleted 2026-07-30 (sketch 004 variant A) and its five links now live inline in `TopHeader.tsx`'s `ADMIN_LINKS` array (`src/components/layout/TopHeader.tsx:141-147`). CONTEXT.md's D-04 and canonical-refs both cite a component that is gone — the planner must target `TopHeader.tsx` line ~142 (`{ label: 'Manage SOPs', href: '/admin/sops' }`), not a nonexistent `AdminNav.tsx`. `tests/phase30/admin-nav.spec.ts` already encodes this fact and is the pattern to extend.

A third finding materially de-risks the rendering-model decision: the codebase already has a role-aware client context (`RoleProvider`/`useRole()`/`useIsAdmin()`, `src/components/providers/RoleProvider.tsx`) wired into the `(protected)` layout from `getSessionContext()` server-side (`src/app/(protected)/layout.tsx:14-30`). A client `/sops` page can gate admin-lens rendering with `useIsAdmin()` at zero fetch cost — no new role-plumbing is needed.

**Primary recommendation:** Keep `/sops` as the surviving client-component shell (worker behaviour untouched verbatim), and load the three admin lenses (status/drafts, governance queue, access patch bay) as `next/dynamic({ ssr: false })` client components gated behind `useIsAdmin()`, fetching their own data client-side via the existing server actions (`listGovernanceQueue`, `listOrgTree`, `listGrants` are already callable from a client component — they are `'use server'` actions, not page-only server-component code). This is "keep the list client-side and code-split the admin lenses," the second of the two ROADMAP-sanctioned shapes, and it requires zero changes to the worker's data-fetching architecture — only additive scope items and lazy panes. `/admin/sops` survives only as a `redirect()` shim preserving query strings.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: The surviving URL is **`/sops`** (the worker route). `/admin/sops` survives only as a redirect shim to `/sops` (preserving `?view=`, `?departments=`, `?collection=`, `?sop=` query strings), never as a destination.
- D-02: The desktop layout is the **sketch 005 variant C Miller frame already shipped on `/sops`** (commits `cbce023`, `82fec78`): one bordered scope | list | detail grid, sticky mono column headers, flush hairline rows, ink-fill selection. Admin lenses are additional *scopes* in the first Miller column (e.g. "Needs attention", "Drafts", "Access"), rendered only for roles entitled to them — not a separate tab strip. Mobile keeps the existing stacked worker list.
- D-03: **Rendering model must be decided and stated in the first plan before any surface work** (ROADMAP hard requirement). Either "server shell hosting lazily-loaded client lenses" or "client list with code-split admin lenses" is acceptable. Whichever is chosen, every worker behaviour is preserved verbatim and the admin lens code never enters a worker-session bundle.
- D-04: `TopHeader` keeps exactly one "SOPs" entry (`/sops`). `AdminNav` drops its "Manage SOPs" item; Governance/Content/Team/Settings survive; the governance link deep-links `/sops?view=attention`. "Create New SOP" stays where it is (Phase 42 moves it). **[RESEARCH CORRECTION: `AdminNav.tsx` does not exist — see Summary. The five admin links live in `TopHeader.tsx`'s `ADMIN_LINKS` array. Read this decision as: drop the `Manage SOPs` entry from `ADMIN_LINKS`; keep Content/Team/Settings; add or repoint a Governance entry to `/sops?view=attention`.]**
- D-05: The word "Library" survives only as a *filter/scope label* ("Your SOPs" vs "Everything"), never a nav label or a destination.
- D-06: From the merged list an admin reaches the builder (`/admin/sops/builder/[sopId]`) by **one** chain. Keep both *destinations* (detail for everyone, builder for editors) but ensure only one path from list → builder exists after the merge; do not introduce a third.
- D-07: `?departments=` and `?collection=` (Phase 33 filters), `?sop=` (post-publish wire-up link into the access patch bay), `?view=attention`, `?view=access` — all resolve to the same views they resolve to today, on `/sops`.
- D-08: `SB-LINE-06` today gates `/sops/[sopId]/page` (`scripts/check-bundle-size.ts`, `.bundle-baseline.json`). This phase must **add the `/sops` list route to the same gate** (capture a baseline BEFORE surface work in Wave 0, then assert ≤ 2 KB drift) and assert by manifest inspection that governance-queue / org-tree / wiring-patch-bay modules are absent from the worker route's client chunks. A regression is a phase-failing condition.
- D-09: Prod is now a single working org "SOPstart" (id `bd2c2b88…`) with ~33 SOPs (real count, RLS-leak-free, per Phase 40 closeout: ~23), 4 published, plus Jacks House. Any "live data shape" figure older than 2026-09-12 counted multiple orgs.
- D-10: UAT happens on sopstart.com after Railway deploy only — never local Playwright instructions to Simon. Human-verify steps are written as plain click-paths + yes/no questions. After any UI change, LOOK at the deployed page.

### Claude's Discretion

- Exact component split, lens loading mechanism (`next/dynamic` vs React.lazy), scope-column ordering, skeleton/loading states, how the redirect shim preserves the query string, source-contract test shapes.
- Whether `SopWorkerBrowser` absorbs the admin lenses or a thin wrapper composes them.

### Deferred Ideas (OUT OF SCOPE)

- Merging SOP detail + builder into one URL (D-A9) — architecturally larger, not this milestone.
- Moving "Create New SOP" onto the merged surface — Phase 42.
- Phase 45 "view as role" — waits for this phase to settle the surface.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUR-01 | One route lists SOPs for every role, gated by permission not URL | Rendering-model recommendation below (client shell + `useIsAdmin()` lens gating); role already resolved server-side and passed via `RoleProvider` |
| SUR-02 | Admin capabilities are lenses, not destinations | Admin/Architecture Patterns section — three lenses mapped onto the existing Miller scope column |
| SUR-03 | One top-level "SOPs" entry, no second nav path | `TopHeader.tsx` `ADMIN_LINKS` inventory (Manage SOPs entry to delete); `AdminNav.tsx` non-existence correction |
| SUR-04 | One path from a SOP to editing it | Builder route-chain inventory (Common Pitfalls / route chain section) |
| SUR-05 | Worker mobile bundle unaffected — `SB-LINE-06` stays green | Bundle Gate section — exact code changes needed to `check-bundle-size.ts` / `capture-bundle-baseline.ts` + `WalkthroughSwitcher` precedent |
| SUR-06 | "Library" survives only as a filter label | Already true on the worker side (`WORKER_SCOPES` group `'library'` label `'Everything'`); admin side still says "SOP library" in comments/UI copy — must be swept |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SOP list rendering (scope/list/detail Miller frame) | Browser / Client | — | Selection state is a hot path (click-to-preview); must stay client state per the existing `SopMillerBrowser`/`SopWorkerBrowser` precedent — a `router.push` per click would refetch through the service worker (CLAUDE.md 2026-05-13) |
| Role/permission resolution (which lenses render) | Frontend Server (SSR) | Browser / Client | Role is resolved once per request in `(protected)/layout.tsx` via `getSessionContext()` and handed down through `RoleProvider`; the client only reads it, never re-derives it |
| Governance queue / org tree / access grants data | API / Backend (server actions) | Browser / Client (fetch on demand) | `listGovernanceQueue`, `listOrgTree`, `listGrants` are `'use server'` actions in `src/actions/governance.ts` / `org-model.ts` / `grants.ts` — already callable from a client component; they self-enforce org scope server-side regardless of caller tier |
| Bundle isolation (worker chunk excludes admin code) | Browser / Client (code-split boundary) | CDN / Static (chunk manifest) | Enforced post-build by `scripts/check-bundle-size.ts` reading `.next` client-reference manifests — a build-time/CI concern, not a runtime one |
| Deep-link resolution (`?view=`, `?departments=`, `?sop=`) | Frontend Server (SSR) today; must become Browser/Client-readable | — | Currently these are read in the admin **server** page (`admin/sops/page.tsx:117-135`) via `searchParams`. Post-merge, `/sops` is a client page — `useSearchParams()` must replace `searchParams` prop reads for the admin-only params, while the redirect shim carries old links across |

## Standard Stack

No new external dependencies. This is an internal component/routing refactor. `next/dynamic` (built into Next.js 16, already used project-wide) is the only "library" involved.

### Package Legitimacy Audit

Not applicable — no packages are being installed by this phase.

## Architecture Patterns

### Current State — two independently-built Miller frames

Both routes render the exact same three-region shape (scope column | list | detail), built ~6 weeks apart without shared code:

```
/sops (client, sops/page.tsx)              /admin/sops (server, admin/sops/page.tsx)
┌─────────────┬───────────┬──────────┐     ┌─────────────┬───────────┬──────────┐
│ Scope       │ List      │ Detail   │     │ Scope (Link)│ List      │ Detail   │
│ (buttons,   │(SopWorker │(training │     │ status tabs,│(SopMiller │(category/│
│ client      │ Browser,  │ clock,   │     │ dept list,  │ Browser,  │ dept     │
│ state)      │ dynamic   │ Walk/Read│     │ Needs       │'use client│ picker,  │
│             │ import)   │ links)   │     │ attention,  │')         │ links to │
│             │           │          │     │ Access — all│           │ builder) │
│             │           │          │     │ <Link> hrefs│           │          │
└─────────────┴───────────┴──────────┘     └─────────────┴───────────┴──────────┘
```

Source: `src/app/(protected)/sops/page.tsx:507-585` (worker Miller grid + `MillerColumnHeader`/`MillerItem` primitives at :592-644); `src/app/(protected)/admin/sops/page.tsx:569-696` (admin Miller grid, scope column as server-rendered `<Link>`s); `src/components/sop/SopWorkerBrowser.tsx` (worker list+detail, `'use client'`, 295 lines); `src/components/admin/SopMillerBrowser.tsx` (admin list+detail, `'use client'`, 306 lines).

### Recommended rendering model — client shell, code-split admin lenses

**Decision: keep `/sops` a client component (`'use client'` page, unchanged data-fetching architecture); add three admin lenses as `next/dynamic({ ssr: false })` client components gated by `useIsAdmin()`.**

Why this over "server shell hosting lazily-loaded client lenses":

1. **Zero risk to the worker path.** `sops/page.tsx` already has a working, tested, offline-capable data layer (`useAssignedSops`, `useSopSync`, Dexie). Converting the page to a server component (or wrapping it in a new server shell) means re-plumbing all of this through a server/client boundary for no functional gain — the worker behaviour must be "preserved verbatim" (D-03), and the smallest diff that guarantees verbatim preservation is "add to the existing client tree," not "rebuild the host."
2. **The admin data is already action-shaped, not page-shaped.** `listGovernanceQueue()`, `listOrgTree()`, `listGrants()` (`src/actions/governance.ts`, `org-model.ts`, `grants.ts`) are `'use server'` functions callable from anywhere, including a `useQuery` in a client component — they are not `admin/sops/page.tsx`-only code. The current admin page calls them in a `Promise.all` only because that page happens to be a server component; nothing about the actions requires that.
3. **Bundle isolation is easier to prove with fewer moving parts.** `next/dynamic({ ssr: false })` on each of the three lens components is the exact, already-precedented mechanism (`WalkthroughSwitcher.tsx:34-44`, cited in D-08) — the check-bundle-size gate's chunk-existence assertion pattern (find the dynamic-import symbol in build output) extends directly. A server-shell approach would need React Server Components' own code-splitting semantics proven bundle-safe from scratch, which is a materially larger and less-precedented verification surface for a phase whose success criterion is "no regression."
4. **`useIsAdmin()` already exists and costs nothing.** Role is resolved once server-side per request (`getSessionContext()` in `(protected)/layout.tsx:14`) and handed to every client component via `RoleProvider`. Gating lens rendering is `if (useIsAdmin()) { <AdminLenses /> }` — no additional round trip, no new auth plumbing.

**What changes on `/sops/page.tsx`:**
- Add `WorkerScope` union members for the three admin scopes (e.g. `'admin-drafts' | 'admin-published' | 'admin-attention' | 'admin-access'`) — or, cleaner per D-02, add a second scope **group** (`'admin'`) in the `WORKER_SCOPES`-equivalent array, rendered only when `useIsAdmin()` is true.
- Replace the current unconditional `SopWorkerBrowser` render with a scope-aware switch: worker scopes render `SopWorkerBrowser` (untouched); admin scopes render one of three new `next/dynamic({ ssr: false })` lens components.
- Read `?view=`, `?departments=`, `?collection=`, `?sop=` via `useSearchParams()` (client hook) instead of the admin page's current `searchParams` prop — and write scope changes with `history.replaceState`, not `router.push`, per the existing worker-side convention and the CLAUDE.md 2026-05-13 learning (the admin page currently uses real `<Link>` navigations for scope changes, which is correct for a full server re-render but wrong to carry into a client-side scope switch — switching to client `useState` + `replaceState` avoids an RSC fetch per scope click).

**What the three lens components need:**
- `AdminStatusLens` — replaces the current default admin view (status tabs, `SopMillerBrowser` list+detail). Wraps the existing `SopMillerBrowser` component (already `'use client'`, no rewrite needed) fed by a client-side fetch of the same `SOP_SELECT` columns (`admin/sops/page.tsx:191-219`) — this becomes a `useQuery` calling a new thin server action (the current query logic is inline in the page and must be extracted into a callable action; see Don't Hand-Roll below for what NOT to re-derive).
- `AdminAttentionLens` — wraps `GovernanceQueueRow` (already `'use client'`) fed by `listGovernanceQueue()` via `useQuery`.
- `AdminAccessLens` — wraps `WiringPatchBayShell` (already `'use client'`) fed by `listOrgTree()` + `listGrants()` + the collections/sop-by-collection assembly currently inline in `admin/sops/page.tsx:344-382` (this assembly logic must move into a server action too — it is the single largest "don't hand-roll" risk in the phase; see below).

### Anti-Patterns to Avoid

- **Do not statically import `WiringPatchBayShell`, `GovernanceQueueRow`, `SopMillerBrowser`, `DepartmentPicker`, or any `org-model.ts`/`grants.ts`/`governance.ts` action anywhere in `sops/page.tsx`'s top-level import graph.** Every one of these must be reached only through the `next/dynamic({ ssr: false })` lens boundary, mirroring the `WalkthroughSwitcher.tsx` rule ("this file is the SOLE allowed reference site... via next/dynamic"). Consider adding a `tests/lint/no-static-admin-lens-import.spec.ts` mirroring the existing `no-static-desktop-import.spec.ts` pattern.
- **Do not re-derive the admin query logic (status filtering, draft-confidence ordering, `?departments=`/`?collection=` id resolution) inline in the new lens component.** That ~230 lines of logic (`admin/sops/page.tsx:162-343`) is exactly the kind of "worked out once, must not be re-invented" logic the Don't Hand-Roll table below calls out — extract it into a server action, don't paste-and-adapt it into a client `useQuery` fetcher.
- **Do not use `router.push` for scope changes on the merged `/sops`.** The admin page currently does this via real `<Link>` hrefs (`admin/sops/page.tsx:455`, `:534`, etc.) because it's a server component and a `<Link>` triggers the correct RSC re-render. On the merged client page, the worker side already proved `useState` + `history.replaceState` is the fast pattern (CLAUDE.md 2026-05-13) — apply it to admin scope switches too, not just worker ones.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin SOP list query (status filter, draft-confidence sort, department/collection id resolution, `?sop=` collection-ensure) | A new client-side re-implementation of this filtering | Extract `admin/sops/page.tsx:162-343` verbatim into a new server action (e.g. `listAdminSopRows(params)`), called via `useQuery` from the lens | This logic already handles the `departments=none` "no audience" edge case, the XOR of dept-filter vs collection-filter vs status, and the `ensureSopCollections` side-effect for `?sop=` pinning — reproducing it by eye risks silently dropping one of these branches |
| Bundle-chunk existence proof for the new admin lenses | A bespoke new script | Extend `scripts/check-bundle-size.ts`'s existing `findSymbolInBuildOutput()` helper (already generic — takes a symbol string) with new calls for `WiringPatchBayShell`, `GovernanceQueueRow`, `SopMillerBrowser` (or whatever the final lens component names are) plus their negative-assertion markers | The helper already checks three manifest sources (page bundle, react-loadable manifest, static chunks) — this is the exact machinery D-08 needs, just parameterized with new symbols, not reinvented |
| Role-gating a client component | A new context, a new fetch-the-role-on-mount hook | `useIsAdmin()` / `useRole()` from `src/components/providers/RoleProvider.tsx` | Already resolves role once per request server-side and threads it through the whole `(protected)` tree; a second role-fetch would be a duplicate network/DB round trip and a second source of truth |
| Query-string-driven scope on a client page | Manually parsing `window.location.search` | `useSearchParams()` (Next.js client hook) to read, `history.replaceState` to write | Matches the exact pattern already proven on the worker department filter and required by the CLAUDE.md 2026-05-13 learning |

**Key insight:** almost everything the admin lenses need to render already exists as either a `'use server'` action or a `'use client'` component. The actual net-new code in this phase is thin: (1) extracting ~230 lines of inline page logic into one or two callable server actions, (2) three `next/dynamic` wrapper components, (3) scope-column wiring, (4) the bundle-gate script extension, (5) the redirect shim, (6) nav/journeys/uat edits.

## Common Pitfalls

### Pitfall 1: The single-route bundle gate script is hardcoded to `/sops/[sopId]/page` — it will not automatically cover `/sops/page`

**What goes wrong:** `scripts/check-bundle-size.ts` and `scripts/capture-bundle-baseline.ts` both hardcode `ROUTE = '/sops/[sopId]/page'` and a matching `RSC_MANIFEST_PATH` (`check-bundle-size.ts:44-53`). D-08 requires gating `/sops/page` (the list route, no `[sopId]`) as a *second*, independent route. Simply editing the existing constants would silently stop gating the detail route.
**Why it happens:** the script was written single-purpose in Phase 15 and never generalized to a route array.
**How to avoid:** refactor both scripts to loop over an array of `{ route, rscManifestPath, forbiddenMarkers }` entries — one for `/sops/[sopId]/page` (existing: `DesktopWalkthrough`, `WalkthroughVoiceModal`, pdfjs/mammoth/konva negative markers) and one new entry for `/sops/page` (new: `WiringPatchBayShell`/`GovernanceQueueRow`/`SopMillerBrowser`/`DepartmentPicker`/`setSopCategory` negative markers, per D-08's "governance-queue, org-tree, wiring-patch-bay code" requirement). `.bundle-baseline.json`'s `routes` object already supports multiple keys (it's a `Record<string, number>`) — only the two scripts need the loop, not the baseline schema.
**Warning signs:** if the gate stays green after the merge lands, check whether it's actually reading the `/sops/page` manifest at all, or silently still only checking `/sops/[sopId]/page` (which the merge does not touch, so it would trivially pass while proving nothing about the new admin-lens code).

### Pitfall 2: `AdminNav.tsx` doesn't exist — following CONTEXT.md's canonical refs literally will send the planner to a nonexistent file

**What goes wrong:** CONTEXT.md's `<canonical_refs>` and D-04 both name `src/components/admin/AdminNav.tsx`. It was deleted 2026-07-30; the file tree has no `AdminNav*` anywhere. The actual admin nav links live in `TopHeader.tsx`'s `ADMIN_LINKS` array (lines 141-147), which `tests/phase30/admin-nav.spec.ts` already asserts is the current state (`expect(fs.existsSync(ADMIN_NAV)).toBe(false)`).
**Why it happens:** CONTEXT.md was compiled from prior locked decisions across several dated sessions (2026-07-28 audit, 2026-08-06, etc.) and the compiled document inherited stale filenames from an earlier phase's naming before the 2026-07-30 nav consolidation.
**How to avoid:** target `TopHeader.tsx:141-147` for the "drop Manage SOPs, keep Content/Team/Settings, repoint/add Governance to `/sops?view=attention`" edit. Extend `tests/phase30/admin-nav.spec.ts` (or add a `tests/phase41/*.spec.ts` sibling) rather than writing a new assertion against a file that will never exist.
**Warning signs:** any task description that says "edit AdminNav.tsx" should be caught in plan review — grep first (`grep -rn "AdminNav" src`) before writing the task.

### Pitfall 3: The admin page's scope-switch mechanism (`<Link>` navigation) is architecturally wrong to copy onto the merged client page

**What goes wrong:** `admin/sops/page.tsx` changes scope via real `<Link href="/admin/sops?status=draft">` navigations (lines 455, 550-559, 664-689) because as a server component, that's correct — each click re-runs the server component with new `searchParams`. If the merge copies this `<Link>`-per-scope pattern verbatim onto the now-client `/sops` page, every admin scope click will trigger a full RSC fetch through the service worker, reproducing the exact perf bug the 2026-05-13 CLAUDE.md learning fixed for the worker side.
**Why it happens:** it's the path of least resistance to copy the admin page's existing JSX almost unchanged.
**How to avoid:** convert admin scope switching to the same `useState` + `history.replaceState` pattern the worker side already uses for `scope`/`selectedDeptIds` (`sops/page.tsx:91`, `:150-153`). Only the *initial* URL (e.g. a deep link with `?view=attention`) should be read via `useSearchParams()` on mount; subsequent in-page scope clicks should not push a new navigation.
**Warning signs:** clicking between "Drafts"/"Published"/"Needs attention" on the merged page feels slow or shows a loading flash that the worker-side scope switch doesn't — that's the tell the admin lens copied `<Link>` navigation instead of client state.

### Pitfall 4: `requireAdminContext`-style hard redirects don't compose with "the URL is shared" — the admin page currently redirects non-admins to `/dashboard`

**What goes wrong:** `admin/sops/page.tsx:130-135` does `if (!role || !['admin','safety_manager'].includes(role)) redirect('/dashboard')`. After the merge, `/sops` must be reachable by every role — there is no page-level redirect to fall back on. If any extracted server action (the new `listAdminSopRows`, or the governance/org-model/grants actions) is called from a worker session, it must return an auth error, not assume the caller already passed a page-level gate.
**Why it happens:** `listGovernanceQueue`/`listOrgTree`/`listGrants` already self-enforce via `requireAdminContext()` internally (per the codebase's established pattern — verify each with a quick grep at plan time), but any *new* extracted action (the admin-list-query extraction from Don't Hand-Roll) must be written with the same guard from day one, not added after the fact.
**How to avoid:** every new server action created by this phase's extraction work must open with `requireAdminContext()` (or equivalent) exactly like the existing governance/org-model/grants actions do — grep each new action against the `requireAdminContext` pattern in `src/lib/auth/guards.ts:22-29` as a checklist item, not an afterthought.
**Warning signs:** a worker session that can somehow trigger the admin-list-query action and get real data back (rather than an `{ error: '...' }` object) is the signal this was missed.

### Pitfall 5: `?departments=`/`?collection=` currently apply ONLY to the plain admin library view, explicitly excluded from the access view (`!isAccessView` guard, line 153-154) — this branching logic must survive the merge exactly

**What goes wrong:** `departmentFilter`/`collectionFilter` in the current admin page are computed as `!isAccessView ? params.departments : undefined` — i.e., these filters are deliberately inert when `?view=access` is also present, because the access view has its own department-tree navigation. A naive merge that treats `?departments=`/`?view=` as independent client-side scope state (rather than mutually exclusive per this existing rule) will let both apply simultaneously, which never happens today and has no defined behaviour.
**Why it happens:** the two params look independent but aren't — the "off" branch is a deliberate product decision (D-07's Phase 33 deep-link filters only ever meant "filter the library list," never "filter inside the access map").
**How to avoid:** replicate this exact precedence in the merged client-side scope logic: when the active scope is the access lens, ignore `departments`/`collection` params entirely (they still exist in the URL for the redirect shim's sake, but should not affect the access lens's own tree state).
**Warning signs:** a `?departments=X&view=access` deep link renders a filtered access map that behaves differently than either param alone — a regression from current server-side behaviour.

## Code Examples

### `next/dynamic` code-split precedent (the pattern to replicate for admin lenses)

```typescript
// Source: src/components/sop/walkthrough/WalkthroughSwitcher.tsx:34-44 (existing code)
const DesktopWalkthrough = dynamic(
  () =>
    import('./DesktopWalkthrough').then((m) => ({ default: m.DesktopWalkthrough })),
  { ssr: false, loading: () => null }
)

const WalkthroughVoiceModal = dynamic(
  () =>
    import('@/components/sop/voice/WalkthroughVoiceModal').then((m) => ({
      default: m.WalkthroughVoiceModal,
    })),
  { ssr: false, loading: () => null }
)
```

The existing `/sops/page.tsx` already applies the identical pattern to its own worker list component, with a comment explicitly documenting the bundle-size incident this fixed:

```typescript
// Source: src/app/(protected)/sops/page.tsx:34-37 (existing code)
const SopWorkerBrowser = dynamic(
  () => import('@/components/sop/SopWorkerBrowser').then((m) => m.SopWorkerBrowser),
  { ssr: false }
)
```

### Role-gating a client component (already available, zero new plumbing)

```typescript
// Source: src/components/providers/RoleProvider.tsx (existing code)
export function useIsAdmin(): boolean {
  const role = useContext(RoleContext)
  return role === 'admin' || role === 'safety_manager'
}
```

```tsx
// Recommended usage inside sops/page.tsx (new code, illustrative)
const isAdmin = useIsAdmin()
{isAdmin && <AdminScopeGroup ... />}
```

### Chunk-existence assertion helper (generic, ready to extend)

```typescript
// Source: scripts/check-bundle-size.ts:172-231 (existing code — already takes an
// arbitrary symbol string, so extending it to new components is a call-site
// change, not a rewrite)
function findSymbolInBuildOutput(symbol: string): { found: boolean; locations: string[] } {
  // ... checks page bundle, react-loadable manifest, and static chunks
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Two separate "SOPs" nav destinations, two separate list implementations | One route, permission-gated lenses | This phase | Closes the last major duplicate-surface gap identified in the 2026-07-28 v8.0 audit |
| Admin nav as a standalone `AdminNav.tsx` component | Admin links inline in `TopHeader.tsx` `ADMIN_LINKS` | 2026-07-30 (sketch 004 variant A, pre-dates this phase) | CONTEXT.md's D-04/canonical-refs are stale on this point — corrected above |
| Governance queue as a separate `/admin/governance` page | Redirect shim → `/admin/sops?view=attention` | Phase 30 (UX-03), 2026-07-12 | This phase's `/admin/sops` → `/sops` shim is the same pattern one level up — precedent already proven in prod |

**Deprecated/outdated:**
- `/admin/sops` as a destination — becomes a redirect shim only, per D-01.
- Server-component-only admin data fetching for governance/org-tree/grants — these actions must become callable from client `useQuery`s for the merged surface (they already are `'use server'`, so no server-side change is needed, only new client call sites).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `listGovernanceQueue`, `listOrgTree`, `listGrants` (and other admin actions referenced) already self-enforce org+role scope internally via `requireAdminContext()` or equivalent, so calling them from a client `useQuery` is safe without an additional page-level gate | Architecture Patterns, Don't Hand-Roll, Pitfall 4 | If any of these three actions does NOT already self-guard (verify each at plan time with a direct read, not just this research's inference from the codebase's established pattern), calling it from a client component removes the page-level `redirect('/dashboard')` safety net entirely and could leak governance/org data to non-admin sessions |
| A2 | The recommended rendering model (client shell + code-split lenses) satisfies D-08's bundle gate with less implementation risk than a server-shell alternative | Architecture Patterns | This is a judgment call, not a verified fact — the ROADMAP explicitly says either shape is acceptable; if the plan-checker or Simon has a strong preference for the server-shell shape (e.g. for future SEO/SSR reasons), this recommendation should be revisited before Wave 1 lands |

All other claims in this document are `[VERIFIED: codebase read]` — file:line citations are given throughout, not `[ASSUMED]` in the training-data sense, since this phase is a pure internal refactor with no external API/library surface to misremember.

## Open Questions

1. **Does `admin/sops/page.tsx`'s inline SOP-list query (lines 162-343) need to become ONE new server action or TWO (one for the plain list, one for the access-view's collections/grants assembly)?**
   - What we know: the plain-library query and the access-view data assembly are already read as independent branches gated by `isAccessView` in the same `Promise.all`.
   - What's unclear: whether splitting them into two actions vs one parameterized action is cleaner for the lens components' `useQuery` boundaries.
   - Recommendation: split into two — `listAdminSopRows(params)` for the plain/drafts/published scopes, and reuse the existing `listOrgTree`/`listGrants`/collections logic (already separable) for the access lens. This mirrors how the current page already treats them as independent data needs.

2. **Should the redirect shim for `/admin/sops` be a page-level `redirect()` (server component) or a `next.config.js` redirect entry?**
   - What we know: Phase 30's `/admin/governance` shim is a page-level `redirect()` (per `journeys.ts:568`: "Redirect shim → /admin/sops?view=attention"). Query-string preservation with `next.config.js` redirects requires wildcard/`:path*` syntax and is less flexible for remapping `?view=X` to a different scope param shape if the merged page's scope query-param names differ from today's.
   - What's unclear: whether the merged `/sops` page will keep the exact same param names (`view`, `departments`, `collection`, `sop`) or rename them as part of the scope-group design.
   - Recommendation: use a page-level `redirect()` in `admin/sops/page.tsx` (replacing its current body entirely) that reads `searchParams` and constructs the equivalent `/sops?...` URL — this keeps remapping logic in TypeScript rather than regex-based `next.config.js` rewrites, and matches the existing shim precedent.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the existing Next.js/Supabase/Playwright stack already running in this repo.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (test runner used for both integration/e2e specs and source-contract "unit-style" specs) |
| Config file | `playwright.config.ts` (project-per-phase regex registration — see CLAUDE.md 2026-05-25 learning: an unregistered spec file never runs) |
| Quick run command | `npx playwright test --project=phase41` (once registered) |
| Full suite command | `npm run test` (all projects) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUR-01 | Worker/supervisor/admin all land on `/sops`; each sees permission-appropriate content | source-contract + role-probe | `npx playwright test --project=phase41 -g "SUR-01"` | ❌ Wave 0 |
| SUR-01 | Every worker behaviour (assigned-first, offline Dexie, self-add/remove, dept filter, search, refresher dates) preserved verbatim | source-contract (diff against pre-merge `sops/page.tsx` behaviour) | `npx playwright test --project=phase41 -g "worker behaviour preserved"` | ❌ Wave 0 |
| SUR-02 | Draft/published/attention/access all render as scopes on `/sops`, not separate routes | source-contract (grep for scope array entries + component wiring) | `npx playwright test --project=phase41 -g "SUR-02"` | ❌ Wave 0 |
| SUR-02 | Deep links `?departments=`, `?collection=`, `?sop=`, `?view=attention`, `?view=access` all resolve on `/sops` | live/runtime probe | `npx playwright test --project=phase41 -g "deep-link"` | ❌ Wave 0 |
| SUR-03 | Exactly one "SOPs" entry in `TopHeader`; no `AdminNav` duplicate exists | source-contract (extend `tests/phase30/admin-nav.spec.ts` pattern) | `npx playwright test --project=phase30` (existing) + new phase41 assertion | Partial — extend existing file |
| SUR-04 | One route chain list → builder (no second chain) | reference-sweep (mirrors `tests/phase30/dead-weight.spec.ts` pattern — pair `existsSync`-style route-deletion checks with a `src/` href grep) | `npx playwright test --project=phase41 -g "SUR-04"` | ❌ Wave 0 |
| SUR-05 | `SB-LINE-06` bundle gate green for BOTH `/sops/[sopId]/page` and new `/sops/page` entries; admin-lens code absent from worker chunks | build-time script (not Playwright) | `npm run build` (runs `postbuild` → `tsx scripts/check-bundle-size.ts`) | Partial — script exists, needs route-array refactor (Pitfall 1) |
| SUR-06 | "Library" never appears as a nav label or destination outside `?view=` scope labels | source-contract grep sweep | `npx playwright test --project=phase41 -g "SUR-06"` | ❌ Wave 0 |
| — | `/admin/sops` → `/sops` redirect preserves query strings | live/runtime probe | `npx playwright test --project=phase41 -g "redirect shim"` | ❌ Wave 0 |
| — | `journeys.ts` / `uat/tests.ts` updated for every rerouted screen; `/pathways` shows 0 not-mapped | manual UAT + source grep | plain click-path per CLAUDE.md/D-10 | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase41` (fast, source-contract-heavy — mirrors phase28/30/32/33 precedent)
- **Per wave merge:** `npm run build && npm run test` (full suite + bundle gate, since SUR-05 is a build-artifact assertion that only runs post-`next build`)
- **Phase gate:** Full suite green + `npm run build` green (bundle gate is part of `postbuild`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/phase41/*.spec.ts` — new phase41 Playwright project registered in `playwright.config.ts` (mirror the `phase40`/`phase33` project shape: `name: 'phase41', testDir: '.', testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/`)
- [ ] Bundle-baseline capture for `/sops/page` BEFORE any surface-work edits land (D-08 explicit requirement) — extend `scripts/capture-bundle-baseline.ts` to accept a second route and re-run it as the very first Wave-0 task, committing the updated `.bundle-baseline.json`
- [ ] `tests/phase30/admin-nav.spec.ts` extension (or a new `tests/phase41/admin-nav-merge.spec.ts`) asserting the `Manage SOPs` entry is gone from `TopHeader.tsx` `ADMIN_LINKS` and a `Governance` entry deep-links `/sops?view=attention`
- [ ] Reference-sweep spec for `/admin/sops` (exact, non-sub-route) hrefs — every file found in this research's inventory (`ai-fields.ts:208,255`, `ParseJobStatus.tsx:317`, `role-home.ts:20`, `journeys.ts` ×6, `roles.ts` ×2, `uat/tests.ts` ×15) must be repointed or explicitly left pointing at the shim, and the spec should assert the count doesn't silently grow

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Every admin action (existing: `requireAdminContext()` in `src/lib/auth/guards.ts:22`; new: any action extracted from `admin/sops/page.tsx` during this phase MUST call the same guard) — UI-level lens hiding (`useIsAdmin()`) is a UX convenience, never a substitute for the server-side check |
| V5 Input Validation | yes (narrow) | `searchParams`/`useSearchParams()` values (`view`, `departments`, `collection`, `sop`) are read as opaque strings and used only as lookup keys or `.eq()` filter values against RLS-scoped tables — no new validation library needed, but the existing `NO_MATCH_ID` sentinel pattern (`admin/sops/page.tsx:115`) for empty-array `.in()` queries must be preserved in any extracted action |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client component calls an admin-only server action directly, bypassing a since-removed page-level redirect gate | Elevation of Privilege | Every server action self-enforces its own role/org check (already true for `listGovernanceQueue`/`listOrgTree`/`listGrants`; must be true for any NEW action this phase extracts — see Pitfall 4) |
| A worker session's `/sops` bundle accidentally includes admin-lens JS (even if gated from *rendering*, the code still ships and could be inspected/invoked from devtools) | Information Disclosure | `next/dynamic({ ssr: false })` behind `useIsAdmin()` prevents the CHUNK from loading at all for non-admin roles (not just hiding rendered output) — this is why code-splitting, not conditional JSX alone, is required; confirmed by the existing bundle-gate's chunk-existence assertions checking the ACTUAL worker chunk set, not just DOM output |
| Cross-tenant data leak via a newly-extracted admin action that forgets `.eq('organisation_id', ...)` | Information Disclosure / Tampering | This codebase has a dedicated, mutation-proven lint guard for exactly this class: `tests/lint/rls-org-scope.spec.ts` (walks every migration, fails on unscoped policies) — any new TABLE touched by this phase's extracted actions should be checked against it, though this phase is not expected to add new tables |

## Sources

### Primary (HIGH confidence — direct code reads, this session)

- `src/app/(protected)/sops/page.tsx` (full file, 645 lines) — worker list, Miller frame, scope logic, dept filter, refresher/version-currency derivation
- `src/app/(protected)/admin/sops/page.tsx` (full file, 701 lines) — admin list, three views, deep-link filter resolution, Miller frame
- `src/components/sop/SopWorkerBrowser.tsx` (full file, 295 lines) — worker list+detail Miller columns
- `src/components/admin/SopMillerBrowser.tsx` (head, 60 lines) — admin list+detail Miller columns
- `src/components/layout/TopHeader.tsx` (full file, 389 lines) — nav links, `ADMIN_LINKS`, active-href matching
- `src/lib/auth/role-home.ts` (full file) — role → home route mapping
- `src/lib/auth/guards.ts` (full file) — `requireAdminContext`, `requireSopEditAccess`
- `src/lib/auth/session-context.ts` (full file) — `getSessionContext()`, ES256 JWT claims, org-aware membership lookup
- `src/app/(protected)/layout.tsx` (full file) — `RoleProvider` wiring
- `src/components/providers/RoleProvider.tsx` (full file) — `useRole()`, `useIsAdmin()`
- `src/lib/supabase/middleware.ts` (full file) — public-route list, no exemption needed for this phase
- `scripts/check-bundle-size.ts` (full file, 321 lines) — SB-LINE-06 gate mechanics, `findSymbolInBuildOutput` helper
- `scripts/capture-bundle-baseline.ts` (full file, 179 lines) — baseline capture mechanics
- `.bundle-baseline.json` — current baseline (`/sops/[sopId]/page` = 1059 KB)
- `src/hooks/useAssignedSops.ts`, `src/hooks/useSopSync.ts` (full files) — worker data layer, confirmed no admin coupling
- `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` (head, 60 lines) — `next/dynamic` precedent pattern
- `src/components/admin/wiring/WiringPatchBayShell.tsx`, `src/components/admin/governance/GovernanceQueueRow.tsx` (heads) — confirmed `'use client'`, already separable
- `tests/phase30/admin-nav.spec.ts`, `tests/phase30/dead-weight.spec.ts` (heads) — confirmed `AdminNav.tsx` deletion, reference-sweep pattern precedent
- `playwright.config.ts` (grep) — project registration pattern (`phase40`, `phase46` shown as most recent examples)
- `package.json` (grep) — `postbuild` script, `test`/`test:integration`/`test:e2e` commands
- `.planning/config.json` — `nyquist_validation: true`, no `security_enforcement` key (defaults enabled)
- Full-repo greps for `/admin/sops` (150 references across 38 files; 15 exact non-sub-route references enumerated in Summary/Common Pitfalls)
- `.claude/skills/sketch-findings-SOPstart/SKILL.md`, `references/layout-primitives.md` — confirmed the Miller-frame pattern predates this skill's written references (it shipped 2026-08 under sketch 005, not yet folded into the skill's findings index — the skill's routing note "surfaces whose sketches already shipped... code is the source of truth" applies here)

### Secondary (MEDIUM confidence)

- None — this phase required no external web research; all findings are direct codebase reads.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Rendering-model recommendation: HIGH — based on direct comparison of both existing implementations' actual code shape, not speculation
- Bundle gate mechanics: HIGH — script read in full, exact line numbers cited for the hardcoded-single-route limitation
- Nav/route inventory: HIGH — exhaustive grep across `src/`, cross-checked against `journeys.ts` and `uat/tests.ts`
- AdminNav non-existence correction: HIGH — confirmed by both `find`/`grep` absence and an existing passing test (`admin-nav.spec.ts`) asserting the deletion

**Research date:** 2026-09-13
**Valid until:** ~14 days (this is a fast-moving internal codebase with frequent same-week phase completions — re-verify file:line citations if planning is delayed past two weeks)
