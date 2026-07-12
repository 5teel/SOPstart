# Phase 30: UX Consolidation & Simplification - Research

**Researched:** 2026-07-12
**Domain:** Next.js 16 App Router frontend consolidation/refactor (no new features, no new packages)
**Confidence:** HIGH — all findings verified by direct codebase inspection this session

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **UX-01 One home per role.** Worker → /sops, supervisor + safety_manager → /activity, admin → /admin/sops. Delete the /dashboard page and remove "Dashboard" from all navs. Login redirect + middleware land each role on its home directly. PendingDashboard stub relocates (e.g. a minimal /pending or inline on /sops).
- **UX-02 One admin nav.** Single shared `<AdminNav>` component: SOPs · Governance · Blocks · Team · Settings. Departments folds under Team surface or Settings; AI Settings + approval-chain editor + agent layer live under Settings (or Settings groups them). Account menu → one "Admin" link to /admin/sops (admin/safety_manager only). Delete the 5 copy-pasted sub-navs.
- **UX-03 One governance surface.** Governance folds into /admin/sops as the "Needs attention" view with flag chips (Overdue / Due soon / Unowned / Stale role / Awaiting approval). GovernanceWidget and LibraryReviewCell removed as separate surfaces (their counts/actions live in the one list). Approval-chain config editor relocates to admin Settings. HARD CONSTRAINT: APR-03/APR-04 behaviour preserved — one-click Approve for the matching next approver from the queue rows AND from the builder PublishStage; awaiting-approval count + deep-link still exist (can live on /admin/sops header chips). Phase 28/29 server actions unchanged.
- **UX-04 One create entry.** Single "New SOP" button (on /admin/sops) → one method-picker screen: Upload a document (FIRST, per Visy "don't make create-from-scratch the headline") · Talk it through · Describe it · Start blank. Existing 3 intake routes can remain as destinations; all other create buttons/tiles/tabs removed (incl. worker /sops "Create SOP" tab → admins get to it via admin nav).
- **UX-05 Worker SOP detail 6 tabs → 3.** Read (Overview + Tools + Hazards merged into one scrollable brief; PPE + equipment render ONCE) · Walk it (walkthrough) · Flow (desktop-oriented). Delete Model tab entirely (until 3D ships). QR deep-links (?tab=…) must still land: old tab params map to the new tabs (tools/hazards → read, walkthrough → walk).
- **UX-06 Admin list rows one line.** Title · status chip · one flag chip · owner. Click → builder. The 5 icon-only actions (edit/assign/versions/video/qr) move into the builder as labelled actions (or a labelled action menu). SopDepartmentEditor + LibraryReviewCell leave the row. Fixes usability-lab F-09 (icon-only actions, WCAG).
- **UX-07 Plain-language pass.** Builder stages "Review / Builder / Publish" → "Check / Edit / Send to workers" (labels only; routes/state names unchanged). AI reviewer flag titles → plain outcomes (Made-up content / Missing content / Picture not linked to its step / Table may be scrambled / Wording changed) with human step names, never "block N" (usability-lab R-C1 table). Every icon action gets a visible label or persistent aria-label. Reversibility stated near publish ("You can unpublish or edit later"). Offline pill plain-languaged.
- **UX-08 Dead-weight sweep.** Delete: ModelTab + its tab entry, /sops/[sopId]/walkthrough route + layout (update any hrefs to ?tab=walkthrough), WalkthroughTab.tsx shim, BuilderWithSourceViewer.tsx, notifications bell (or point it somewhere real — deletion preferred), dashboard page (UX-01). Fix or remove the no-op department filter on worker /sops. Move /pathways + /uat links out of primary nav into the account menu (keep pages; they're team tooling).

### Constraints (verbatim)

- Zero regressions to: publish spine (parse → review → verify → publish), approval chains (APR-01..05), governance actions (confirmSopCurrent/setSopOwner), worker walkthrough + completions + offline, roster login.
- Bundle gate: /sops/[sopId] worker First Load JS ≤ +2 KB drift (tab merge should REDUCE it).
- journeys.ts MUST be updated in the same change for every rerouted/removed screen (CLAUDE.md pathways rule); /pathways "All screens" → 0 not-mapped.
- Existing phase28/phase29 Playwright suites must stay green (source-contract tests reference GovernanceWidget/LibraryReviewCell/queue files — those tests need repointing in the same plan that moves the code, per the 29-01 precedent).
- Grep for dead hrefs after every route removal (CLAUDE.md 2026-06-08 learning — dead Link/router.push = generic "This page couldn't load").
- Styling: new/touched components use CSS-var tokens (paper/ink + semantic accents), never hardcoded hex. Full §5 component consolidation (shared ListRow/FilterChips/Button across ALL pages) is OUT OF SCOPE for this phase — only pages already being touched get tokenised. Log the rest as backlog.

### Claude's Discretion

- Wave shape (CONTEXT suggests: 1 = UX-08 + UX-02 + UX-04; 2 = UX-01 + UX-07; 3 = UX-05 + UX-06; 4 = UX-03 + journeys sweep + gate) — planner may adjust.
- Where Departments folds (Team surface vs Settings); how Settings groups AI Settings / approval chains / agent layer.
- PendingDashboard relocation form (/pending page vs inline on /sops).
- Fix vs remove for the no-op worker department filter.

### Deferred Ideas (OUT OF SCOPE)

- Full design-system component consolidation across untouched pages (backlog).
- Any new features (search improvements, voice, notifications system).
- Training records / AI maintenance schedule (now Phase 31).
- Site/plant multi-tenant tier, identity model changes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | One home per role; delete /dashboard | §Current Wiring 1 + §Dead-Href Inventory A (35 references catalogued); JWT `user_role` claim available for middleware role-routing without DB call |
| UX-02 | One shared AdminNav | §Current Wiring 2 (all 5 sub-nav copies located with line numbers); no /admin/settings route exists — must be created |
| UX-03 | One governance surface | §Current Wiring 3 (all 3 surfaces + their server-action wiring); §Test Repointing (5 spec files pinned) |
| UX-04 | One create entry | §Current Wiring 4 (all 8 entry points located) |
| UX-05 | Worker 6 tabs → 3 | §Current Wiring 5 (SopTabNav contract, tab component sizes, PPE duplication lines); §Bundle Gate |
| UX-06 | One-line admin rows | §Current Wiring 6 (row anatomy in admin/sops/page.tsx lines 239-366) |
| UX-07 | Plain-language pass | §Plain-Language Sources (exact label locations: BuilderStageStepper.tsx:203-211, FlagBadge.tsx, OnlineStatusBanner.tsx:24, PublishStage) |
| UX-08 | Dead-weight sweep | §Current Wiring 7 (each deletion target verified: importers, test readers, layout.tsx confirmed present) |
</phase_requirements>

## Summary

This is a pure frontend consolidation over existing, working code. Zero new packages, zero migrations, zero server-action changes. The risk is entirely in three mechanical categories: (1) **dead references** — 35 code references to `/dashboard`, plus journeys.ts entries, plus route deletions; (2) **source-contract test breakage** — 9 spec files read the files being moved/deleted via `readFileSync` and must be repointed in the same plans; (3) **the bundle/chunk gates** on the worker route, which the tab merge intentionally shifts and which must be re-baselined via the existing script.

Everything else is label edits and component extraction. All governance/approval behaviour lives in server actions (`confirmSopCurrent`, `approveStep`, `listGovernanceQueue`) that are already imported by the components being relocated — moving the components does not touch the spine. Two pre-existing test failures were discovered on master in `tests/integration/scp-source-viewer.test.ts` (stale Phase-21 assertions broken by the Phase 26 Puck removal, never repointed) — Phase 30 verification must not misattribute these, and deleting `BuilderWithSourceViewer.tsx` will add failures to that file plus `scp-parse-pipeline.test.ts` unless repointed to `BuilderStageShell.tsx` (which carries all the migrated tokens: `showPane`, `ai_prompt`, verbatim logic).

**Primary recommendation:** Execute as an inventory-driven sweep: each plan carries its own dead-href grep list, its own test-repoint list, and its own journeys.ts edit — nothing is "done" until all three are in the same commit. Final gate = `npx tsc --noEmit` + `npm run build` (postbuild bundle check) + full Playwright suite + /pathways 0 not-mapped.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role-home routing (UX-01) | Frontend server (middleware + server actions) | — | Role read from JWT claim `user_role` (pattern already used in roster page + governance page via `parseJwtPayload`); no DB call needed in middleware |
| AdminNav / create picker / list rows (UX-02/04/06) | Client + server components | — | Pure render-layer; server pages keep their data fetching |
| Governance merge (UX-03) | Server components (`/admin/sops` is a server page; GovernanceWidget already a server comp) | Client rows (GovernanceQueueRow is `'use client'`) | `listGovernanceQueue()` callable from server page — same pattern as today |
| Tab merge (UX-05) | Client (`/sops/[sopId]` is `'use client'` with `useSearchParams`) | — | Tab state is URL search-param driven; no server involvement |
| Plain-language labels (UX-07) | Client render layer only | — | Labels/aria only; route paths, state unions, DB enum values unchanged |
| Deletions (UX-08) | Route tree + component tree | Serwist SW (stale cache on installed PWAs) | Deleting routes affects installed-client cached navigations — see Pitfall 9 |

## Standard Stack

No new libraries. Everything needed is already installed: Next.js 16 App Router, React 19, Tailwind 4 CSS-var tokens, Lucide icons, Playwright. `[VERIFIED: package.json in repo]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Middleware JWT-claim role routing | DB lookup in a `/home` dispatch route | DB call per login; the claim (`user_role`) is already in the JWT and already trusted by roster login + governance page |
| Shared `AdminNav` server-agnostic component | Layout-level nav in `src/app/(protected)/admin/layout.tsx` | An `admin/layout.tsx` renders nav once for ALL admin routes and kills the 14-page copy-paste at the layout level — strongly consider; but builder route may want full-bleed (no nav). Component + per-page mount is the safer minimal diff; layout is the cleaner end state. Planner's call |

## Package Legitimacy Audit

**No external packages are installed by this phase.** All work uses in-repo code and already-installed dependencies. No slopcheck run required. Packages removed: none. Packages flagged: none.

## Current Wiring (verified inventory)

### 1. UX-01 — Home/redirect wiring

- **`src/app/(protected)/dashboard/page.tsx` (127 ln):** redirects worker→`/sops`, supervisor→`/activity`, safety_manager→`/activity` (lines 24-26); renders `AdminDashboard` (6 DashTiles: new/ai, new/blank, upload, /admin/sops, /admin/blocks, /admin/team) for admin; `PendingDashboard` for `!role`. Header literally says "v3.0 / Closeout".
- **`src/lib/supabase/middleware.ts` line 41:** authed user on any auth route → `redirect('/dashboard')`. This is the only middleware redirect target to change. Role is obtainable without DB: `supabase.auth.getSession()` → `parseJwtPayload(access_token)['user_role']` (claim confirmed in use at `(auth)/login/roster/page.tsx:45` and `admin/governance/page.tsx:33-34`).
- **`src/actions/auth.ts`:** `redirect('/dashboard')` at lines 111 (signIn), 177 (joinWithInviteCode), 291 (acceptInvite). File is `'use server'` — a `roleHome(role)` helper CANNOT be exported from it (2026-06-27 learning: sync exports break `next build`). Put it in `src/lib/auth/` (e.g. `role-home.ts`).
- **`(auth)/login/roster/page.tsx:46`:** bounces admin/safety_manager/supervisor → `/dashboard`.
- **TopHeader:** `BASE_LINKS[0]` = Dashboard (line 147); brand link `href="/dashboard"` (line 225); `isActive` special-cases `/dashboard` (line 169).
- **Pending users (`!role`):** land nowhere sensible post-deletion. `/sops` shows misleading "No SOPs yet" for them. Minimal `/pending` page (relocate the 12-line `PendingDashboard` JSX) is the cheapest correct option.
- **Admin hitting `/activity`** falls through to `redirect('/dashboard')` (activity/page.tsx:30) → retarget to `/admin/sops`.

### 2. UX-02 — The 5 sub-nav copies + account menu

| Location | Lines | Idiom | Items |
|----------|-------|-------|-------|
| `admin/sops/page.tsx` | 155-171 | `className="tab"` nav | SOPs · Library · Team · Departments (NO Governance!) |
| `admin/governance/page.tsx` | 103-109 | `className="tab"` nav | SOPs · Library · Team · Departments · Governance |
| `admin/blocks/page.tsx` | ~100-118 | different Link styling | SOPs · Blocks · Team · Departments |
| `admin/team/page.tsx` | ~53-74 | different Link styling (+ line 90 `href="/dashboard"`) | SOPs · Blocks · Team · Departments |
| `admin/departments/page.tsx` | ~96-132 | third styling idiom | SOPs · Blocks · Team · Departments |

- Account menu `ADMIN_LINKS` (TopHeader:157-162): Manage SOPs · Blocks · Team · AI Settings → becomes one "Admin" link to `/admin/sops`.
- **No `/admin/settings` route exists.** UX-02 requires creating one to group: link to `/admin/ai-settings`, relocated `ApprovalChainEditor`, link to `/admin/agent` (currently a zero-inbound-link orphan), and possibly Departments. `/admin/agent` page has 3 inline `style={{}}` blocks (tokenise if touched).
- **Auth-guard copy-paste (duplicate #7):** the `if (!member || !['admin','safety_manager'].includes(member.role)) redirect('/dashboard')` block is verbatim in 14 admin pages. Retargeting `/dashboard` touches every one — a shared `requireAdminPage()` in `src/lib/auth/` collapses the sweep to one definition (recommended; NOT in actions/).

### 3. UX-03 — The three governance surfaces

- **`admin/governance/page.tsx` (145 ln):** fetches `listGovernanceQueue()`, renders `GovernanceFilterChips` (38 ln), `GovernanceQueueRow` list (112 ln — imports `confirmSopCurrent` + `approveStep` + `OwnerPicker`), and `ApprovalChainEditor` (315 ln) at the bottom with category/member data assembled in the page.
- **`GovernanceWidget.tsx` (60 ln):** SERVER component mounted on `/admin/sops` header (line 125). Counts overdue/unowned/due_soon/awaiting_approval from `listGovernanceQueue()`; deep-links `/admin/governance?filter=…`. After merge these deep-links must retarget to wherever the needs-attention view lives.
- **`LibraryReviewCell.tsx` (68 ln):** client comp on every admin library row; owner label + overdue badge + wired `confirmSopCurrent(sopId)`. Removed from rows per UX-06; its owner label moves into the one-line row; its Confirm-current action moves to the merged needs-attention rows (GovernanceQueueRow already has it).
- **Tension to resolve (planner decision):** UX-02's AdminNav includes a "Governance" item, but UX-03 folds governance INTO `/admin/sops`. Two coherent shapes: (a) AdminNav "Governance" deep-links `/admin/sops?view=attention` and the `/admin/governance` route becomes a redirect (keeps old deep-links + GovernanceWidget-era bookmarks alive); (b) `/admin/governance` route stays as the needs-attention rendering of the same shared list component. Option (a) matches "one list" most literally. Either way `tests/phase28/governance-queue.spec.ts` asserts journeys.ts maps `/admin/governance` — spec + journeys must change together.
- **Naming collision:** `/admin/sops` STATUS_TABS already has a tab literally labelled "Needs attention" (value `failed` = uploading/parsing statuses, page.tsx:24). The merged governance view must absorb or rename this — two different "Needs attention" filters on one page would recreate the exact confusion this phase kills.
- **Preserved verbatim (HARD constraint):** `approveStep` import in `GovernanceQueueRow.tsx:8` and in builder `PublishStage.tsx`; `confirmSopCurrent`; `setSopOwner` via `OwnerPicker`. Server actions in `src/actions/governance.ts` + `src/actions/approvals.ts` untouched.

### 4. UX-04 — The 8 create entries

| # | Entry | Location |
|---|-------|----------|
| 1-4 | Upload / Blank / AI Draft / 🎤 Voice Draft header buttons | `admin/sops/page.tsx:127-151` |
| 5 | Same 4 repeated in empty-state | `admin/sops/page.tsx:222-230` |
| 6 | 3 dashboard DashTiles (new/ai, new/blank, upload) | `dashboard/page.tsx:50-73` (dies with UX-01) |
| 7 | Worker /sops "Create SOP" tab → `/admin/sops/upload` | `sops/page.tsx:144-152` |
| 8 | (upload/new/blank/new/ai pages link back to `/admin/sops` — those are back-links, fine) | |

Destinations that remain: `/admin/sops/upload`, `/admin/sops/new/ai` (also `?mode=voice` for Talk-it-through), `/admin/sops/new/blank`. Method picker = new screen (suggest `/admin/sops/new`) with 4 options, Upload FIRST.

### 5. UX-05 — Worker tab merge

- **`SopTabNav.tsx` (49 ln):** exports `SOP_TABS = ['overview','tools','hazards','flow','model','walkthrough']`, `SopTabId`, `isSopTabId`, `useActiveTab` (default `'overview'`). Tab switch = `router.push('?tab=…', {scroll:false})` — NOTE the 2026-05-13 learning says search-param router.push triggers an RSC fetch under Serwist; since the page is fully client, consider `history.replaceState` pattern while touching this, but that's discretionary.
- **New contract:** tabs `['read','walk','flow']`; legacy mapping in `useActiveTab`: `overview|tools|hazards|model → read`, `walkthrough → walk` (QR/old deep-links keep landing). Old param values must remain accepted forever — printed QR codes encode `${siteUrl}/sops/${id}` with no tab (qr/page.tsx:43), so QR risk is actually nil; the mapping covers bookmarks/shared links.
- **Tab components:** OverviewTab 116 ln (has the phase28-spec-guarded "Current as of" caption, line 55), ToolsTab 126 ln, HazardsTab 160 ln — `isPpeSection` is copy-pasted in ToolsTab:9 and HazardsTab:17 (the PPE double-render). FlowTab 345 ln (keep as Flow). ModelTab 26 ln (delete). WalkthroughTab 5 ln shim (delete; nothing imports it except `tabs/index.ts`).
- **Render switch:** `sops/[sopId]/page.tsx:92-97`. Walkthrough renders via `WalkthroughSwitcher` (dynamic-imports DesktopWalkthrough + voice modal).
- **Merged Read tab must:** render PPE once, equipment once, keep "Current as of" caption (phase28 spec asserts it), keep the D28-07 invariant (NO review_due_at/owner gate on worker routes — phase28 spec greps for its absence).

### 6. UX-06 — Admin row anatomy (admin/sops/page.tsx:239-366)

Current per-row: title + sop_number/category/date + source-type pills + confidence chip + NEEDS-REVIEW chip + StatusBadge + `SopDepartmentEditor` strip + `LibraryReviewCell` strip + `VideoJobIndicator` + 5 icon-only actions (Pencil/Users/History/Video/QrCode, published) or Pencil+`DeleteSopButton` (draft). Whole card links to builder already.
New row: Title · status chip · ONE flag chip · owner; click → builder. The 5 actions become labelled actions in the builder (suggest a labelled action menu in BuilderStageShell header — it already owns the `/admin/sops` back-link at BuilderClient.tsx:205). `SopDepartmentEditor` (71 ln) leaves the row — natural landing: the assign page (`/admin/sops/[sopId]/assign` already owns "who sees this"), reachable via the builder's labelled "Assign" action. Delete action must survive somewhere for drafts (builder action menu).

### 7. UX-08 — Deletion targets, verified

| Target | Verified state |
|--------|----------------|
| `ModelTab.tsx` (26 ln) | Only importers: `tabs/index.ts` + page render switch |
| `/sops/[sopId]/walkthrough/` page.tsx + layout.tsx | Both files confirmed present; page is pure redirect; only in-repo reference to the route is itself + journeys.ts (4 entries) + phase28 spec reads the file |
| `WalkthroughTab.tsx` (5 ln shim) | Only importer: `tabs/index.ts` |
| `BuilderWithSourceViewer.tsx` | ZERO real importers (comments only). BUT read by `tests/integration/scp-source-viewer.test.ts` (existsSync line 63 + readFile line 181) and `scp-parse-pipeline.test.ts` (readFile line 55, SCP-PARSE-03). Repoint to `BuilderStageShell.tsx` which contains the same tokens (`showPane`:104, `ai_prompt`:101; SourceViewerPane dynamic import lives in the shell chain) |
| Notifications bell | TopHeader:258-278 (fake — links to /sops). `NotificationBadge` stays: BottomTabBar uses it legitimately |
| `/dashboard` page | See §1 |
| No-op dept filter | `sops/page.tsx:93-101` — filter callback literally `return true` with a TODO to extend `useAssignedSops`. The DepartmentSidebar/BottomSheet UI is live and looks functional. Fix = fetch `sop_departments` for assigned SOP ids client-side and filter (small); Remove = hide the sidebar/sheet/pill. Either beats shipping a placebo |
| /pathways + /uat links | `BASE_LINKS` (TopHeader:150-151) → move to account menu |
| `/admin/agent` | NOT deleted — orphan gets a home under Settings (UX-02) |

## Dead-Href Sweep Inventory

### A. `/dashboard` (35 references — complete grep, 2026-07-12)

Code: `middleware.ts:41` · `actions/auth.ts:111,177,291` · `roster/page.tsx:46` · `activity/page.tsx:30` · `activity/[completionId]/page.tsx:49` · `lib/auth/platform-admin-guard.ts:27` · `TopHeader.tsx:147,169,225` · `admin/team/page.tsx:33,43,90` · 12 more admin pages each with one guard `redirect('/dashboard')` (agent, departments, sops, blocks, blocks/[blockId], governance, ai-settings, builder/[sopId], sops/[sopId]/video, sops/[sopId]/qr, new/blank, new/ai, pipeline/[pipelineId], upload). Journeys: `journeys.ts:62,98,117,131,224` · `roles.ts:49,100`.

### B. `/sops/[sopId]/walkthrough` — journeys.ts:78,138,149,160,298 (no code hrefs exist; route is only reached via redirect page itself)

### C. `/admin/governance` — `GovernanceWidget.tsx:35,41,47,53` (four `?filter=` deep-links) · `governance/page.tsx:108` (self sub-nav) · `journeys.ts:460`

### D. Tab params — no `?tab=` links exist anywhere outside `SopTabNav` itself and the walkthrough redirect. QR encodes bare `/sops/{id}`.

### E. Create entries — see §4 table.

**Sweep command per removal (per CLAUDE.md 2026-06-08):** `grep -rn "<old-path-fragment>" src tests` and repoint every hit in the same commit.

## Test Repointing Inventory (per file — the 29-01 precedent)

| Spec file | Reads (via readFileSync/existsSync) | Phase 30 impact |
|-----------|--------------------------------------|-----------------|
| `tests/phase28/governance-queue.spec.ts` (11 tests) | `admin/governance/page.tsx`, `GovernanceQueueRow.tsx`, `GovernanceFilterChips.tsx`, `OwnerPicker.tsx`, `journeys.ts` (asserts /admin/governance mapped) | UX-03: repoint page path if route folds; journeys assertion must track the new mapping |
| `tests/phase28/library-and-worker.spec.ts` (12 tests) | `admin/sops/page.tsx`, `LibraryReviewCell.tsx`, `GovernanceWidget.tsx`, `OverviewTab.tsx` ("Current as of" + no-gate), `sops/[sopId]/walkthrough/page.tsx` (no-gate), `sops/[sopId]/page.tsx` | UX-03/05/06/08: LibraryReviewCell + GovernanceWidget deleted → assertions move to the merged surface; OverviewTab → merged Read tab; walkthrough page deleted → drop/repoint that no-gate check |
| `tests/phase29/queue-approve-action.spec.ts` (9 tests) | `GovernanceQueueRow.tsx`, `GovernanceFilterChips.tsx`, `GovernanceWidget.tsx` | UX-03: repoint Widget assertions to the header-chips replacement; QueueRow/Chips survive relocation (keep file paths stable if components merely re-mount elsewhere) |
| `tests/phase29/approval-chain-editor.spec.ts` (7 tests) | `ApprovalChainEditor.tsx`, `admin/governance/page.tsx` (asserts editor mounted there + NO /admin/governance/approval-chains route) | UX-03: editor relocates to Settings → both assertions repoint |
| `tests/phase29/phase-gate.spec.ts` (13 tests) | `GovernanceQueueRow.tsx`, `ApprovalChainPanel.tsx`, publish route, actions, versions page, migration | Mostly stable (actions unchanged); QueueRow read survives if file path unchanged |
| `tests/phase26.5/agent-dashboard.spec.ts` | `admin/agent/page.tsx` — line 25 asserts `redirect('/dashboard')` present | UX-01: assertion must change with the retargeted guard |
| `tests/e2e/admin-departments.spec.ts` | line 141-143 asserts departments page guards contain 'dashboard' | UX-01: repoint |
| `tests/integration/departments-rls.spec.ts` | RUNTIME navigation to `/dashboard` (line 148) | UX-01: navigate to a real route instead |
| `tests/integration/scp-source-viewer.test.ts` | **ALREADY FAILING on master (2/5)** — SCP-VIEWER-01 asserts builder page.tsx contains 'BuilderWithSourceViewer' (it doesn't since Phase 26) and SCP-VIEWER-03 asserts registerBlockClickHandler in BuilderClient. Also existsSync + readFile on `BuilderWithSourceViewer.tsx` | UX-08 deletion adds failures; repoint all BuilderWithSourceViewer reads to `BuilderStageShell.tsx` and fix the 2 stale assertions while there (pre-existing debt, cheap to clear in the same plan) |
| `tests/integration/scp-parse-pipeline.test.ts` | SCP-PARSE-03 readFile on `BuilderWithSourceViewer.tsx` | UX-08: repoint to BuilderStageShell (tokens `SourceViewerPane`, `dynamic(` present in shell chain — verify exact file at repoint time) |

**Playwright registration (2026-05-25 learning):** new `tests/phase30/*.spec.ts` needs a project in `playwright.config.ts` — follow the phase28/29 precedent: `{ name: 'phase30', testMatch: /tests\/phase30\/.*\.(spec|test)\.ts$/ }` (deliberately broad). Verify with `npx playwright test --list --project=phase30`.

## Plain-Language Sources (UX-07 — labels only)

| What | Exact location | Current → New |
|------|----------------|----------------|
| Builder stage chips | `BuilderStageStepper.tsx:203-211` (two `StageChip[]` arrays) | `'Build'→'Edit'`, `'Review & verify'→'Check'`, `'Publish'→'Send to workers'`. The `BuilderStage` union `'build'|'review'|'publish'` and stage routing UNCHANGED. aria-label `Go to ${chip.label} stage` inherits automatically |
| AI reviewer flag titles | `FlagBadge.tsx` — currently shows raw `flag.kind` in title attr + severity + AI-written `flag.description` | Add a `KIND_LABEL: Record<ReviewerFlagKind,string>` map: hallucination→'Made-up content', omission→'Missing content', anchoring→'Picture not linked to its step', table_fidelity→'Table may be scrambled', terminology→'Wording changed'. Kinds enumerated in `src/lib/parsers/ai-reviewer/types.ts:19-24`. UI-side mapping only — flag rows are stored data; do NOT touch job prompts (would only affect future parses and risks the reviewer contract) |
| "block N" ban | Flag display components (`FlagBadge`, `ReviewerFlagsPanel`, `AdversarialFlagBanner`) | Render human step/section names from block context, never raw block ids |
| Offline pill | `OnlineStatusBanner.tsx:24` "Offline — changes saved locally" | Plain-language variant (e.g. "No internet — your work is saved on this device") |
| Reversibility near publish | `PublishStage.tsx` (also has 9 inline `style={{}}` — tokenise while touching) | Add "You can unpublish or edit later" near the publish button |
| Icon labels | `admin/sops/page.tsx` icon actions already have title+aria-label; UX-06 makes them labelled anyway | Sweep any remaining icon-only buttons on touched pages |

## Bundle Gate Mechanics (UX-05)

- `package.json` `postbuild` → `tsx scripts/check-bundle-size.ts`. Two HARD-FAIL contracts: (1) First Load JS for `/sops/[sopId]/page` ≤ baseline + 2 KB (`.bundle-baseline.json`, current baseline **1057 KB**, captured 2026-07-06); (2) chunk-existence — `DesktopWalkthrough` AND `WalkthroughVoiceModal` must appear as separate dynamic chunks (backed by `tests/lint/no-static-desktop-import.spec.ts`).
- Tab merge deletes ModelTab + WalkthroughTab shim and merges 3 tabs → expect a REDUCTION. After the intentional shift, re-capture: `npx tsx scripts/capture-bundle-baseline.ts` (commit the regenerated `.bundle-baseline.json`; never hand-edit).
- **Trap:** the merged Read tab must not statically import anything from `components/sop/walkthrough/` — keep all walkthrough mounting behind `WalkthroughSwitcher`.

## journeys.ts Impact (same-commit rule)

`src/lib/journeys/journeys.ts` (536 ln) + `roles.ts` (185 ln). Entries touching changed routes: `/dashboard` (journeys 62, 98, 117, 131, 224; roles 49, 100 `landsOn`), `/sops/[sopId]/walkthrough` (78, 138, 149, 160, 298 → route becomes `/sops/[sopId]` with Walk tab), `/admin/governance` (460), `/admin/agent` (410 — gains its Settings home), `/admin/ai-settings` (235), `/admin/departments` (480), tab list description (133 — "Tabs: overview, tools, hazards, flow, model, walkthrough"), plus new screens (method picker, /admin/settings, /pending). The `/pathways` "All screens" panel auto-derives from the route tree and flags unmapped screens — post-phase check must show **0 not-mapped**. `tests/lint/no-global-blocks-in-journeys.spec.ts` also reads journeys.ts (content guard, unlikely affected).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role→home mapping | Per-callsite ternaries | ONE `roleHome(role)` in `src/lib/auth/role-home.ts` imported by middleware + auth.ts + guards | 20+ callsites; divergence = users landing in different places from different doors |
| Admin auth guard | Keep 14 copies with retargeted strings | `requireAdminPage()` helper (session client, returns role or redirects to `roleHome`) | The retarget sweep touches all 14 anyway; consolidating is the same diff size and kills duplicate #7 |
| Tab param migration | Per-link rewrites | Legacy-param mapping inside `useActiveTab`/`isSopTabId` | One choke point already exists; old params then work everywhere forever |
| Governance list | New needs-attention list component | Existing `GovernanceQueueRow` + `GovernanceFilterChips` re-mounted | They already wire confirmSopCurrent/approveStep/OwnerPicker — the HARD constraint is preserved by reuse, violated by rewrite |

## Runtime State Inventory (refactor phase — required)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No DB renames: `sops.status` values, `BuilderStage` union, reviewer `kind` strings, approval-chain rows all unchanged (labels are render-time only) | None — verified by scoping UX-07 to labels |
| Live service config | None. Railway env unchanged; no new routes need middleware exemptions (no cookie-less routes added) | None |
| OS-registered state | None | None |
| Secrets/env vars | None touched | None |
| Build artifacts | `.bundle-baseline.json` (committed) becomes stale after tab merge — regenerate via `scripts/capture-bundle-baseline.ts`. Installed-PWA Serwist caches may hold the deleted `/dashboard` + `/walkthrough` route chunks until SW update | Re-baseline in the tab-merge plan; see Pitfall 9 for stale-client navigation |

## Common Pitfalls

1. **Dead hrefs after route removal** (repo has NO `not-found.tsx` — a dead link shows the bare "This page couldn't load" screen). Prevention: the per-plan grep inventory above; consider adding an app-level `not-found.tsx` in this phase (one small file, directly serves the "never confuse the user" vision and the 2026-06-08 learning's own recommendation).
2. **Green stubs ≠ done.** Source-contract tests verify token presence, not wiring (2026-06-05). Every relocated action (Approve on queue rows, Confirm current, the builder action menu) needs its handler-wiring asserted (onClick references the action), and code review must not be skipped.
3. **`'use server'` sync exports.** `roleHome` / label maps must live in `src/lib/`, never exported from `src/actions/*` (breaks `next build`, invisible to tsc — 2026-06-27).
4. **`npm run build` is the real gate.** tsc-green is necessary, not sufficient; the phase touches `src/actions/`-adjacent files and the bundle gate only runs postbuild.
5. **Unregistered specs never run.** Register `tests/phase30/` in playwright.config.ts and verify with `--list` (2026-05-25).
6. **"Needs attention" collision** on /admin/sops STATUS_TABS (`failed` = uploading/parsing) vs the new governance view — must be merged/renamed, not coexisting.
7. **Pre-existing failures:** `scp-source-viewer.test.ts` fails 2/5 on master today. Record this in the phase's Wave 0 baseline so verification doesn't misattribute; fix while repointing (cheap).
8. **Middleware role read:** don't add a DB query to middleware (runs on every request). Parse the JWT claim with the shared `parseJwtPayload` (never raw `atob` — Base64URL, 2026-06-26).
9. **Stale installed PWAs:** clients with the old service worker may navigate to `/dashboard` or `/walkthrough` from cached UI until the SW updates. Deletion is still correct (both were internal-only URLs); `not-found.tsx` (pitfall 1) turns the worst case into a navigable message.
10. **GovernanceWidget is a server component** — its replacement header chips on /admin/sops must stay server-rendered (the page is a server component; `listGovernanceQueue()` is already called there via the widget today, so cost is identical).
11. **`useSearchParams` needs Suspense** — SopTabNav consumers already wrap in `<Suspense>`; keep that when restructuring the detail page or `next build` errors.

## State of the Art (repo-internal)

| Old | Current | Impact |
|-----|---------|--------|
| `.planning/REQUIREMENTS.md` maps Phase 30 → TRN-01..03 + REV-05; STATE.md "Current focus: Phase 30 — Training Records" | Simon's 2026-07-12 directive re-scoped Phase 30 to UX consolidation; training records → Phase 31 | CONTEXT.md is authoritative for this phase. ROADMAP/REQUIREMENTS/STATE phase-mapping rows should be updated when the phase is planned (else the traceability table lies) |
| Puck editor (Phase ≤25) | Bespoke builder (Phase 26); `BuilderWithSourceViewer` superseded by `BuilderStageShell` | Enables the UX-08 deletion; explains the stale scp-* assertions |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JWT reliably carries `user_role` for all authed users (workers via roster included) | UX-01 middleware routing | If any auth path mints a token without the claim, that user gets a fallback home — mitigate with a safe default (`/sops`) when claim absent |
| A2 | `BuilderStageShell.tsx` (or its chain) contains all tokens the scp-* tests need after repointing (`SourceViewerPane`, `dynamic(`, `showPane`, `ai_prompt` — first two verified in the shell's import chain, not the shell file itself) | Test repointing | Repointed assertion needs a different target file (ReviewStation/BuilderClient); verify at edit time |
| A3 | Tab merge reduces (or holds) First Load JS | Bundle gate | If merge somehow grows the route, re-baseline is still legitimate (intentional shift) but must be justified in the plan |

## Open Questions

1. **Governance nav item vs folded surface (UX-02 ↔ UX-03).** Recommendation: AdminNav "Governance" → `/admin/sops?view=attention`; `/admin/governance` becomes a `redirect()` page (kills 4 GovernanceWidget-era deep-link targets and old bookmarks safely, minimal test churn). Planner should lock one shape before writing plans.
2. **Where the 5 row actions land in the builder** (labelled action menu in BuilderStageShell header vs a strip on the Publish/"Send to workers" stage). Menu in the shell header is reachable in every stage — recommended.
3. **Dept filter: fix or remove.** The TODO says extend `useAssignedSops`. A client-side `sop_departments` fetch + filter is ~20 lines; removal is ~40 lines of deletion (sidebar, sheet, pill, state). Fix is the smaller honest diff if the RLS-side data is queryable by workers; verify `sop_departments` SELECT policy (`using(true)` per the 2026-06-15 learning) before choosing.

## Environment Availability

No external dependencies. Node 20+, npm, Playwright, tsx all in-repo and exercised by existing gates. Nothing to probe.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (source-contract + integration projects in `playwright.config.ts`) |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test --project=phase30` |
| Full suite command | `npm run test` then `npx tsc --noEmit` then `npm run build` (postbuild = bundle gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | roleHome mapping + middleware/auth redirects + /dashboard absent + zero '/dashboard' strings in src | source-contract + grep sweep | `npx playwright test tests/phase30/role-homes.spec.ts --project=phase30` | ❌ Wave 0 |
| UX-02 | AdminNav exists with 5 items; every admin page mounts it; zero inline "Admin sections" navs | source-contract | `npx playwright test tests/phase30/admin-nav.spec.ts` | ❌ Wave 0 |
| UX-03 | needs-attention view renders QueueRow/chips; approveStep wired in QueueRow AND PublishStage; awaiting count+deep-link present; repointed phase28/29 suites green | source-contract + regression | `npx playwright test --project=phase28 --project=phase29 --project=phase30` | ✅ (phase28/29) + ❌ repoints |
| UX-04 | exactly one New SOP entry; method picker with Upload first; no stray create links (grep sweep over src for upload/new/ai/new/blank hrefs outside picker+nav) | source-contract + grep sweep | `npx playwright test tests/phase30/create-entry.spec.ts` | ❌ Wave 0 |
| UX-05 | SOP_TABS === ['read','walk','flow']; legacy param mapping unit-tested (all 6 old values land); ModelTab absent; PPE rendered once (single isPpeSection usage); bundle + chunk gates | source-contract + unit + build gate | `npx playwright test tests/phase30/tab-merge.spec.ts` + `npm run build` | ❌ Wave 0 |
| UX-06 | row contains no SopDepartmentEditor/LibraryReviewCell/icon-only Links; builder contains labelled actions wired to the 5 destinations | source-contract (assert handler/href wiring, not just tokens) | `npx playwright test tests/phase30/list-rows.spec.ts` | ❌ Wave 0 |
| UX-07 | stage chip labels = Edit/Check/Send to workers; KIND_LABEL map has the 5 plain titles; publish reversibility copy present; offline pill copy | source-contract | `npx playwright test tests/phase30/plain-language.spec.ts` | ❌ Wave 0 |
| UX-08 | deleted files existsSync=false; zero dead-href strings (per-target grep list); journeys.ts contains no removed routes; /pathways 0 not-mapped (journeys route-coverage assertion) | source-contract + grep sweep | `npx playwright test tests/phase30/dead-weight.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase30` + `npx tsc --noEmit`
- **Per wave merge:** add `--project=phase28 --project=phase29 --project=phase21-stubs` (the repointed suites) + `npm run build`
- **Phase gate:** full `npm run test` green (minus documented pre-existing scp failures if not fixed), `npm run build` clean incl. bundle gate, /pathways 0 not-mapped, dead-href greps empty.

### Wave 0 Gaps
- [ ] `tests/phase30/` directory + the 6 spec files above
- [ ] `playwright.config.ts` phase30 project registration (verify via `--list`)
- [ ] Baseline record of the 2 pre-existing `scp-source-viewer` failures (or fix them in Wave 0 — recommended, ~4 line repoint)

## Security Domain

Refactor phase — no new trust boundaries. Applicable checks:

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V4 Access Control | yes | Every retargeted guard keeps the `['admin','safety_manager']` gate; `requireAdminPage()` consolidation must not weaken any page's check (assert per-page in phase30 specs). Middleware role-home routing is a REDIRECT decision only — never an access grant |
| V3 Session Management | yes | JWT claim parsing via shared `parseJwtPayload` (Base64URL-safe), never raw `atob` |
| V5 Input Validation | no new inputs | Method picker + legacy tab mapping validate against closed unions (existing pattern) |

Known threat pattern for this phase: none new — no service-role usage, no new API routes, no cookie-less routes (so no middleware exemption changes).

## Sources

### Primary (HIGH confidence — direct codebase reads, 2026-07-12)
- All `src/` files cited with line numbers above (TopHeader, BottomTabBar, dashboard, middleware, auth actions, SopTabNav, worker sops pages, admin sops/governance pages, governance components, tab components, BuilderStageStepper/Shell, FlagBadge, reviewer types, journeys/roles, qr page, roster page, OnlineStatusBanner, protected layout)
- `playwright.config.ts`, `package.json`, `.bundle-baseline.json`, `scripts/check-bundle-size.ts`
- `tests/phase28/*`, `tests/phase29/*`, `tests/integration/scp-*`, `tests/phase26.5/agent-dashboard.spec.ts`, `tests/e2e/admin-departments.spec.ts`, `tests/lint/*` — assertion targets extracted
- Live test run: `npx playwright test tests/integration/scp-source-viewer.test.ts` → 2 failed / 3 passed on master
- `.planning/phases/30-ux-consolidation/30-CONTEXT.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `graphify-out/GRAPH_REPORT.md`

### Secondary / Tertiary
- None needed — no external technology questions in scope.

## Metadata

**Confidence breakdown:**
- Current wiring inventory: HIGH — every claim from direct file reads with line numbers
- Test repointing inventory: HIGH — spec file paths extracted from the specs themselves; one live run confirmed pre-existing failures
- Recommendations (governance shape, dept filter, action menu placement): MEDIUM — flagged as planner decisions with tradeoffs

**Research date:** 2026-07-12
**Valid until:** any commit that touches the inventoried files (re-grep before executing; this is a moving codebase)
