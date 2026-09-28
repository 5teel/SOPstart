# Phase 53: Phone — Scan or Ask - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning
**Source:** Orchestrator-compiled from sketch 007 (Phone tab), the design contract `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md`, Phase 51 (`site_machines.code`) and Phase 52 (worker-signal classifier, NowCard, RelBadge, `listSiteForWorker`). No discuss-phase question round.

<domain>
## Phase Boundary

On the floor with a phone, a worker never navigates. The `<1024px` `/sops` home becomes: the ask bar, the Now card, a floor thumbnail, and a Scan button. Every machine has a printable QR plate resolving `/m/<code>` to that machine's SOP list for the signed-in worker, and an in-app camera scan lands there without a full reload.

**In scope:** the phone home (`<1024px`, workers only — admins on a phone are workers, per contract), `/m/<code>` route, the printable A6 plate from the site editor, in-app scan with a code-entry fallback, the floor thumbnail → department-grouped machine list, `journeys.ts`, the deployed eval at 390×844.

**Out of scope:** the desktop plant (52, done), the admin repaint / inbox / table / lens deletion (54), any change to `/sops/[sopId]` walkthrough, native app wrappers.
</domain>

<decisions>
## Implementation Decisions

### Phone home (PHN-01)
- D-01: Below 1024px on `/sops`, a worker whose org has a site with ≥1 machine sees a new **phone home** — the same dynamic-module pattern as 52 (`next/dynamic({ ssr:false })`, gated by `useViewport()`); the `['site-worker']` query's `enabled` simplifies to `!isAdmin` so both viewports share one fetch (research Q1, resolved 2026-09-29). Orgs with no site keep today's stacked phone list unchanged. Admin sessions on a phone get the same phone home as workers (contract: "an admin on a phone is a worker").
- D-02: Layout, top to bottom: ask bar (48 px, mic) · Now card (52's `NowCard` with `onShowMe` made OPTIONAL — the button renders only when the callback is passed; phone width, `Walk it` / `Read`, no `Show me`) · floor thumbnail (the scene image, 150 px tall, `loading="lazy"`, tap → the machine list) · **Scan a machine plate** button (min-h-tap) · then the existing stacked worker list below as "Everything else", so nothing a worker could reach today becomes unreachable.
- D-03: **The scene is never the phone navigation** (no pan/zoom on the phone). Tapping the thumbnail opens a bottom sheet listing machines grouped by department with pin counts, each row → `/m/<code>`. Reuse the existing `DepartmentBottomSheet` idiom for the sheet chrome.

### `/m/<code>` (PHN-02)
- D-04: Route `src/app/(protected)/m/[code]/page.tsx`. Server: `getSessionContext()`, look up the machine by `code` **within the caller's org** (RLS already scopes; the query still adds `.eq('organisation_id', …)`), 404 (`notFound()`) when absent or foreign. Client: department in zone colour, machine name, sprite or "no photo yet", SOP rows to-do first with `RelBadge`, `Walk it` → `/sops/[sopId]?tab=walk`, `Read` → `/sops/[sopId]`; the rel state comes from the ONE classifier (`plantRelState` in `src/lib/sop/worker-signal.ts`) fed by `useAssignedSops`. Works at every width (a desktop user scanning with a webcam is fine).
- D-05: `code` is the short, unique, org-independent column Phase 51 created on `site_machines`. The QR encodes the absolute URL `https://sopstart.com/m/<code>` (origin from `NEXT_PUBLIC_APP_URL` or the request origin — never hardcoded).
- D-06: **Printable plate**: in the site editor's machine panel (51's `SiteWorkspace`), a "Print plate" action opens `/admin/site/plate/<machineId>` — an A6 print-styled page (`@media print`) with the QR (rendered client-side via a small QR library, or server-side SVG via the same lib), machine name, department, and the short code in mono as a fallback for a broken camera. Admin-gated.

### Scan (PHN-03)
- D-07: Scan opens an in-app full-screen sheet using `getUserMedia({ video: { facingMode: 'environment' } })` and decodes with the platform **`BarcodeDetector`** where available, falling back to a small pure-JS QR decoder (pick one already-common package — e.g. `jsqr` — and justify size in the plan; it loads only inside the scan sheet's dynamic chunk). On a decoded `/m/<code>` URL from OUR origin, client-route to it (`router.push` is acceptable here — it is a one-off navigation, not a hot loop). Foreign origins are ignored with a "That's not a SOPstart plate" message.
- D-08: Denied or unavailable camera → the same sheet shows a **code entry field** ("Type the code on the plate") that routes to `/m/<code>`; the field is always reachable via a "Type it instead" link even when the camera works.
- D-09: The scan sheet, the decoder and the camera stream never enter the base `/sops` bundle (dynamic import; stop all tracks on close/unmount).

### Bundle & tests
- D-10: `scripts/check-bundle-size.ts` gate on `/sops/page` stays ±2 KB against the untouched baseline; add a forbidden-marker group for the scan sheet/decoder on `/sops/page` and `/sops/[sopId]/page`. Never recapture (2026-09-13).
- D-11: `tests/phase53/` project; source-contract specs for the viewport gate, the dynamic imports, the org-scoped lookup in `/m/[code]`, handler wiring (2026-06-05), the print page's admin gate; unit tests for the code → URL builder and the "is this our plate" origin check.
- D-12: Deployed eval `tests/evals/phone-home.eval.ts` at 390×844 as the eval-site worker: home shows ask bar, Now card, thumbnail, Scan; thumbnail → sheet lists "EVAL Press" under Forming with pin 1; `/m/<code>` for EVAL Press lists the fixture SOP with its badge and a Walk link; the Scan sheet opens and, with the camera unavailable in headless Chromium, shows the code-entry field which routes to `/m/<code>`; the plate page renders at print size for the eval-site admin. Screenshots read by the orchestrator. The real-org `eval-worker` (no site) still sees today's phone list.

### Claude's Discretion
- QR library choice and whether the plate QR is SVG (server) or canvas (client) — prefer whichever avoids a new runtime dependency on the worker path.
- Sheet animation, thumbnail aspect handling, exact copy — plain words, no "block" (Simon's rule), metric only.
</decisions>

<canonical_refs>
## Canonical References
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` (Phone persona row; "The floor as the phone navigation" is in What to avoid)
- `.planning/sketches/007-plant-floor-navigation/index.html` (Phone tab markup: home, scanning frame + plate, machine list)
- Phase 52: `52-0[1-5]-SUMMARY.md`, `src/lib/sop/worker-signal.ts`, `src/components/sop/plant/{NowCard,RelBadge}.tsx`, `src/actions/site-worker.ts`, the `/sops` render seam in `sops/page.tsx`
- Phase 51: `51-0[2-5]-SUMMARY.md` (`site_machines.code`, `SiteWorkspace` panel, admin gate idiom), `src/lib/site/scene.ts`
- `src/components/sop/DepartmentBottomSheet.tsx` (sheet idiom), `src/hooks/useViewport*` (breakpoint hook used in 52)
- `CLAUDE.md` § Learnings: 2026-09-29 (invalidate `['assigned-sops']` after sync), 2026-09-28 ×3, 2026-09-13, 2026-06-08, 2026-07-14, 2026-05-25, 2026-07-05 (a cookie-less route needs a middleware exemption — `/m/[code]` IS cookie-authed and must redirect to login with `?next=/m/<code>` so a scanned plate survives the login round-trip)
- `tests/evals/plant-home.eval.ts`, `scripts/eval-fixtures.mjs` (eval-site worker + fixture SOP + EVAL Press)
</canonical_refs>

<specifics>
## Specific Ideas
- The login redirect must preserve `/m/<code>`: a plate scanned by a logged-out worker should land on the machine after sign-in (check how `updateSession` builds its redirect; add `next` if missing).
- The plate's short code doubles as the fallback for the code-entry field — print it large.
</specifics>

<deferred>
## Deferred Ideas
- NFC plates; per-machine sprite generation; plate batch printing (all machines on one sheet) — nice-to-have after 54.
</deferred>

---
*Phase: 53-phone-scan-or-ask · Context gathered: 2026-09-29 (orchestrator-compiled)*
