---
status: resolved
trigger: "Deployed eval D: admin /sops?view=attention never redirects to /governance once the real org has a site (13 machines); page frozen in mobile-seed worker list at 1440px"
created: 2026-09-29
updated: 2026-09-29
---

## Current Focus

hypothesis: CONFIRMED -- Next 16.2.1 action-queue orphaning (see Evidence)
next_action: none -- resolved

## Symptoms

expected: admin at /sops?view=attention lands on /governance
actual: URL never changes (25s); page shows mobile-seed worker list (chips + cards) at 1440px, no PhoneHome, search box visible
errors: none captured by the eval (test D has no console watcher)
reproduction: npm run eval -- --phase 54, test D
started: after scripts/seed-site-sopstart.mjs gave the real org a site; passed 2026-09-29 before that

## Eliminated

- hypothesis: H1 client render error during hydration
  evidence: zero pageerror / console errors in local prod repro
  timestamp: 2026-09-29
- hypothesis: H2 two router.replace calls racing
  evidence: admin table never mounts (viewport stuck mobile), so only the page-level replace fires; one nav RSC request
  timestamp: 2026-09-29

## Evidence

- timestamp: 2026-09-29
  checked: failure error-context.md + screenshot
  found: WorkerSimpleList (ssr:false) rendered client-side with query data (3 assigned) -> client JS ran. Search box visible -> plantSite/phoneSite null -> site query never resolved to a site. Admin table absent at 1440px -> viewport never became 'desktop' in a committed render.
  implication: client rendering happened but neither useViewport's setState nor the redirect's navigation ever committed

- timestamp: 2026-09-29
  checked: local prod build (HEAD 1007c5c) + Playwright 1440x900 as eval-admin, /sops?view=attention
  found: reproduced. No pageerror, no console errors (H1 eliminated). Nav RSC GET /governance 200 and exactly ONE server-action POST (002ae0a2ac = getUserSopAssignments). listSiteForWorker never POSTed although its query is enabled on the mobile seed. URL stuck 12s.
  implication: a queued server action is being dropped; router state waits on it

- timestamp: 2026-09-29
  checked: React root via injected devtools hook in the stuck state
  found: root.suspendedLanes = transition lane bit 9 (pending forever); useViewport hook has setVariant('desktop') parked in baseQueue at lane 2^28 (IdleLane). getNextLanes never works Idle lanes while any non-idle lane is pending.
  implication: the frozen mobile seed is a side-effect of a permanently suspended router transition, not a render bug

- timestamp: 2026-09-29
  checked: node_modules/next 16.2.1 app-router-instance.js dispatchAction/runRemainingActions vs next@16.3.6
  found: 16.2.1 NAVIGATE branch discards the in-flight action but never repoints actionQueue.last; next server action appends to discarded.next (orphaned, never run, deferred promise never resolves). 16.3.6 adds `if (actionQueue.last === actionQueue.pending) actionQueue.last = newAction` and only advances the queue from its head.
  implication: upstream bug, fixed in 16.3.6; our trigger is any navigation dispatched while a server action is in flight followed by another server action before the nav lands

## Resolution

root_cause: In one mount effect flush the page dispatched getUserSopAssignments (server action), router.replace('/governance'), then listSiteForWorker. Next 16.2.1's dispatchAction NAVIGATE branch discards the in-flight action without repointing actionQueue.last, so listSiteForWorker was orphaned and never ran; the router state was its never-resolving deferred promise, so the navigation transition suspended forever and starved useViewport's IdleLane update (frozen mobile seed). Confirmed: patching only the upstream 16.3 line locally made the redirect land in ~1s.
fix: One server-side redirect in src/lib/supabase/middleware.ts (session cookies carried over); page-level effect and AdminLibraryTable's router.replace deleted; specs repointed.
verification: local prod repro -- /sops?view=attention lands on /governance with inbox in ~2s, /sops and /sops?status=draft still show the table, unauthenticated -> /login?next=...; npm run build green, bundle gate unchanged vs HEAD; 306 affected specs pass; deployed eval at 5049f29: 24 passed / 0 failed / 2 skipped, admin-governance.png shows the real org inbox + floor map.
files_changed: [src/lib/supabase/middleware.ts, src/app/(protected)/sops/page.tsx, src/components/admin/AdminLibraryTable.tsx, tests/phase28/library-and-worker.spec.ts, tests/phase54/library-table.spec.ts, tests/phase54/deletion-sweep.spec.ts, tests/evals/sop-surface.eval.ts, CLAUDE.md]
