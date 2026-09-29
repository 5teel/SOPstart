# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## sops-attention-redirect — client router.replace on mount never lands; page frozen on first paint
- **Date:** 2026-09-29
- **Error patterns:** redirect never fires, URL never changes, router.replace, frozen first paint, viewport stuck mobile, no console errors, server action never POSTed, navigation hangs
- **Root cause:** Next 16.2.1 action queue: a navigation that discards an in-flight server action does not repoint actionQueue.last, so the next server action is orphaned and its deferred router state never resolves (fixed upstream in 16.3)
- **Fix:** legacy-URL redirect moved server-side into the session proxy; client mount-effect redirects deleted
- **Files changed:** src/lib/supabase/middleware.ts, src/app/(protected)/sops/page.tsx, src/components/admin/AdminLibraryTable.tsx
---

