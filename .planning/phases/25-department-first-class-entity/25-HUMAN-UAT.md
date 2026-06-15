---
status: partial
phase: 25-department-first-class-entity
source: [25-VERIFICATION.md]
started: 2026-06-15
updated: 2026-06-15
---

## Current Test

[awaiting human testing on sopstart.com after Railway deploy]

## Tests

### 1. Cross-tenant isolation (REQ-1)
expected: A department created in org A is invisible to org B — logged in as an org B admin, /admin/departments shows zero of org A's departments.
result: [pending]

### 2. Worker SOP visibility gate — Forming vs Cleaning (REQ-3 / D-02)
expected: A worker assigned only to Forming sees Forming-tagged SOPs and does NOT see Cleaning-only SOPs in /sops (RLS additive-OR gate). Note: the /sops client filter is deferred — RLS is the real gate, so test as a worker user with only Forming membership.
result: [pending]

### 3. Member dept assignment persists member_departments (REQ-4 / REQ-9)
expected: Assigning a member to Forming via the /admin/team DepartmentPicker writes a member_departments row; removing it removes only that row.
result: [pending]

### 4. Create-SOP wizard writes sop_departments (REQ-9 / REQ-3)
expected: Creating a SOP with two departments selected (blank wizard AND AI wizard) persists two sop_departments rows.
result: [pending]

### 5. Owner round-trip + no-owner warning (REQ-5 / REQ-6)
expected: A department with no owner shows the red dashed border + "No owner assigned — set one"; setting an owner clears it, shows the filled "Owner" line on the department card AND "★ Owns {Dept}" on the team row.
result: [pending]

### 6. Block all_departments + dept filter in /admin/blocks (REQ-2 / REQ-7)
expected: An all_departments=true block surfaces under every department filter (distinct cyan "All departments" chip); a block tagged only to Forming does NOT appear under the Quality filter.
result: [pending]

### 7. Global block data integrity post-migration, in UI (REQ-8)
expected: Zero blocks orphaned (DB already confirms 0 null-org); all previously-global blocks readable by the org and surface under the "All departments" chip in the live /admin/blocks library.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
