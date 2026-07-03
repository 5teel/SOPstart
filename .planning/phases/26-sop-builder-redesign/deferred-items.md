# Phase 26 — Deferred / Out-of-Scope Items

## Pre-existing obsolete Puck-contract tests (phase11-stubs / earlier-wave breakage)

Discovered during 26-14 (Puck removal). These source-contract specs encode the
OLD Puck-based / pre-21.5-route architecture and were **already RED before this
wave** (from the 26-03 render-swap + 21.5 route deletions in earlier waves).
They are OUT OF SCOPE for 26-14 (SCOPE BOUNDARY: only auto-fix issues directly
caused by the current task). 26-14 keeps the **phase26 suite + build + tsc**
green; it does not resurrect obsolete pre-phase contracts.

Failing (pre-existing, not caused by 26-14):

- `tests/sb-builder-infrastructure.test.ts` — SB-INFRA-00 asserts the builder
  `page.tsx`/`BuilderClient.tsx` still import `@puckeditor/core`. Puck is
  removed (D-01) — this contract is obsolete.
- `tests/sb-layout-editor.test.ts` — SB-LAYOUT-02/04/13/D08 etc. assert
  imports `from '@/lib/builder/puck-config'`, a `ReviewClient.tsx` at the
  `[sopId]/review` route (deleted in 21.5), and `sanitizeLayoutContent` living
  in puck-config (relocated to `sanitize-layout.ts` in 26-03).
- `tests/sb-auth-builder.test.ts`, `tests/sb-section-schema.test.ts` — Phase 11
  builder-entry contracts superseded by the 21.5/26 redesign.

**Recommended follow-up (not 26-14):** a dedicated cleanup pass to either
retire these Phase-11 source-contract specs or rewrite them against the bespoke
end-state (mirrors what 26-14 did for `builder-edit-stage.spec.ts` E3/E4). Track
under phase close-out, not this plan.

Note: `builder-edit-stage.spec.ts` (phase21.6-stubs) WAS updated in 26-14 —
E3/E4/E3-bespoke now assert the bespoke end-state and pass.
