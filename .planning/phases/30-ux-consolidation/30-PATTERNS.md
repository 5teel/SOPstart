# Phase 30: UX Consolidation - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 14 new/heavily-modified surfaces
**Analogs found:** 13 / 14 (all in-repo; no external patterns needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/admin/AdminNav.tsx` (NEW) | component (nav) | request-response | sub-nav JSX in `src/app/(protected)/admin/sops/page.tsx:154-171` + `TopHeader.tsx` link map | exact |
| `src/app/(protected)/admin/sops/new/page.tsx` (NEW, method picker) | page (server) | request-response | `DashTile` grid in `src/app/(protected)/dashboard/page.tsx:47-126` + intake shell `admin/sops/new/ai/page.tsx` | exact |
| `src/components/sop/tabs/ReadTab.tsx` (NEW, merged Overview+Tools+Hazards) | component | transform (props → render) | `src/components/sop/tabs/HazardsTab.tsx` + `ToolsTab.tsx` (isPpeSection dedupe target) | exact |
| `src/components/sop/SopTabNav.tsx` (MODIFY, 6→3 tabs + legacy param map) | component (client nav) | request-response | itself — `SOP_TABS` const + `isSopTabId` guard | exact |
| `src/app/(protected)/admin/sops/page.tsx` (MODIFY, governance fold + one-line rows) | page (server) | CRUD-read | itself + `admin/governance/page.tsx` query merge + `GovernanceFilterChips.tsx` | exact |
| `src/components/admin/governance/GovernanceFilterChips.tsx` (MODIFY, href repoint) | component | request-response | itself + STATUS_TABS idiom in `admin/sops/page.tsx:174-195` | exact |
| `src/app/(protected)/admin/settings/page.tsx` (NEW or grouped Settings surface) | page (server) | CRUD-read | `src/app/(protected)/admin/ai-settings/page.tsx` (61 ln, cleanest admin page shell) | exact |
| `src/actions/auth.ts` + `middleware.ts` (MODIFY, role-home redirects) | server action / middleware | request-response | role switch in `dashboard/page.tsx:22-26` (the logic MOVES here) | exact |
| `src/app/(protected)/sops/page.tsx` (MODIFY, remove Create tab, fix/remove dept filter) | page | CRUD-read | itself (no-op filter at lines 95-101, Create SOP tab at ~150) | exact |
| Builder labelled-action menu (MODIFY builder shell) | component | request-response | icon-action column in `admin/sops/page.tsx:306-350` (actions move here WITH labels) | exact |
| `PublishStage.tsx` / `BuilderStageShell.tsx` (MODIFY, plain-language + tokens) | component | request-response | token classes in `admin/sops/page.tsx` / `GovernanceQueueRow.tsx` (replace inline `style={{}}`) | exact |
| `tests/phase30/*.spec.ts` (NEW) + phase28/29 repoints | test | file-I/O (source-contract) | `tests/phase28/governance-queue.spec.ts` | exact |
| `src/lib/journeys/journeys.ts` (MODIFY) | config | n/a | itself — same-change rule per CLAUDE.md | exact |
| `/pending` stub (NEW, optional) | page | request-response | `PendingDashboard` in `dashboard/page.tsx:90-101` (relocate verbatim) | exact |

## Pattern Assignments

### `src/components/admin/AdminNav.tsx` — shared admin nav (UX-02)

**Analog:** the copy-pasted sub-nav in `src/app/(protected)/admin/sops/page.tsx:154-171` (the `.tab` idiom to keep) + `NavLink` array pattern from `src/components/layout/TopHeader.tsx:138-162`.

**Nav markup to copy** (`admin/sops/page.tsx:154-171`):
```tsx
<nav aria-label="Admin sections" className="flex gap-1 border-b border-[var(--ink-100)] mb-6">
  <Link href="/admin/sops" className="tab" data-active="true">SOPs</Link>
  <Link href="/admin/blocks" className="tab">Library</Link>
  ...
</nav>
```
Convert `data-active` to derived state — either accept an `active` prop (server-rendered pages pass their own key, simplest) or make it a client component using `usePathname()` + the `isActive` helper from `TopHeader.tsx:168-171`:
```tsx
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
```

**Link data shape** (`TopHeader.tsx:157-162`) — replace with the new 5 items (SOPs · Governance-as-filter · Blocks · Team · Settings):
```tsx
const ADMIN_LINKS: NavLink[] = [
  { label: 'Manage SOPs', href: '/admin/sops' },
  { label: 'Blocks', href: '/admin/blocks' },
  { label: 'Team', href: '/admin/team' },
  { label: 'AI Settings', href: '/admin/ai-settings' },  // → becomes single 'Settings'
]
```
TopHeader account menu collapses this array to one "Admin" link (`/admin/sops`), gated by `isAdminRole(role)` (`TopHeader.tsx:164-166`). Also: `BASE_LINKS` (`TopHeader.tsx:146-152`) loses `Dashboard`/`Pathways`/`Feedback` — Pathways+UAT move into the account-menu block (`TopHeader.tsx:306-324` menuitem pattern). Notifications bell to delete: `TopHeader.tsx:258-278` (+ `NotificationBadge` import line 7).

**Sub-nav deletion sweep:** grep `aria-label="Admin sections"` — 5 copy-paste sites; replace each with `<AdminNav active="…" />`.

---

### `src/app/(protected)/admin/sops/new/page.tsx` — method picker (UX-04)

**Analog:** `DashTile` in `dashboard/page.tsx:103-126` (tile component, being deleted from dashboard — lift it here) + server-page shell of `admin/sops/new/ai/page.tsx`.

**Tile pattern** (`dashboard/page.tsx:114-125`):
```tsx
<Link href={href} className="blueprint-frame block transition-shadow hover:shadow-[0_0_0_1px_var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2">
  <p className="mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.08em] mb-2">{eyebrow}</p>
  <h3 className="text-base font-semibold text-[var(--ink-900)] mb-1">{title}</h3>
  <p className="text-sm text-[var(--ink-500)]">{description}</p>
</Link>
```
Four tiles in order (Visy: upload first): `/admin/sops/upload` · `/admin/sops/new/ai?mode=voice` (Talk it through) · `/admin/sops/new/ai` (Describe it) · `/admin/sops/new/blank`. The `?mode=voice` deep-link is already honoured by `AiDraftTabs.tsx:27` (`useState<Mode>(search.get('mode') === 'voice' ? 'voice' : 'type')`).

**Buttons to delete and repoint to one "New SOP" → `/admin/sops/new`:** `admin/sops/page.tsx:126-151` (4 header buttons) and 221-231 (empty-state buttons); dashboard tiles (whole page dies, UX-01); worker "Create SOP" tab at `sops/page.tsx:~150`.

---

### `src/components/sop/tabs/ReadTab.tsx` — merged worker Read tab (UX-05)

**Analog:** `ToolsTab.tsx` + `HazardsTab.tsx` + `OverviewTab.tsx` (concatenate their render sections; render PPE ONCE).

**The duplication to collapse** — `isPpeSection` is copy-pasted verbatim in `ToolsTab.tsx:9-13` and `HazardsTab.tsx:17-21`:
```tsx
function isPpeSection(s: SopWithSections['sop_sections'][number]) {
  const rf = s.section_kind?.render_family
  if (rf === 'ppe') return true
  const text = (s.section_type + ' ' + s.title).toLowerCase()
  return PPE_KEYWORDS.some((kw) => text.includes(kw))
}
```
ReadTab keeps ONE copy; equipment sections likewise render once (currently Overview AND Tools).

**Tab registry** — `SopTabNav.tsx:5-15` shrinks to:
```tsx
export const SOP_TABS = ['read', 'walk', 'flow'] as const
```
QR deep-link compat lives in `useActiveTab()`/`isSopTabId` (`SopTabNav.tsx:17-25`): map legacy params before the guard — `overview|tools|hazards → read`, `walkthrough → walk`, `model → read`. Keep the existing `router.push('?tab=…', { scroll: false })` handler shape (lines 32-37). Delete `ModelTab.tsx`, `WalkthroughTab.tsx`, and their `tabs/index.ts` exports; delete `/sops/[sopId]/walkthrough/` route+layout and grep `"/walkthrough"` for dead hrefs (CLAUDE.md 2026-06-08).

---

### `src/app/(protected)/admin/sops/page.tsx` — governance fold + one-line rows (UX-03/UX-06)

**Analogs:** itself + `admin/governance/page.tsx` (its `listGovernanceQueue` call + flag counts move in) + `GovernanceQueueRow.tsx` (action wiring).

**Filter chips pattern to extend** — reuse the STATUS_TABS idiom (`admin/sops/page.tsx:174-195`, `className="tab" data-active=…` linking `?status=`) and the chip+count render from `GovernanceFilterChips.tsx:22-35`:
```tsx
<Link href={`/admin/governance?filter=${chip.value}`} className="tab" data-active={isActive ? 'true' : undefined}>
  {chip.label} <span className="mono text-[11px] text-[var(--ink-500)]">({counts[chip.value]})</span>
</Link>
```
Repoint hrefs `/admin/governance?filter=` → `/admin/sops?attention=` (or fold into `?status=`). Awaiting-approval count + deep-link = a header chip on this page (HARD CONSTRAINT).

**Preserve exactly — GovernanceQueueRow approve wiring** (`GovernanceQueueRow.tsx:49-59, 84-92`), do not reimplement:
```tsx
function handleApprove() {
  setError(null)
  startTransition(async () => {
    const result = await approveStep(row.id)
    if ('error' in result) { setError(result.error); return }
    router.refresh()
  })
}
// gate: row.flags.includes('awaiting_approval') && row.isCallerNextApprover
```
Flag chip styling: `FLAG_STYLE`/`FLAG_LABEL` maps at `GovernanceQueueRow.tsx:11-25` (CSS-var + semantic accents — the token pattern to follow).

**One-line row (UX-06):** strip from the current row (`admin/sops/page.tsx:236-368`): `SopDepartmentEditor` block (289-296), `LibraryReviewCell` (297-301), and the 5 icon-only `evidence-btn !min-w-[40px]` links (306-350) — those actions move to the builder as LABELLED actions (keep the `title`/`aria-label` strings as visible labels). Keep: title + `StatusBadge` + one flag chip + owner label (owner map already built at lines 88-94 via `getTeamMembersWithEmails`). Row click already goes to `/admin/sops/builder/${sop.id}` (line 242).

---

### `src/app/(protected)/admin/settings/page.tsx` — admin Settings surface

**Analog:** `admin/ai-settings/page.tsx` — the cleanest server-page shell in the admin tree (61 lines).

**Shell pattern** (`ai-settings/page.tsx:14-31, 51-60`):
```tsx
export default async function AiSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: member } = await supabase
    .from('organisation_members').select('role, organisation_id')
    .eq('user_id', user.id).maybeSingle()
  if (!member || !['admin', 'safety_manager'].includes(member.role)) redirect('/dashboard')
  // server snapshot → client component
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--ink-900)]">AI Settings</h1>
      <AiSettingsClient snapshot={snapshot} orgSettings={orgSettings} />
    </div>
  )
}
```
Settings groups: AI Settings client (`AiSettingsClient`), approval-chain editor (`src/components/admin/governance/ApprovalChainPanel.tsx` relocates here), agent layer (from orphan `/admin/agent`). NOTE: `redirect('/dashboard')` appears in 20 files — every guard must repoint to the new role-home (see Shared Patterns).

---

### Role-home redirects (UX-01)

**Analog:** the role switch being deleted from `dashboard/page.tsx:22-26`:
```tsx
if (role === 'worker') redirect('/sops')
if (role === 'supervisor') redirect('/activity')
if (role === 'safety_manager') redirect('/activity')
// admin → /admin/sops (new)
```
Move this logic to the login flow. Touchpoints:
- `src/actions/auth.ts:111, 177, 291` — three `redirect('/dashboard')` after sign-in/join/set-password. Replace with a role lookup + role-home redirect (extract a tiny `roleHome(role)` helper so all three + middleware share it).
- `src/lib/supabase/middleware.ts:40-42` — `if (isAuthRoute && user) redirect('/dashboard')`. Middleware has no role; simplest: redirect to a lightweight route that does the role lookup — which is exactly what `/dashboard` does today. Option: keep `/dashboard` as a redirect-only shim (delete only the AdminDashboard UI) OR do the member lookup in middleware. Planner's call; the shim is the smaller diff.
- `PendingDashboard` (`dashboard/page.tsx:90-101`) relocates verbatim (blueprint-frame + pill markup).
- Grep `href="/dashboard"` (TopHeader logo link line 225, BASE_LINKS line 147) and `redirect('/dashboard')` (23 hits / 20 files) — every guard fallback repoints per-role or to `/`.

---

### Plain-language pass (UX-07) + tokenisation

**Analog for labels-only rename:** builder stage labels live in `BuilderStageShell.tsx` / `PublishStage.tsx` (`src/app/(protected)/admin/sops/builder/[sopId]/`). Change display strings only; route/state names unchanged.

**Anti-pattern to replace** (`PublishStage.tsx:85-113` — inline styles + hardcoded values):
```tsx
<div data-testid="publish-stage" style={{ maxWidth: 640, margin: '0 auto', ... }}>
  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, ... }}>
```
**Token pattern to use instead** (from `admin/sops/page.tsx` / `GovernanceQueueRow.tsx`): Tailwind classes over CSS vars — `text-[var(--ink-900)]`, `bg-[var(--paper-2)]`, `border-[var(--ink-100)]`, `mono text-[11px]`, `blueprint-frame`, `evidence-btn`, `pill`, `tab`. Only pages touched by this phase get tokenised (constraint).

AI-flag titles: rename in the reviewer flag display map (grep "Hallucination" in `src/components/admin/ai-reviewer/`), human step names never "block N".

---

### Test repointing (phase28/29 source-contract specs)

**Analog:** `tests/phase28/governance-queue.spec.ts:29-38` — the path-constant pattern; repoint constants in the SAME plan that moves the code (29-01 precedent):
```ts
const PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx')
const ROW  = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'GovernanceQueueRow.tsx')
function read(p: string): string { return fs.readFileSync(p, 'utf-8') }
test('calls listGovernanceQueue', () => { expect(src).toContain('listGovernanceQueue(') })
```
Specs referencing moved/deleted surfaces: `tests/phase28/governance-queue.spec.ts`, `tests/phase28/library-and-worker.spec.ts` (LibraryReviewCell/GovernanceWidget), `tests/phase29/approval-chain-editor.spec.ts`, `tests/phase29/queue-approve-action.spec.ts`, `tests/phase29/phase-gate.spec.ts`. Also note assertions like `governance-queue.spec.ts:53` expect `redirect('/dashboard')` — these strings change with UX-01. New phase30 specs need a `phase30` project regex in `playwright.config.ts` (CLAUDE.md 2026-05-25 — verify with `npx playwright test --list`).

Behavioural-parity rule for interactive affordances (CLAUDE.md 2026-06-05): assert the handler WIRING (`approveStep(` call site, `onClick={handleApprove}`), not just token presence.

## Shared Patterns

### Auth guard (copy-pasted in all 14 admin pages — duplicate #7)
**Source:** `admin/sops/page.tsx:40-53` / `ai-settings/page.tsx:16-28`
```tsx
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
const { data: member } = await supabase
  .from('organisation_members').select('role').eq('user_id', user.id).maybeSingle()
if (!member || !['admin', 'safety_manager'].includes(member.role)) redirect('/dashboard')
```
If the planner extracts a shared `requireAdminPage()` helper, it must NOT live in a `'use server'` file (CLAUDE.md 2026-06-27 — sync exports break `next build`); put it in `src/lib/auth/`. The `redirect('/dashboard')` fallback in all copies must repoint per UX-01.

### Tab/chip nav idiom
`className="tab" data-active={active ? 'true' : undefined}` inside `flex gap-1 border-b border-[var(--ink-100)]` — used by TopHeader, admin sub-nav, STATUS_TABS, GovernanceFilterChips, AiDraftTabs. All new navs/chips use this.

### Server-action mutation from client row
`useTransition` + action call + `'error' in result` + `router.refresh()` — `GovernanceQueueRow.tsx:37-59`. Use for any relocated action buttons.

### journeys.ts same-change rule
Every route removed (`/dashboard`, `/admin/governance`, `/sops/[sopId]/walkthrough`, `/admin/agent`, `/admin/departments`, `/admin/ai-settings` if renamed) and added (`/admin/sops/new`, `/admin/settings`, `/pending`) updates `src/lib/journeys/journeys.ts` in the same commit; final gate = /pathways "All screens" 0 not-mapped.

### Dead-href sweep after every route removal
`grep -rn "<old-path>" src` — internal links aren't type-checked (CLAUDE.md 2026-06-08). Known hot fragments: `/dashboard`, `/admin/governance`, `/walkthrough`, `/admin/ai-settings`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Legacy `?tab=` param mapping in `SopTabNav` | client nav shim | request-response | No prior tab-rename precedent; pattern is trivial (a `Record<string,SopTabId>` lookup before `isSopTabId`) |

## Metadata

**Analog search scope:** `src/app/(protected)/**`, `src/components/{layout,admin,sop}/**`, `src/lib/supabase/`, `src/actions/auth.ts`, `tests/phase28-29/`
**Files read:** 12 (admin/sops page, dashboard, ai-settings, TopHeader, SopTabNav, GovernanceFilterChips, GovernanceQueueRow, AiDraftTabs, middleware, governance-queue.spec, + targeted greps on tabs/PublishStage/auth actions)
**Pattern extraction date:** 2026-07-12
