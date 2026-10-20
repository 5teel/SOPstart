# ADR-0022: Jev checks the clear version first; the LLM check settles its flags

- **Status:** Accepted
- **Date:** 2026-10-20
- **Decided by:** Simon ("yes implement all of these use cases", after the analogue SOP eval)
- **Supersedes:** —
- **Enforced by:** `tests/lint/jev-one-door.spec.ts` · `tests/evals/clear-version.eval.ts` · `src/lib/parsers/__tests__/sop-parser-hollow.test.ts` · regression `.autoresearch/golden/jev-regress.ts`

## Context
The clear version (ADR-0015) is checked by one cross-family LLM call (GPT-5.6 Sol). It reads the whole SOP at once, so a single dropped number or condition can slip past, and it costs cents and minutes per SOP. TypeSafe Jev is a classifier: typed answers with calibrated confidence, about US$0.005 and 3 seconds for a whole SOP, and it cannot write text. In the analogue eval (`.autoresearch/analogue/`) Jev agreed with two LLM judges on 95–100% of facts, was 99–100% right whenever it reported ≥ 0.9 confidence, and caught 13 of 14 planted errors. It missed a dropped condition, at full confidence. It cannot judge order or invented content.

## Decision
1. **After the clear version is written, Jev runs four checks** (`src/lib/parsers/jev-checks.ts`):
   - **Facts:** each sentence, warning, caution and note of the direct translation is judged covered, altered or missing in the clear version. Editor-only lines (approvals, revision history, template notes) are judged separately and skipped.
   - **Conditions:** any fact with a condition (if, when, only, before, after…) also gets its own "same condition?" question.
   - **Numbers:** code finds the numbers that are in one version but not the other. Jev only decides whether each is a value the worker must meet or an identifier.
   - **Steps:** each clear step is checked for "two or more actions", "information only", and "exposed with no warning".
2. **Flags go to the LLM check, which stays the checker of record.** A flag is a fact Jev calls altered or missing, one it is under 0.9 sure is covered, a dropped condition, or a missing or added value. The check model settles each flag and still checks order and invented content. Only its confirmed issues reach the admin as "points to look at".
3. **Step notes are shown to the admin as advice** ("N steps to tidy before workers use it"). They never change the clear version.
4. **A parse that is hollow fails, and one written as text is flagged.** No steps anywhere plus a procedure title with nothing under it fails (`isHollowParse`). A procedure section holding instructions as text with no steps gets a NEEDS REVIEW parse note.
5. **Jev fails open.** An error is logged and stored on `clear_version.jev.error`, and the LLM check runs as before.
6. **The model is pinned** (`clear-fact-check` → `jev-1.13.0` in the registry). Only `src/lib/ai/jev.ts` calls the TypeSafe API.

## Consequences
- Adds about US$0.005 and a few seconds per upload. The LLM check gets a short list of exact places to look at.
- `TYPESAFE_API_KEY` must be set on the host (Fly secret).
- Changing the Jev model or the thresholds (`FACT_BAR` 0.9, step 0.8) means re-running `.autoresearch/golden/jev-regress.ts` and `.autoresearch/analogue/jev-mutate.ts` first.

## How to comply
- Ask Jev for labels, never for text. Compute counts, comparisons and numbers in code.
- Give each Jev question its own small state when it is about one line. A question about the original asked against the clear version as state is answered poorly.
- Never let a Jev answer change worker text or approve a clear version by itself.
