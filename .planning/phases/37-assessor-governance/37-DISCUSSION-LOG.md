# Phase 37: Assessor Governance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 37-assessor-governance
**Areas discussed:** Assessor definition & scope, Gate coverage, Override & bootstrap flow, Blocked-recorder UX

---

## Assessor definition

| Option | Description | Selected |
|--------|-------------|----------|
| Designated + signed off | Admin designates assessors AND assessor must be signed off on the SOP (recommended) | |
| Signed-off = assessor (derived) | Anyone competent_signed_off on SOP X can assess others on X; zero admin surface | ✓ |
| Designation only | Admin grants assessor flag; no per-SOP competence requirement | |

**User's choice:** Signed-off = assessor (derived)
**Notes:** Confirmed in a follow-up: derived, no designation table at all; the override path covers new orgs.

---

## Assessor scope

| Option | Description | Selected |
|--------|-------------|----------|
| Org-wide (recommended) | No department fencing; per-SOP competence check applies naturally | ✓ |
| Per-department | Assessor within own department(s) only | |
| Per-SOP | Granular assessor grants per SOP | |

**User's choice:** Org-wide
**Notes:** Combined with derived model = signed off on SOP X ⇒ can assess anyone in the org on SOP X.

---

## Gate coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Advancing obs + sign-offs (recommended) | Gate performed_to_sop observations AND completion sign-offs; needs_support stays open | ✓ |
| Observations only (literal ASR-01) | Sign-offs stay ungated | |
| Everything | Also gate needs_support coaching notes | |

**User's choice:** Advancing obs + sign-offs
**Notes:** Rationale accepted: ungated sign-offs would bypass the gate via the stronger record.

---

## Override & bootstrap flow

| Option | Description | Selected |
|--------|-------------|----------|
| Always available, audited (recommended) | Admins can always override; stamped + mandatory reason + append-only audit row | ✓ |
| Bootstrap-only | Blocked once org has ≥1 assessor for that SOP | |
| One-time founding attestation | Dedicated per-SOP/org attest action | |

**User's choice:** Always available, audited

| Option | Description | Selected |
|--------|-------------|----------|
| Admin + safety_manager, reason required (recommended) | Both governance roles; reason mandatory | ✓ |
| Admin only, reason required | Tightest control | |
| Reason optional | Audited but reason optional | |

**User's choice:** Admin + safety_manager, reason required

---

## Blocked-recorder UX

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled + explain (recommended) | Visible-but-disabled controls with teaching copy | |
| Hidden | Non-assessors don't see advancing controls | |
| Request path | Disabled + explain + "request assessment" pinging an assessor/admin | ✓ |

**User's choice:** Request path
**Notes:** Keep plumbing minimal — reuse worker_notifications (Phase 3) or lightweight request rows.

---

## Claude's Discretion

- Gate predicate implementation (full classifier vs lean lineage-widened sign-off check) — semantics must match classifier incl. needs_support reset and version lineage.
- Override audit storage shape (dedicated table vs stamps + event rows) within the append-only constraint.
- Request-path notification mechanism, copy, dedupe.
- Whether RLS is extended cross-table (00053 SECURITY DEFINER precedent) or enforcement stays action-layer.
- Override affordance placement in the recording modal.

## Deferred Ideas

- Explicit assessor designation flag (rejected this phase).
- Department-fenced assessorship (rejected).
- Richer request-assessment workflow (queues, digests, SLAs).
- Gating needs_support notes (explicitly rejected — coaching stays open).
