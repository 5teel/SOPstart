# Feature Research

**Domain:** SOP / Procedure Management — Mobile PWA for Industrial Workers
**Researched:** 2026-03-23
**Confidence:** HIGH (competitor analysis + industry research; multiple sources corroborated)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every serious SOP management product already has. Missing these means the product feels broken before users even evaluate it.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Step-by-step guided walkthrough | Core product mechanic — workers follow steps sequentially. Every competitor (SafetyCulture, Dozuki, MaintainX) does this. | MEDIUM | Must enforce order, allow back-navigation, show progress indicator |
| SOP library / browse + search | Workers need to find the right SOP before they can execute it. 100+ SOPs makes browsing alone unworkable. | MEDIUM | Full-text search across title, tags, content. Filter by role/trade/category |
| Offline access to cached SOPs | Factory floors and industrial sites have unreliable WiFi. This is a hard requirement, not a nice-to-have, in this domain. | HIGH | Service worker caching, background sync on reconnect |
| Image/figure display within steps | 83% of human learning is visual. SOPs for mechanical and chemical tasks depend on labelled diagrams and photos. | LOW | Render images from parsed document; support zoom on mobile |
| Role-based access control | Different users (workers, supervisors, safety managers, admins) see different things and take different actions. | MEDIUM | At minimum: Worker / Supervisor / Admin. Organization-scoped roles. |
| Completion tracking | Supervisors and safety managers need to know who has completed what. Audit readiness requires this. | MEDIUM | Timestamped completion record per worker per SOP |
| Supervisor sign-off / approval | Existing SOPs include trainer/verifier sign-off sections. Digitizing competency assessment requires sign-off flow. | MEDIUM | Supervisor can review completion evidence and approve or reject |
| Photo capture as evidence | Field workers attaching photos to steps is now standard in SafetyCulture, MaintainX, Fabrico. Not doing this is a regression from paper. | MEDIUM | Capture via camera, attach to specific step, sync with completion record |
| SOP assignment to workers/roles | Workers only execute SOPs assigned to their role or trade. Showing every SOP in a 500-SOP library is unusable. | MEDIUM | Admin assigns SOPs to roles/groups; workers see relevant ones first |
| Multi-tenant data isolation | SaaS product — each organization's SOPs and workers must be completely separated. | HIGH | Tenant-scoped data model from day one; no cross-org data leakage |
| Document upload (Word/PDF intake) | Organizations have existing SOPs as .docx and .pdf. They will not retype them. Upload-to-parse is the entry point. | MEDIUM | File upload UI, async parsing pipeline, status feedback |
| SOP versioning | When an SOP is updated, old completions reference the version that was active. Workers always see current version. | MEDIUM | Version number on each SOP; completion records link to specific version |
| Worker notification on SOP updates | If a worker has been assigned an SOP that changes, they must be notified and required to re-acknowledge. Compliance requirement. | MEDIUM | Push notification or in-app alert; track acknowledgement |
| Hazard / PPE / Emergency sections prominently visible | For safety-critical SOPs, workers must not have to hunt for hazard information. It must be surfaced before steps begin. | LOW | Parsed sections rendered in a dedicated "Safety" card at the top of every SOP |

---

### Differentiators (Competitive Advantage)

Features that existing competitors do partially or poorly, where this product's specific focus on AI-parsed legacy documents and blue-collar UX creates genuine advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI document parsing (Word/PDF to structured procedure) | Competitors require manual authoring. Organizations have 50–500 existing SOPs. AI parsing removes the adoption barrier. This is the core moat. | HIGH | Must handle varied formats, extract sections (hazards, PPE, steps, emergency), embed images, flag low-confidence sections for admin review |
| Confidence scoring + admin review queue | AI parsing is imperfect. Surfacing which sections need human review prevents dangerous procedures going live unverified. No competitor does this well for parsed legacy docs. | MEDIUM | Per-section confidence score; admin queue shows flagged sections; one-click approve/edit |
| Quick-reference mode (non-sequential lookup) | Workers doing chemical handling need to look up PPE or emergency procedure in 10 seconds, not walk through 40 steps. Dozuki and SafetyCulture are step-forward only. | LOW | Tabbed view: Safety / PPE / Steps / Emergency. Jump to any section. |
| Glove-friendly mobile UX | Target users are tradespeople on factory floors. Competitors build for office/tablet use. 48px+ tap targets, high contrast, sunlight-readable, minimal text-entry. | MEDIUM | UX constraint applied across the entire app, not a single feature; requires deliberate design system |
| Structured section rendering (not just PDF display) | Rendering a PDF on a phone is unusable. Parsing into sections (hazards, PPE, steps, emergency) and displaying them as native mobile UI is genuinely better than every "PDF viewer" competitor. | HIGH | Depends on AI parsing quality; the rendering layer transforms parsed JSON into mobile-native UI components |
| Competency assessment digitization | Existing SOPs include multi-role sign-off: trainer observes, verifier confirms, manager reviews. Digitizing the full competency workflow (not just a single sign-off) is not common in this market. | HIGH | Multi-role sign-off chain: worker completes → trainer observes and signs → verifier confirms → manager reviews. Tied to specific SOP version. |
| Offline-first with background sync | Not just "offline capable" (view cached) but offline-first (complete, capture photos, sign off) with transparent sync when connectivity returns. MaintainX does this for maintenance; no competitor does it specifically for SOP walkthroughs. | HIGH | Local-first data model for completion records; conflict resolution on sync |
| SOP acknowledgement tracking (read receipts) | Regulatory compliance (OSHA, ISO) requires proof that workers have read updated SOPs. Automated acknowledgement workflows with audit trail output is a compliance differentiator. | MEDIUM | Worker must confirm reading of updated SOP; timestamped record; exportable audit report |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| In-app SOP authoring | "We want to write SOPs directly in the tool" | Competes with Word/Google Docs, which are better editing environments. Doubles scope. Organizations already have SOPs — the problem is consuming them, not creating them. | Upload-only for v1. Allow editing of parsed output (field-level corrections) rather than a full document editor. |
| Real-time collaboration / chat | "Workers want to message each other during SOP execution" | Blue-collar apps that add chat become communication platforms, not procedure tools. Scope explosion, Slack already exists. | Link to existing communication tools (WhatsApp, Teams) for escalation. Add a "raise issue" button that captures a note + photo tied to a specific step. |
| Video content in SOP steps | "Video explains this better than photos" | Video files are large, defeat offline caching, and are difficult to produce for 500 SOPs. Adds significant storage and CDN cost. | Support annotated photos and diagrams. Allow short GIFs or image sequences as a v2 consideration only. |
| Full ERP/HR integration | "Sync with our HR system for user management" | SSO is a reasonable enterprise ask, but deep ERP/HR data flows are months of integration work per client with minimal standard pattern. | SCIM/SSO support (v2). Manual bulk user import (CSV) for v1. |
| AI-generated SOP creation from scratch | "Use AI to write our SOPs for us" | Hallucinations in safety-critical procedures are dangerous. Organizations with existing SOPs do not need this. | AI parsing of existing verified documents. AI assists admin in reviewing parsed sections, not generating new safety content. |
| Complex conditional branching | "If worker answers X, show step set Y" | Conditional logic in safety-critical contexts increases risk of branching errors. Manufacturing SOPs are linear by design. | Support optional/informational steps ("if equipment is model X, also check...") without full branching logic. |
| Public SOP marketplace / sharing between orgs | "Let organizations share their SOPs" | Creates liability issues (safety procedures from one organization applied in another), legal risk, and data governance complexity. | Industry-standard template library curated by the platform team only, not user-contributed. |

---

## Feature Dependencies

```
[Document Upload]
    └──requires──> [AI Parsing Pipeline]
                       └──requires──> [Admin Review / Confidence Scoring]
                                          └──requires──> [SOP Library (browseable)]
                                                             └──requires──> [SOP Assignment]
                                                                                └──requires──> [Role-Based Access]

[Step-by-step Walkthrough]
    └──requires──> [SOP Library]
    └──requires──> [Offline Cache]
    └──enhances──> [Photo Capture as Evidence]
    └──enhances──> [Completion Tracking]
                       └──enhances──> [Supervisor Sign-off]
                                          └──enhances──> [Competency Assessment]
                                                             └──requires──> [SOP Versioning]

[SOP Versioning]
    └──enhances──> [Worker Notification on Updates]
                       └──enhances──> [Acknowledgement Tracking]

[Offline-First Sync]
    └──requires──> [Completion Tracking]
    └──enhances──> [Photo Capture as Evidence]

[Quick Reference Mode]
    └──requires──> [Structured Section Rendering]
                       └──requires──> [AI Parsing Pipeline]

[Multi-tenant Data Isolation]
    ──underlies──> [All features] (not a feature, a constraint on every feature)
```

### Dependency Notes

- **AI Parsing is the keystone dependency:** The structured section rendering, quick reference mode, hazard/PPE surfacing, and confidence-score review queue all depend on parsing quality. This is the highest-risk dependency in the system.
- **Completion Tracking requires Versioning:** A completion record is only meaningful if it references the SOP version the worker actually followed. Build versioning before building completion tracking.
- **Supervisor Sign-off requires Completion Tracking:** You cannot sign off what isn't tracked.
- **Offline-First depends on the local data model:** If completion records are designed as server-only, retrofitting offline is very hard. Design local-first from the beginning.
- **Role-Based Access underlies SOP Assignment:** Assignment logic (which workers see which SOPs) is determined by roles. Define the role model before building the assignment UI.
- **Competency Assessment is an enhancement of Sign-off, not a replacement:** Build single-role sign-off first, then extend to multi-role competency chains.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates that AI-parsed SOPs are usable and useful to workers on phones.

- [ ] **Document upload + AI parsing** — The entire product depends on this. If parsing is bad, nothing else matters. Include confidence scoring and admin review queue from the start.
- [ ] **Structured SOP display (hazards, PPE, steps, emergency sections)** — Core value: parsed SOP rendered as native mobile UI, not a PDF.
- [ ] **Step-by-step walkthrough mode** — Primary worker experience. Must work offline.
- [ ] **Quick reference mode** — Safety-critical use case. Worker needs hazard info fast.
- [ ] **Offline caching of assigned SOPs** — Non-negotiable for industrial sites.
- [ ] **SOP library with search** — Workers need to find and launch SOPs.
- [ ] **Photo capture tied to walkthrough step** — Evidence capture is a core workflow, not an add-on.
- [ ] **Completion tracking with timestamp** — Validates whether the app is being used; required for supervisor visibility.
- [ ] **Supervisor sign-off (single-role)** — Digitizes the simplest version of existing competency sign-off.
- [ ] **Role-based access (Worker / Supervisor / Admin)** — Required to show appropriate views to appropriate people.
- [ ] **Multi-tenant organization management** — SaaS product; cannot be bolted on later.
- [ ] **SOP assignment to roles** — Workers see relevant SOPs first; admin assigns.
- [ ] **Image/figure rendering within steps** — SOPs without their figures are incomplete; parsing must extract and display embedded images.

### Add After Validation (v1.x)

Features to add once core parsing + walkthrough loop is validated by real users.

- [ ] **SOP versioning with worker re-acknowledgement** — Add when organizations start updating their SOPs after initial upload.
- [ ] **Worker notification on SOP updates** — Add with versioning; the two features are tightly coupled.
- [ ] **Competency assessment multi-role sign-off chain** — Add when single sign-off is confirmed working; extends the competency workflow.
- [ ] **Audit report export (PDF/CSV)** — Add when supervisors/safety managers ask for it for compliance reporting.
- [ ] **Bulk CSV user import** — Add when organizations have more than ~20 workers to onboard.

### Future Consideration (v2+)

Features to defer until product-market fit is confirmed.

- [ ] **SSO / SCIM integration** — Enterprise ask; high implementation cost. Defer until mid-market organizations are signing up.
- [ ] **Acknowledgement tracking (read receipt workflow)** — Valuable for OSHA/ISO compliance, but requires versioning + notifications to be stable first.
- [ ] **IoT / sensor integration** — Real-time measurement capture from equipment (e.g., auto-fill pressure readings). Very high complexity; niche use case until validated.
- [ ] **Analytics dashboard (completion rates, time per step, drop-off points)** — Valuable for continuous improvement, but requires completion data volume first.
- [ ] **Skills matrix / training assignment** — Dozuki's differentiator in regulated industries. High complexity. Defer until competency assessment is validated.
- [ ] **Multi-language support** — Important for some manufacturing organizations; defer until first international customer.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AI document parsing + admin review | HIGH | HIGH | P1 |
| Step-by-step walkthrough (offline) | HIGH | HIGH | P1 |
| Structured section rendering | HIGH | MEDIUM | P1 |
| Quick reference mode | HIGH | LOW | P1 |
| Multi-tenant data isolation | HIGH | HIGH | P1 (architectural) |
| SOP library + search | HIGH | MEDIUM | P1 |
| Offline caching | HIGH | HIGH | P1 |
| Photo capture in walkthrough | HIGH | MEDIUM | P1 |
| Completion tracking | HIGH | MEDIUM | P1 |
| Role-based access | HIGH | MEDIUM | P1 |
| SOP assignment to roles | MEDIUM | MEDIUM | P1 |
| Supervisor sign-off (single-role) | HIGH | MEDIUM | P1 |
| Image rendering in steps | HIGH | LOW | P1 |
| Hazard / PPE section surfacing | HIGH | LOW | P1 |
| SOP versioning | HIGH | MEDIUM | P2 |
| Worker notification on updates | MEDIUM | MEDIUM | P2 |
| Acknowledgement tracking | MEDIUM | MEDIUM | P2 |
| Competency multi-role sign-off | MEDIUM | HIGH | P2 |
| Audit report export | MEDIUM | LOW | P2 |
| Bulk CSV user import | MEDIUM | LOW | P2 |
| Analytics dashboard | MEDIUM | HIGH | P3 |
| SSO / SCIM | LOW | HIGH | P3 |
| Multi-language | LOW | MEDIUM | P3 |
| IoT / sensor integration | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | SafetyCulture (iAuditor) | Dozuki | MaintainX | Our Approach |
|---------|--------------------------|--------|-----------|--------------|
| Document intake | Template builder (manual) | Manual authoring | Manual authoring | AI-parse existing Word/PDF |
| Mobile UX | Good mobile app | Tablet-optimized | Good mobile app | PWA, glove-friendly, offline-first |
| Offline | Yes | Partial | Yes | Offline-first, background sync |
| Photo capture | Yes | Yes | Yes | Yes, tied to specific step |
| Completion tracking | Yes (as inspection) | Yes | Yes (as work order) | Yes, SOP-specific with version reference |
| Supervisor sign-off | Inspection-level | Approval workflows for authors | Work order level | Step-level and SOP-level, competency chain |
| Version control | Document versioning | Full versioning + approval | Basic | SOP versioning with re-acknowledgement |
| AI features | AI Q&A over docs | CreatorPro AI (authoring) | None prominent | Parsing legacy docs, confidence scoring |
| Quick reference mode | No (step-forward only) | No | No | Yes — dedicated mode for chemical/hazard lookup |
| Structured section rendering | No (PDF/form display) | Work instruction steps | Checklist only | Native mobile UI sections: Hazards / PPE / Steps / Emergency |
| Multi-tenant SaaS | Yes | Yes | Yes | Yes, from day one |
| Competency chains | Limited | Skills matrix (complex) | No | Phased: single sign-off first, then multi-role chain |

---

## Key Findings from Competitor Research

**What SafetyCulture does well:** Mobile-first inspection app, photo capture, offline support, large template library. Weakness: SOPs still require manual creation; rendering is form-based, not document-derived.

**What Dozuki does well:** Version control, approval workflows, structured work instructions, skills matrix. Weakness: Desktop-oriented authoring tool; a "sidecar" to other systems; expensive for SMB manufacturing.

**What MaintainX does well:** Mobile-first, work order integration, maintenance-focused. Weakness: SOP execution is a checklist layer over maintenance workflows, not a standalone procedure tool.

**The market gap this product fills:** None of the above handle the "we have 200 Word documents that are our SOPs, we need them on phones by next month" problem. AI parsing of legacy documents + purpose-built mobile UX for blue-collar workers + offline-first is a combination no single competitor currently offers.

---

## Sources

- [SafetyCulture SOP Software — feature overview](https://safetyculture.com/apps/sop-software)
- [Fabrico — Best SOP Software for Manufacturing (2026)](https://www.fabrico.io/blog/best-sop-software-manufacturing/)
- [Dozuki — Platform Features](https://www.dozuki.com/features)
- [MaintainX — Why SOP Programs Fail](https://www.getmaintainx.com/blog/standard-operating-procedure-program)
- [The CTO Club — Best Connected Worker Platforms 2026](https://thectoclub.com/tools/best-connected-worker-platforms/)
- [Connecteam — Best SOP Software comparison](https://connecteam.com/best-sop-software/)
- [EHS Careers — Mobile Safety App Features Used by Field Workers](https://ehscareers.com/employer-blog/mobile-safety-apps-which-features-actually-get-used-by-field-workers/)
- [Revver — Complete Guide to SOP Management in Manufacturing](https://www.revverdocs.com/the-complete-guide-to-sop-management-in-manufacturing-how-to-digitize-and-automate-your-standard-operating-procedures/)
- [Rostone OpEx — Managing and Updating SOPs: Best Practices](https://www.rostoneopex.com/resources/managing-and-updating-standard-operating-procedures-(sops))
- [Orca Lean — Why Operators Struggle with SOP Compliance](https://www.orcalean.com/article/why-u.s.-operators-struggle-with-sop-complianceand-how-to-fix-it-digitally)
- [Smart Interface Design Patterns — Accessible Tap Target Sizes](https://smart-interface-design-patterns.com/articles/accessible-tap-target-sizes/)

---

*Feature research for: SOP / Procedure Management PWA — industrial workers*
*Researched: 2026-03-23*
