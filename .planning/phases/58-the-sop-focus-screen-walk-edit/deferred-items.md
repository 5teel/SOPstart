# Phase 58 deferred items

Found while executing 58-05; not caused by it, so not fixed there.

- **`tests/phase40/dat01-category-column.spec.ts` ("sops-table write census") is red.** `src/actions/focus-steps.ts` (58-04) writes `sops.objective` and `sops.allow_forward_jump` without `category_slug` and has no `CATEGORY_EXEMPT` entry. Fix: add two justified exempt entries (and bump `EXPECTED_SOPS_WRITE_SITE_COUNT` if the census counts them). Owner: the plan that next touches focus-steps, or 58-15.
- **`tests/phase55/deletion-sweep.spec.ts` ("photo-scan > tests/ has no reference") is red.** `tests/evals/sop-focus.eval.ts:48` (58-01/02 skeleton) has the `58-walk-photo-required` fixme title containing a symbol the Phase 55 sweep forbids. Fix: reword the title.
- **`src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts` is registered in no Playwright project** (the `publish-gate` regex in `phase6-stubs` only searches `tests/`), so it never runs. Run through a throwaway config, its four gate tests pass after the 58-05 repoint; one unrelated test ("Publish button on builder header is REMOVED", expects `VerifyChecklistGate` in `BuilderClient.tsx`) fails. The file and the builder go in 58-16.

Found while executing 58-07; not caused by it, so not fixed there.

- **`tests/phase26/ai-overlay.spec.ts` is red** ("reused ReviewerFlagsPanel should render for the flagged block"). Its harness feeds the old block-keyed flags; `useReviewerFlags` groups by `step_id` since 58-06 (`554a856e`). The spec is a 58-16 delete in the repoint inventory; leave it red until then or delete it earlier.
- **`tests/integration/wizard-sop-dept.spec.ts` A4 ("sopId sentinel __new__") is red.** `src/components/admin/SopMetadataFields.tsx` no longer contains the literal `__new__` (predates Phase 58; the file was last touched by `c21b7e73`). Owner: whoever next edits the wizard metadata step.

Found while executing 58-08; caused by it, left for the owning plan.

- **`tests/phase26/visual-block.spec.ts` ("medium enum + a medium-tagged example are on the /api/schema surface") is red.** `src/actions/introspection.ts` describes the step model now and no longer registers `VisualBlock`. The spec is a 58-16 delete in the repoint inventory; leave it red until then.
- **`src/actions/agent-layer.ts#getBlockAgentMetadata`** still reads `block_agent_metadata`, but synthesis stopped writing it (no `embedBlocks`), so it returns stale rows. Its only consumers are the builder files (`BuilderClient.tsx`, `AgentBlockMeta.tsx`) that 58-16 deletes; delete the action and view type with them.

Found while executing 58-13; not caused by it, so not fixed there.

- **`phase11-stubs` has 8 red specs about the old builder** (`sb-layout-editor` x6, `sb-section-schema` SB-SECT-05, `sb-auth-builder` SB-AUTH-01). SB-AUTH-01 fails on its `useForm` assertion (the wizard no longer uses it) before reaching the redirect line 58-13 repointed to `focusHref`. All grep the Puck / old builder files; they are 58-15 repoints or 58-16 deletes in the inventory.
- **The plan's seam grep (`grep -rln "focus/admin" src | grep -v src/components/focus/admin/` prints only `FocusFrame.tsx`) also lists `BuilderStageShell.tsx` and `BlockEditShell.tsx`**: 58-12 relocated four tool buttons and repointed those two old-builder files to the new paths. Both go in 58-16; `edit-rail` pins the exception list so any third file fails.

Found while executing 58-14; not caused by it, so not fixed there.

- **`phase12.5-stubs` has 5 red specs.** `sb-ux-blocks` x4 (SB-UX-04 /api/schema block list, props_schema and example_props, SB-UX-05, SB-UX-11) read the `/api/schema` block surface that 58-08 rewrote to describe the step model; `sb-ux-blueprint` SB-UX-01 reads the public landing body. All are in the 58-15 / 58-16 inventory (`sb-ux-blueprint.test.ts` is a 58-15 repoint). Leave red until then.
- **Three pathway-coverage guards had to exempt the two redirect-only pages.** `phase30/governance-fold`, `phase40/dup04-page-shell` and `phase57/shell-structure` demand a `route:` in `journeys.ts` for every page, but 58-14's acceptance says no step may name the retired builder or versions address. All three now exempt `/admin/sops/builder/[sopId]` and `/admin/sops/[sopId]/versions`; 58-16 deletes those directories and must delete the three `redirectOnly` exemptions in the same commit.
