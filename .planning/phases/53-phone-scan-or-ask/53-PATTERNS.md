# Phase 53: Phone — Scan or Ask - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 15
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/site/qr-decode.ts` | utility | transform | `src/lib/site/scene.ts` (`MACHINE_CODE_PATTERN`) | role-match |
| `src/app/(protected)/m/[code]/page.tsx` | route (server component) | request-response | `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx` | exact |
| `src/app/(protected)/admin/site/plate/[machineId]/page.tsx` | route (server component) | request-response | `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx` (+ `PrintButton.tsx`) | exact |
| `src/components/sop/plant/PhoneHome.tsx` | component | request-response | `src/components/sop/plant/PlantHome.tsx` (render seam sibling) | role-match |
| `src/components/sop/plant/MachineListSheet.tsx` | component | request-response | `src/components/sop/CategoryBottomSheet.tsx` (`DepartmentBottomSheet`) | exact |
| `src/components/sop/plant/ScanSheet.tsx` | component | event-driven (camera stream) | `src/components/admin/VideoRecorder.tsx` | exact |
| `src/components/sop/plant/NowCard.tsx` (modify) | component | request-response | itself (in-place prop change) | exact |
| `src/app/(protected)/sops/page.tsx` (modify) | route (client component) | request-response | itself (in-place gate widen) | exact |
| `src/lib/supabase/middleware.ts` (modify) | middleware | request-response | itself (in-place) | exact |
| `src/app/(auth)/login/page.tsx` (modify) | route (server component) | request-response | itself (in-place) | exact |
| `src/actions/auth.ts` `loginWithEmail` (modify) | service (server action) | request-response | itself (in-place) | exact |
| `src/lib/auth/next-redirect.ts` (new, implied by D-07/Pitfall 3) | utility | transform | none (net-new, small) | none |
| `scripts/check-bundle-size.ts` (modify) | config | batch | itself (`GATED_ROUTES` entries) | exact |
| `playwright.config.ts` (modify) | config | — | existing `phase41`/`phase52` project entries | role-match |
| `tests/phase53/*.spec.ts` | test | — | `tests/phase51/site-model-rls-runtime.spec.ts`, `tests/lint/no-static-admin-lens-import.spec.ts` | exact |
| `tests/evals/phone-home.eval.ts` | test | — | `tests/evals/plant-home.eval.ts` | exact |

## Pattern Assignments

### `src/app/(protected)/m/[code]/page.tsx` (route, request-response)

**Analog:** `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx`

**Imports + auth pattern** (lines 1-27):
```typescript
import { notFound, redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

export default async function MachinePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/m/${code}`)}`)
  if (!organisationId) notFound()
```

**Core lookup pattern — org-scoped select + belt-and-braces filter, then 404** (qr/page.tsx lines 28-33, adapt table/columns):
```typescript
  const { data: sop } = await supabase
    .from('sops')
    .select('id, title, sop_number, status')
    .eq('id', sopId)
    .maybeSingle()
  if (!sop) notFound()
```
For `/m/[code]`, add `.eq('organisation_id', organisationId)` on top of RLS (D-04) — mirrors the self-enforcement convention in `tests/phase51/site-model-rls-runtime.spec.ts` (belt-and-braces org filter even though RLS already scopes). Validate `code` against `MACHINE_CODE_PATTERN` (`src/lib/site/scene.ts:25`) before the query, uppercase it (codes are stored uppercase).

**No distinguishing 404 message** — both "code doesn't exist" and "code exists in another org" must `notFound()` identically (Security Domain table, Known Threat Patterns).

---

### `src/app/(protected)/admin/site/plate/[machineId]/page.tsx` (route, request-response)

**Analog:** `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx` (copy near-verbatim)

**Full QR + print pattern** (lines 1-44):
```typescript
import QRCode from 'qrcode'
import { PrintButton } from './PrintButton'

// swap requireAdminContext() in for the inline role check below —
// qr/page.tsx predates the shared guard:
if (!role || !['admin', 'safety_manager'].includes(role)) {
  redirect('/dashboard')
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sopstart.com').replace(/\/$/, '')
const workerUrl = `${siteUrl}/m/${machine.code}`   // was: `${siteUrl}/sops/${sop.id}`

const qrSvg = await QRCode.toString(workerUrl, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 1,
  color: { dark: '#09090b', light: '#ffffff' },
})
// dangerouslySetInnerHTML={{ __html: qrSvg }} — safe: our own generated
// data from our own server-constructed URL, never raw user input.
```
Use the shared `requireAdminContext()` gate (see Shared Patterns) instead of the qr page's own pre-existing inline `role` check — RESEARCH flags this as the up-to-date idiom (Pattern 2).

**Print CSS — add an `@page` rule the existing page lacks** (existing pattern, qr/page.tsx line ~48, extend):
```css
@media print {
  @page { size: A6; margin: 8mm; }
  header, nav, footer, .no-print { display: none !important }
  body { background: white }
}
```

---

### `src/components/sop/plant/ScanSheet.tsx` (component, event-driven)

**Analog:** `src/components/admin/VideoRecorder.tsx`

**Camera acquire/teardown pattern** (lines 104-123, drop `audio: true` for the scan sheet):
```typescript
const startCamera = useCallback(async (facing: 'environment' | 'user') => {
  stopAllTracks()
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing },   // no audio for the scan sheet
    })
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
    setRecorderState('ready')
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setRecorderState('permission-denied')   // -> show code-entry fallback (D-08)
    } else {
      setErrorMessage('Could not access camera. Please check your device settings.')
      setRecorderState('error')
    }
  }
}, [stopAllTracks])
```
`stopAllTracks` (same file, nearby) iterates `streamRef.current.getTracks().forEach(t => t.stop())` — call on sheet close/unmount (D-09). `revokeObjectUrls` pattern nearby shows the same ref-cleanup idiom if the scan sheet grabs any object URLs.

**Decoder + dynamic-import isolation** — no existing analog (net-new: `BarcodeDetector` feature-detect + `jsqr` fallback). Must load inside `ScanSheet`'s own `next/dynamic({ ssr: false })` module per D-09, mirroring the `PlantHome`/`AdminSopSurface` dynamic-import idiom in `sops/page.tsx` (see below).

---

### `src/components/sop/plant/MachineListSheet.tsx` (component, request-response)

**Analog:** `src/components/sop/CategoryBottomSheet.tsx` (`DepartmentBottomSheet`)

**Sheet chrome + row pattern** (lines 1-60):
```typescript
export interface DepartmentBottomSheetProps {
  departments: Department[]
  selectedIds: string[]
  allDepartments: boolean
  onSelect: (ids: string[], allDepts: boolean) => void
  open: boolean
  onClose: () => void
}

function DepartmentRow({ dept, isSelected, onToggle, height }: {...}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center justify-between px-4 rounded-lg transition-colors cursor-pointer w-full text-left',
        height,
        isSelected ? 'bg-[var(--ink-900)]/15 border border-[var(--ink-900)]/30' : 'hover:bg-[var(--paper-2)]',
      ].join(' ')}
    >
      ...
```
For `MachineListSheet`, adapt the row to a machine (name + pin count) grouped under a `MillerGroupLabel`-style department heading (zone colour), and route on tap: `router.push(\`/m/${code}\`)` (a one-off navigation, sanctioned by D-07/RESEARCH Anti-Patterns — not a hot click path, the 2026-05-13 learning doesn't apply here).

---

### `src/components/sop/plant/PhoneHome.tsx` + `src/app/(protected)/sops/page.tsx` (modify)

**Analog:** `sops/page.tsx`'s existing render-seam gate and dynamic-import block (own file, in-place extension)

**Dynamic-import slot pattern** (lines 52-62):
```typescript
const SopWorkerBrowser = dynamic(
  () => import('@/components/sop/SopWorkerBrowser').then((m) => m.SopWorkerBrowser),
  { ssr: false }
)
const AdminSopSurface = dynamic(
  () => import('@/components/sop/AdminSopSurface').then((m) => m.AdminSopSurface),
  { ssr: false }
)
const PlantHome = dynamic(
  () => import('@/components/sop/plant/PlantHome').then((m) => m.PlantHome),
  { ssr: false }
)
// Phase 53: add PhoneHome the same way — its own chunk, ssr:false.
const PhoneHome = dynamic(
  () => import('@/components/sop/plant/PhoneHome').then((m) => m.PhoneHome),
  { ssr: false }
)
```

**Gate-widen pattern** (lines 129-140, current):
```typescript
const viewport = useViewport()
const wantsPlant = !isAdmin && viewport === 'desktop'
const { data: siteResult } = useQuery({
  queryKey: ['site-worker'],
  queryFn: () => listSiteForWorker(),
  enabled: wantsPlant,
  staleTime: 30 * 60 * 1000,
})
```
Widen `enabled` to `!isAdmin` (drop the viewport check) per CONTEXT D-01 / RESEARCH Q1 resolution; branch the render on `viewport === 'desktop'` → `PlantHome`, `viewport === 'mobile'` → `PhoneHome`, both consuming the same `plantSite`.

**Comment convention to preserve** — the block above lines 26-50 documents the SB-LINE-06 bundle-isolation contract and the `no-static-admin-lens-import.spec.ts` guard; extend the doc comment (not the code shape) to note `PhoneHome` gets the same treatment, and per Pitfall 5, never quote a forbidden-marker literal inside a new comment — paraphrase.

---

### `src/components/sop/plant/NowCard.tsx` (modify in place)

**Current signature — `onShowMe` required** (line 29):
```typescript
export function NowCard({ items, onShowMe }: { items: NowItem[]; onShowMe(machineId: string): void }) {
```
Change to an optional callback so the button only renders when passed (Pitfall 1 / RESEARCH Q2 resolution):
```typescript
export function NowCard({ items, showMeAction }: { items: NowItem[]; showMeAction?: (machineId: string) => void }) {
  ...
  {now.machine && showMeAction && (
    <button type="button" onClick={() => showMeAction(now.machine!.id)} ...>Show me</button>
  )}
```
Keep everything else (`Walk it` link at lines ~68-75, the "Then:" lines) byte-identical — `PlantHome` passes `showMeAction`, `PhoneHome` omits it.

---

### `src/lib/supabase/middleware.ts` (modify in place)

**Current redirect — no `next` param** (line ~46, `if (!isPublicRoute && !claims)` block):
```typescript
if (!isPublicRoute && !claims) {
  return NextResponse.redirect(new URL('/login', request.url))
}
```
Change to append `?next=` (Pitfall 3, D-07 login gap):
```typescript
if (!isPublicRoute && !claims) {
  const next = encodeURIComponent(path + request.nextUrl.search)
  return NextResponse.redirect(new URL(`/login?next=${next}`, request.url))
}
```
Existing public-route list pattern to extend if a new cookie-less route is ever added (it is NOT needed here — `/m/[code]` IS cookie-authed):
```typescript
const isCronRoute = path === '/api/agent-layer/synthesis-sweep'
const isShotstackCallback = path === '/api/sops/generate-video/callback'
const isPublicRoute = path === '/' || isAuthRoute || isSchemaIntrospection || isCronRoute || isShotstackCallback || isVersionRoute
```

---

### `src/app/(auth)/login/page.tsx` + `src/actions/auth.ts` (modify in place)

**Server-component searchParams pattern — no client `useSearchParams`/Suspense needed** (login/page.tsx lines 9-15):
```typescript
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const params = await searchParams
  const justRegistered = params.registered === '1'
```
Extend the type to `{ registered?: string; next?: string }`, read `params.next`, pass to `<LoginForm next={params.next} />`.

**`loginWithEmail` current unconditional redirect** (auth.ts line 116):
```typescript
redirect(roleHome(claims['user_role'] as string | undefined))
```
Change to prefer a validated `next` (Pitfall 3):
```typescript
redirect(next && isSafeNextPath(next) ? next : roleHome(claims['user_role'] as string | undefined))
```
`isSafeNextPath` (new, `src/lib/auth/next-redirect.ts`): require string starts with `/`, reject `//`, `/\`, any `://`, and reject `/login` itself (redirect-loop guard) — per Security Domain, Known Threat Patterns table.

---

### `scripts/check-bundle-size.ts` (modify — add forbidden-marker group)

**Analog:** existing `GATED_ROUTES` entries (lines 63-100)

```typescript
{
  route: '/sops/page',
  ...
  forbiddenMarkers: [
    ...
    { label: 'konva (52 D-02)', markers: ['react-konva', 'konva'] },
    { label: 'voice modal (52 D-13)', markers: ['Please acknowledge the safety hazards first'] },
    // Phase 53 (D-09): add here and on /sops/[sopId]/page —
    { label: 'scan sheet (53 D-09)', markers: ['<a literal string unique to ScanSheet.tsx — verify via grep first>'] },
  ],
},
```
Verify marker uniqueness via grep before choosing (established convention, script header comment lines 21-28) — a marker absent from the whole build fails the self-validation check vacuously per the 2026-05-25/2026-06-05 CLAUDE.md learnings already codified in this script's own docstring.

## Shared Patterns

### Server-side session context + org-scoped read
**Source:** `src/lib/auth/session-context.ts` (`getSessionContext()`), used verbatim in `qr/page.tsx` lines 21-33 and required for `/m/[code]`
**Apply to:** `/m/[code]/page.tsx`, `/admin/site/plate/[machineId]/page.tsx`
```typescript
const { supabase, userId, organisationId, role } = await getSessionContext()
if (!userId) redirect('/login')
```

### Admin gate
**Source:** `requireAdminContext()` in `src/lib/auth/guards.ts` (current shared idiom; `qr/page.tsx`'s inline `role` check at lines 25-27 predates it and should NOT be copied for new code)
**Apply to:** `/admin/site/plate/[machineId]/page.tsx`

### Dynamic-import bundle isolation
**Source:** `src/app/(protected)/sops/page.tsx` lines 52-62 (`dynamic(..., { ssr: false })`)
**Apply to:** `PhoneHome.tsx`, `ScanSheet.tsx` (ScanSheet needs its OWN nested dynamic chunk distinct from PhoneHome's, per D-09 — the scan sheet/decoder/camera must never enter the base `/sops` or `/sops/[sopId]` bundle even though PhoneHome itself does)

### getUserMedia acquire/teardown
**Source:** `src/components/admin/VideoRecorder.tsx` lines 104-123 + `stopAllTracks`
**Apply to:** `ScanSheet.tsx`

### Bottom sheet chrome
**Source:** `src/components/sop/CategoryBottomSheet.tsx` (`DepartmentBottomSheet`)
**Apply to:** `MachineListSheet.tsx`

### Source-contract test idiom (handler wiring, not just presence)
**Source:** `tests/lint/no-static-admin-lens-import.spec.ts` (grep-based import-absence guard), `tests/phase51/site-model-rls-runtime.spec.ts` (live cross-org denial probe)
**Apply to:** `tests/phase53/*.spec.ts` — per CLAUDE.md 2026-06-05 learning, assert HANDLERS are wired (e.g. `MachineListSheet` row onClick calls `router.push`), not merely that a string/prop name appears in the file.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/auth/next-redirect.ts` | utility | transform | Net-new, small (`isSafeNextPath`); no prior "next"-param validator exists anywhere in the codebase — build from the Security Domain spec in RESEARCH.md directly |
| `src/lib/site/qr-decode.ts` decoder half (`isOurPlateUrl`, `extractMachineCode`, `BarcodeDetector`/`jsqr` wiring) | utility | transform | No QR/barcode decoding exists anywhere in the codebase today; RESEARCH.md's own Code Examples section is the closest thing to a pattern (origin-check + `jsQR(imageData, width, height)` call shape) |

## Metadata

**Analog search scope:** `src/app/(protected)/`, `src/components/sop/`, `src/components/admin/`, `src/lib/`, `src/actions/auth.ts`, `scripts/check-bundle-size.ts`, `tests/phase51/`, `tests/lint/`
**Files scanned:** ~14 (qr/page.tsx, sops/page.tsx, NowCard.tsx, MachinePanel.tsx, middleware.ts, login/page.tsx, auth.ts, VideoRecorder.tsx, CategoryBottomSheet.tsx, check-bundle-size.ts, plus CONTEXT.md/RESEARCH.md which already trace exact line ranges for site-worker.ts, worker-signal.ts, scene.ts)
**Pattern extraction date:** 2026-09-29
