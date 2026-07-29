# Phase 40: Shared Creation Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 40-Shared Creation Foundation
**Areas discussed:** Category convergence (DAT-01), File-intake accept policy (DUP-01), Progress component (DUP-03), Metadata picker scope (DUP-02)

---

## Category convergence (DAT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| category_tag + controlled vocab | Keep the validated column the wizard writes; retire free-text `category`; backfill onto block_categories vocab | |
| New SOP-category vocabulary | block_categories was built for BLOCKS, not SOPs; seed a fresh SOP-category list from real values in both columns, retire both old columns | ✓ |
| Free-text category wins | Keep plain text, retire category_tag; no vocab management but filter drift returns | |
| Departments ARE the category | Drop both columns; department becomes the only classification axis | |

**User's choice:** New SOP-category vocabulary.

| Option | Description | Selected |
|--------|-------------|----------|
| AI-map to nearest, else null | Exact/slug matches map directly; rest AI-mapped to closest entry; unmappable → null; live prod proof query | ✓ |
| Exact matches only, rest null | Deterministic/auditable, more rows uncategorised | |
| Grow the vocab from the data | Every distinct value becomes an entry — enshrines GPT free-text drift | |

**User's choice:** AI-map to nearest, else null (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed seed for now | Seeded list, changes are migrations; no new admin surface | ✓ |
| Org-editable list | Admin-settings CRUD like observation_labels — arguably a new capability | |

**User's choice:** Fixed seed for now (recommended).

---

## File-intake accept policy (DUP-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Level up, drop .doc | Canonical list = .docx/.pdf/.xlsx/.pptx/.txt + jpeg/png/webp/heic with HEIC→JPEG everywhere; .doc dropped (mammoth can't parse it — silent-fail bug) | ✓ |
| Level up, keep .doc | Add .doc→.docx conversion or explicit rejection | |
| Strict intersection | Only types all three lists agreed on — silently removes types users rely on | |

**User's choice:** Level up, drop .doc (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| One component, named profiles | Callers pick 'documents' \| 'documents+video'; video stays creation-only | |
| Identical list everywhere | Literally one list including video on all three surfaces | ✓ |

**User's choice:** Identical list everywhere.

| Option | Description | Selected |
|--------|-------------|----------|
| Wire it through the video pipeline | New-version video routes through the Phase 6 transcription pipeline to draft the new version | ✓ |
| Accept but reject with clear message | Immediate "not supported yet" response — arguably a DED-02 dead end | |
| Defer to Phase 42 | Profile flag until Phase 42 flips new-version to the full list | |

**User's choice:** Wire it through the video pipeline (recommended). Follow-up asked because accepting a type the backend can't process would recreate the .doc silent-fail bug.

---

## Progress component (DUP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| One plain-language set, mapped | Universal worker-plain sequence; every pipeline's internal stages map onto it; DB keys untouched | ✓ |
| Per-pipeline words, one component | Keep each pipeline's labels, shared visuals only | |

**User's choice:** One plain-language set, mapped (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ParseJobStatus | Already multi-stage-set aware + realtime; add video-gen stage set + polling fallback; retire PipelineStepper/PipelineProgressClient | ✓ |
| Fresh JobProgress component | Clean slate but rebuilds existing behaviour | |

**User's choice:** Extend ParseJobStatus (recommended).

---

## Metadata picker scope (DUP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Title + departments + category | The three CRE-02 core fields; detail-level stays per-surface (AI knob, not metadata) | ✓ |
| Core three + detail-level slot | Voice stops hardcoding detail-level now instead of Phase 42 | |
| Departments + category only | Title stays per-surface — leaves title drift alive | |

**User's choice:** Title + departments + category (recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| One composite | Single SopMetadataFields component; sweep proves convergence via one import | ✓ |
| Field kit | Shared fields composed per surface — compositions can drift again | |

**User's choice:** One composite (recommended).

---

## Claude's Discretion

- DUP-04 page shell (AdminNav adoption on all creation routes) — clear-cut, not discussed.
- New category column naming/shape, migration numbering, exact plain-language stage labels.
- Backfill script mechanics (Management API vs supabase-js, PGRST205 handling) — follow Learnings.

## Deferred Ideas

- Org-editable SOP-category vocabulary (admin-settings CRUD like observation_labels) — promote only if orgs ask.
