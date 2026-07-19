# Phase 34: Supervisor Observations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 34-Supervisor Observations
**Areas discussed:** Verdict scale, Recording entry point, Worker visibility & privacy, Completion/version linkage

---

## Verdict scale

| Option | Description | Selected |
|--------|-------------|----------|
| Binary | "Performed to SOP" / "Needs support" — fastest tap, unambiguous for Phase 35/37 | ✓ |
| 3-level | "Competent / Progressing / Not yet" — more granular, harder per tap | |
| Seed wording | "Consistent with SOP / Needs reset" — guidance-notes language | |

**User's choice:** Binary.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed | One platform-wide vocabulary | |
| Per-org labels | Orgs rename verdicts; canonical semantics fixed underneath | ✓ |

**User's choice:** Per-org labels.

---

## Recording entry point

First pass asked panel vs /activity vs both vs completion-detail. **User's response (free text):** didn't understand why/where a supervisor records an observation or what an observation even is — asked for sketches of all these features with rationale before deciding.

**Action taken:** Built `sketches/supervisor-observations/index.html` (blueprint aesthetic, per sketch-findings-SOPstart): rationale section, entry point A (person panel on /admin/team), entry point B (/activity), recording modal, worker /profile view, Phase-35 matrix context.

Post-sketch:

| Option | Description | Selected |
|--------|-------------|----------|
| A + B | Person panel home + one-tap "I observed this" on /activity rows | ✓ |
| A only | Person panel alone | |
| B only | /activity alone | |
| Rework sketches | Neither felt right | |

**User's choice:** A + B.

Also answered in the first pass:
- **Recorders:** Supervisor + up (supervisor, admin, safety_manager). Selected over supervisor-only.
- **Form factor:** Desktop-first. Selected over mobile-first (recommended option was mobile-first; user chose desktop-first, consistent with Visy's desktop-first finding).

---

## Worker visibility & privacy

| Option | Description | Selected |
|--------|-------------|----------|
| As sketched | Full transparency on /profile — verdict + note + observer + date, trust-framing banner | ✓ |
| Verdict visible, note redacted | Weaker trust story; note discoverable under Privacy Act anyway | |
| Change placement | Somewhere other than /profile | |

**User's choice:** As sketched (04).

---

## Completion/version linkage

| Option | Description | Selected |
|--------|-------------|----------|
| As sketched | Standalone record, SOP version auto-stamped, optional completion link from /activity shortcut | ✓ |
| Always require a completion | Kills ad-hoc floor observations | |

**User's choice:** As sketched (03).

---

## Claude's Discretion

- Table/column naming, migration shape, where org verdict labels live
- Person-panel IA beyond info + history + CTA
- Empty/loading states; shared modal component across both entry points

## Deferred Ideas

- Assessor gating → Phase 37
- Competency states / matrix / training record → Phase 35
- Outdated-version surfacing → Phase 36
- Offline observation capture — out of scope (desktop-first)
