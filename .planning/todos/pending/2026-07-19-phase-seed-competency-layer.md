---
created: 2026-07-19
title: "Phase seed: Competency layer — training matrix, competency states, supervisor observations"
area: general
resolves_phase: 35
source: Safety-org SOP guidance-notes review (2026-07-19) + Visy interview (2026-05-05, training-record / SuccessFactors ask)
suggested: next milestone after v6.0 (SOP Ownership & Governance Infrastructure) closes
files:
  - src/actions/grants.ts
  - src/actions/completions.ts
  - src/components/admin/wiring/WiringPatchBay.tsx
---

# Phase seed: Competency layer — training matrix, competency states, supervisor observations

The standout adoption from the safety-org SOP guidance-notes review. Spirit of the notes: an SOP is a small training module inside a competency system, not a document. SOPstart already stores both halves of the data — this phase builds the views and states on top.

## Problem

- Completion ≠ competence. SOPstart records walkthrough completions + supervisor sign-offs (immutable, D-17), but nothing between "assigned" and "completed" — no way to say a worker is trained-but-supervised vs fully competent on a given SOP.
- No matrix view. Auditors, ACC reviewers, and site managers ask for one artifact: people × required SOPs × status. The left side (who is REQUIRED to know what) is exactly what Phases 32–33 access grants/assignments encode; the right side (what's been completed/signed off) is the completions data. The join view doesn't exist.
- No supervisor-initiated records. All activity is worker-initiated. The guidance notes' "monitoring and observations" layer — a supervisor recording "I watched Dave do this against the SOP, consistent / needs reset" — is the ongoing legal-evidence layer ("demonstrates people were correctly shown, by competent people") and the complacency-reset mechanism for long-tenured workers.

## Solution (direction, TBD at discuss-phase)

1. **Competency states per person-per-SOP** — keep it minimal and configurable, 3–4 states (e.g. not started / read-theory / supervised / competent-signed-off). Do NOT copy the guidance notes' rigid 5-step NYC→C choreography — spirit (staged, observed, repeated) not letter.
2. **Training matrix screen** — people × required-SOPs grid derived from access grants (requirements) joined to completions/sign-offs/competency states. This is the audit artifact and makes G-06 (training-record export, currently Later in PRODUCT-ROADMAP) nearly free; it is also the concrete answer to Visy's SuccessFactors integration ask.
3. **Supervisor observation records** — a 30-second record type: supervisor observes worker against an SOP, verdict + optional note, stored under the worker's profile, feeds the matrix. Near-daily for supervisors, periodic for managers per the guidance notes.
4. **Assessor capability** — who may assess/sign off is itself governed (trainer must have been signed off themselves). Fold into the G-04 role-based-access work rather than a separate system.

Deliberately out of scope: disciplinary workflow (keep SOPstart neutral — exportable records serve that need without productising it).
