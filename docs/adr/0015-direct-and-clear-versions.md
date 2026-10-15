# ADR-0015: Every SOP has a direct translation and a clear version

- **Status:** Accepted
- **Date:** 2026-10-15
- **Decided by:** Simon ("a faithful direct translation as one version and a second version that is an enhanced version based on the improvements identified"; display: direct first, clear version one tap away)
- **Evidence:** `.autoresearch/golden/` — Opus 5.5 page-image review of 10 Visy SOPs (19 rules, order-judgement procedure) and the round 3 eval (`results-clear.json`): clear version readability 7.65 vs 7.45 for the old single pass and 5.0 for the direct translation; 98.7% of steps and 98.3% of safety facts kept.
- **Enforced by:** `tests/evals/clear-version.eval.ts`, `tests/phase58/fork-draft.spec.ts` (column census)

## Context
Source SOPs are written as technical documents. The old single-pass conversion already rewrote them a little, so nothing on screen was a faithful record of the source, and the rewrite was never shown to anyone for approval. A rewrite that reads better can also move a control after the exposure it guards, harden a "should" into a "must" or widen a check.

## Decision
1. **The sections and steps are the direct translation** (`parseSop(…, { faithful: true })`): every line of the source, in order, in the source's strength. Runs, ticks, photos and sign-offs attach only to it.
2. **The clear version is stored beside it** in `sops.clear_version` (jsonb), written after each parse by `writeClearVersion` (`src/lib/parsers/enhance-sop.ts`): Sonnet 5.5 rewrites the direct translation under the rules in `enhance-rules.ts`, records every change, order-locked sequence and gap for the document owner, then a model from another family (GPT-5.6 Sol) checks it against the direct translation.
3. **Workers see the clear version only after an admin approves it** (`setClearVersionApproval`, logged as `approve` / `reject` on subject `clear_version`). Approval is pinned to the clear version's `createdAt`; a rewrite clears it.
4. **Read opens on "As written".** "Clear version" is one tap away. Start always runs the version as written.
5. A new version (fork) does not carry the clear version or its approval; run `scripts/write-clear-versions.ts --sop <id>` to write one.

## Consequences
- Each upload costs about US$0.30 more and its clear version lands a few minutes after the job completes.
- The clear version cannot be ticked. If workers want to run it, the record has to move to it first (a new ADR).
- Gaps in the source (missing restart steps, unnamed PPE, contradictions) are listed for the owner instead of being guessed.

## How to comply
- Never write the clear version into `sop_sections` / `sop_focus_steps`.
- Change the rewrite rules in `enhance-rules.ts`, then re-run the golden eval (`.autoresearch/golden/run-clear.ts`, `judge.ts`, `score.ts`).
