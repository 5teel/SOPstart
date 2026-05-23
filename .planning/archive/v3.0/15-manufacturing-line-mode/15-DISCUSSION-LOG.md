# Phase 15: Manufacturing-Line Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 15-manufacturing-line-mode
**Areas discussed:** Layout switching mechanism, Voice RAG retrieval pattern, Sub-trade tag schema, Voice UX placement

---

## Layout switching mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Pure CSS media query (Recommended) | Single component, CSS @media controls big-text variant. Zero JS, SSR-safe. Mobile/desktop share DOM with different styles. Tightly coupled — harder to diverge later. | |
| Runtime viewport detection (useViewport hook) | JS hook reads window.matchMedia, picks DesktopWalkthrough vs MobileWalkthrough component. Different DOM trees. Risk: SSR mismatch on first paint, +small bundle, code-split per variant. | ✓ |
| Explicit ?layout=desktop URL param + sticky setting | Per-install default, URL param overrides. Most explicit. Requires per-install config. | |

**User's choice:** Runtime viewport detection
**Notes:** User wants flexibility to diverge the desktop and mobile UX structurally, not just stylistically. Code-split per variant is required to honour the bundle-isolation SPEC requirement (≤2 KB growth on mobile worker route).

---

## Voice RAG retrieval pattern

### Round 1

| Option | Description | Selected |
|--------|-------------|----------|
| Full SOP in context window (Recommended for 15a) | Pack entire SOP into Claude prompt as system context. Zero retrieval, zero new infrastructure. Per-query cost higher (more tokens). | |
| Postgres full-text search (FTS) | tsvector indexes, top-K retrieval via ts_rank. Risk: synonym/paraphrase misses on fuzzy questions. | |
| pg_trgm fuzzy match | Trigram similarity. Better at typos than FTS, worse at semantic match. | |
| pgvector embeddings (deferred) | Semantic similarity. Best retrieval quality. NEW dep. Out of 15a per SPEC. | ⚠ (initially picked) |

**User's initial choice:** pgvector embeddings (deferred)
**Notes:** User initially picked pgvector then asked a real question: "I need extreme accuracy — the SOPs are instructions for dealing with equipment that can cause physical injuries to users — which option is best place to deliver accuracy on retrieval questions?"

### Round 2 — Accuracy-first re-evaluation

Claude reframed the accuracy argument: the dominant failure mode for safety-critical SOP Q&A is **retrieval miss** (content present in SOP but not surfaced to the answerer), not retrieval quality. For SOP-sized documents (~5-15K tokens) with a 1M-token Claude context window, **no retrieval** beats embeddings on accuracy because there is no retrieval failure to suffer. Adversarial verifier (Phase 14 pattern) catches hallucinations as a second safety layer.

| Option | Description | Selected |
|--------|-------------|----------|
| Full SOP in context + adversarial verifier (Recommended) | Pack entire SOP into Claude prompt. Verify the answer with a second Haiku call before returning. Maximum accuracy for SOP-sized docs. No new DB extension. | ✓ |
| pgvector embeddings + adversarial verifier | Add pgvector + text-embedding-3-small. Verifier on top. Adds retrieval-miss failure mode that full-context doesn't have. | |
| Full SOP in context, NO verifier | Trust Claude's grounded-citation prompt without verifier. Simplest, no second-pass safety check. | |

**User's choice:** Full SOP in context + adversarial verifier
**Notes:** Final answer reverses the initial pgvector pick. Phase 15a uses no retrieval; pgvector is deferred to Phase 15b only if SOPs grow past ~200 pages.

---

## Sub-trade tag schema

| Option | Description | Selected |
|--------|-------------|----------|
| text[] column on users + sops (Recommended) | users.sub_trade_tags TEXT[] DEFAULT '{}', sops.sub_trade_tag TEXT NULL. Simplest, fewest tables. App-layer validation. | |
| Enum + text[] hybrid | Create sub_trade enum + users.sub_trade_tags sub_trade[]. DB-level validation. | |
| Junction table (users_sub_trades + sub_trades) | Separate sub_trades table + users_sub_trades junction. Cleanest queries, fully relational. | ✓ |

**User's choice:** Junction table
**Notes:** Most schema work but cleanest model. Allows easy taxonomy expansion (add a sub-trade row, not a migration). Two new tables: `sub_trades` (controlled vocab) + `users_sub_trades` and `sops_sub_trades` (many-to-many junctions).

---

## Voice UX placement

| Option | Description | Selected |
|--------|-------------|----------|
| Floating bottom-right pill (Recommended) | Sticky button at bottom-right of viewport. Always reachable. Conventional for voice features. | ✓ |
| Toolbar above the step card | Persistent toolbar pinned to top. Mic + next/prev together. More vertical space. | |
| Embedded in step card | Mic button inside each step card. Contextual but less discoverable. | |
| Cmd+K integration only | Open palette, type or speak. Voice is one of several inputs. Extra keystroke. | |

**User's choice:** Floating bottom-right pill
**Notes:** Conventional pattern, works identically on mobile + desktop. Mic stays accessible mid-walkthrough without competing with step content.

---

## Follow-on decisions

### Embedding provider (if pgvector chosen)

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI text-embedding-3-small | 1536 dims, ~$0.02/M tokens, very good quality. | (N/A) |
| OpenAI text-embedding-3-large | 3072 dims, ~$0.13/M tokens, marginal gain. | |
| Voyage AI (voyage-3) | Higher quality, new API key + vendor. | |
| Skip — use full-context or FTS instead | Reverses pgvector decision. | |

**User's choice:** OpenAI text-embedding-3-small (then voided by switching to full-context approach)
**Notes:** Embedding model decision becomes N/A once full-context approach is locked.

### Sequential gate UX

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit "I've done this — Next" button (Recommended) | Single primary button, large hit area. Audit-trail-friendly. Per SPEC. | ✓ |
| Scroll-to-bottom unlocks Next | Next greyed until user scrolls past end. Defeats sequential reading. | |
| Checkbox + Next | Two-action: tick confirm then Next enabled. Highest deliberateness, slowest. | |

**User's choice:** Explicit "I've done this — Next" button

### Claude model for voice answer synthesis

| Option | Description | Selected |
|--------|-------------|----------|
| claude-haiku-4-5 (Recommended) | Fast (~1s), cheap, excellent for grounded Q&A. Speed matters on the line. | ✓ |
| claude-sonnet-4-6 | Slower (~3s), higher quality, overkill for grounded Q&A. | |
| claude-opus-4-7 | Slowest, most expensive, reserved for hard reasoning. | |

**User's choice:** claude-haiku-4-5
**Notes:** Applies to both the answer call AND the adversarial verifier call.

---

## Claude's Discretion

- Specific component naming (e.g. `DesktopWalkthrough`, `WalkthroughVoiceButton`)
- Voice endpoint shape details (validation schema, error envelope, rate-limit middleware)
- Per-question concurrency policy (suggested: max 1 concurrent query per session, 429 on overlap)
- Voice modal a11y (keyboard escape, focus trap, screen-reader announcements)
- Exact prompt-engineering for the answer and verifier calls
- Migration file numbering (next sequential: `00030_sub_trades.sql`)

## Deferred Ideas

See CONTEXT.md `<deferred>` section for full list. Highlights:
- pgvector embeddings (only if SOPs exceed ~200 pages)
- Auth/PIN/badge attribution (Phase 15b after POC sign-off)
- SOP governance & lifecycle (Phase 15b)
- Training-record export (Phase 15b)
- Site tier (CANCELLED entirely, not deferred)
- TTS playback of voice-Q&A answers (15a stretch, 15b core)
