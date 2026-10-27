# ISO and ANZ health and safety best practice: where SOPstart could use it

**Written:** 2026-10-27. This is research, not a plan. Nothing here is decided, and none of it is legal advice: check anything that is sold as compliance against the Act text and the current codes.

## The frame
- **ISO 45001:2018** is the OHS management system standard. In Australia and New Zealand it is adopted as AS/NZS ISO 45001:2018, which superseded AS/NZS 4801 in 2019. Certifiers now audit to it.
- **ISO 9001 §7.5** ("documented information") is the document-control rulebook auditors apply to SOPs.
- **Australia:**
  - the model WHS Act and Regulations;
  - Safe Work Australia model Codes of Practice, which can be admitted in court. The relevant ones are *How to manage WHS risks* and *Managing the risks of plant in the workplace* (Nov 2024 edition).
- **New Zealand:**
  - HSWA 2015;
  - the **Health and Safety at Work Amendment Act 2026**: Royal Assent 9 July 2026, most of it in force **1 April 2027**;
  - WorkSafe guidance, for example *Keeping workers safe when servicing machinery* (lockout).

## The NZ 2026 amendment matters most commercially
The amendment does four things that touch SOPstart:
- It defines a **critical risk**: one likely to cause death, a notifiable injury or illness, a notifiable incident or an occupational disease. Hazards in a new Schedule 1A also count.
- Every PCBU must **prioritise critical risks**. A small PCBU (fewer than 20 workers) must focus on them.
- Controls for critical risks need **more frequent review**.
- **Officers must verify that the resources and processes are actually being used**, and "not just records that they were planned". That duty extends to contractors.

The last point describes SOPstart's records. Each record shows who ran which SOP, on which machine, when, with photos, and who signed it off. That is evidence a control was used. Today SOPstart has the evidence but no way to say "this step is a critical control" and no view that gives an officer that answer.

## Areas, ranked by value to a NZ / AU industrial site

| # | Area | Standard | SOPstart today | Gap and suggested change | Size |
|---|---|---|---|---|---|
| 1 | **Critical risks and critical controls** | HSWAA 2026; ISO 45001 §6.1.2, §8.1.2 | Hazard and PPE step kinds, completion records, photos, sign-off | Mark a step as a **critical control**, linked to a critical-risk type (for example isolation, working at height, mobile plant, confined space). Add an officer view, "critical controls verified", built from the existing records. Critical-control SOPs get a shorter review interval. | Phase |
| 2 | **Hierarchy of controls** | ISO 45001 §8.1.2; WHS Regs r36; HSWA s30 | The AI check reviews wording, not control strength | Tag each hazard's controls by level: eliminate, substitute, isolate or engineer, administrative, PPE. Jev classifies them (cheap and calibrated). The authoring check quietly flags a hazard controlled only by PPE or administrative steps. WorkSafe NZ itself rates lockout as an administrative control. | Medium |
| 3 | **Document control** | ISO 9001 §7.5.3; ISO 45001 §7.5.3 | Versions, approval chain, superseded versions redirect, `review_due_at`, owners | Three changes. (a) **Document codes and a register export**: backlog 999.5, "what auditors ask for". (b) A **"what changed" note** on every new version, because the standard requires "identification of changes". (c) Workers trained on the old version see only the changed steps highlighted on their next read, on the event and with no cron (ADR-0002). | Medium |
| 4 | **Management of change** | ISO 45001 §8.1.3 | `sop_machines` links SOPs to machines | When a machine is edited, replaced or removed on the site map, its linked SOPs go to their owners' inbox as "check this still matches". It runs on the event. | Small |
| 5 | **Worker consultation and participation** | ISO 45001 §5.4; HSWA Part 3 (worker engagement); WHS Act s47–49 | Requests ("Ask for one") | During a run, a worker can say "**this step isn't how we do it**", which becomes a request to the owner. Show a draft to a worker or health and safety representative before approval, and log it to the ledger as consultation. This answers the Visy point, "I don't want to sell the worker out": workers shape the SOP rather than only being recorded against it. | Small–medium |
| 6 | **Audit pack** | ISO 45001 §9.1, §9.2; regulator visits | Ledger, records, training lanes | One export per site or department covering the register, review status, records per SOP, training currency and critical-control verification. This is the "audit-ready" claim on the homepage made concrete. | Medium |
| 7 | **Near miss → corrective action → SOP change** | ISO 45001 §10.2 | Nothing | Keep it light, because Visy said software won't fix under-reporting. Add a "near miss on this step" request type. It links to the step, and closing it records the action, often a new version. | Medium |
| 8 | **Contractors** | ISO 45001 §8.1.4; the HSWAA verification duty covers contractors | No contractor role | A contractor reads and acknowledges a site's SOPs (an induction) with a limited role. Their records count toward critical-control verification. | Medium |
| 9 | **Information workers understand** | HSWA s36; WHS Act s19 (information and instruction) | The clear version (ADR-0015), plain words | Offer a translated clear version (Te reo Māori, Samoan, Tongan, Hindi, Mandarin and so on) from the same approved text, with the translation shown as derived. Common on NZ and AU plant floors. | Medium |
| 10 | **Competence** | ISO 45001 §7.2 | Training lanes, observations, refresher cadence | Mostly covered. One possible addition is **verification of competency** (assessor, date, evidence) for critical-control SOPs. Keep the rule that competence never gates access. | Small |
| 11 | **Emergency preparedness** | ISO 45001 §8.2 | — | An "Emergency" SOP type pinned at the top of each area on the site map, with no step-by-step run. | Small |

## Already strong (worth saying in sales)
- **Append-only decision ledger** with actor and organisation from the session. This is tamper-evident and goes beyond what ISO 9001 §7.5 needs.
- **Versioning with superseded redirects**, which satisfies "prevent unintended use of obsolete documents".
- **AS 1319 sign colours** on hazard and PPE steps (ADR-0013).
- **Owners and review dates on every SOP** (migration 00043).
- **Records with photos and supervisor sign-off.** That is the verification evidence the 2026 NZ amendment asks officers for.

## One thing to check now
The homepage lists **PMs, lockout / tagout, safety meetings and permits to work** as modules. I can find no lockout, permit or toolbox-meeting feature in `src/`, only SOPs. If they are roadmap items, the homepage should say "coming", or a prospect will see them as a claim. Lockout and permits are also both critical-control territory (row 1).

## Suggested order, if pursued
1. **Critical controls and the officer view (1)** with **hierarchy tagging (2)**. One phase, the strongest NZ sales story, and in time for 1 April 2027.
2. **Document codes, register and "what changed" (3)**, then **the audit pack (6)**.
3. The small, event-driven ones: **management of change (4)** and **"this step isn't how we do it" (5)**.
4. The rest when a real site asks.

## Sources
- [DLA Piper: New Zealand enacts significant health and safety reforms (2026)](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/new-zealand-enacts-significant-health-and-safety-reforms)
- [Health and Safety at Work Amendment Bill, legislation.govt.nz](https://www.legislation.govt.nz/bill/government/2026/244/en/latest/)
- [Critter: HSWA Amendment 2026, what changes](https://getcritter.com/critical-risk-governance/health-and-safety-at-work-amendment-bill-2026/)
- [Standards Australia: ISO 45001 published as a joint AU/NZ standard](https://standards.org.au/news/iso-45001-published-as-joint-australian-new-zealand-standard)
- [JASANZ: ISO 45001 migration date](https://www.jasanz.org/stories/iso-45001-migration-date)
- [WorkSafe NZ: keeping workers safe with machine lockouts](https://www.worksafe.govt.nz/topic-and-industry/machinery/keeping-workers-safe-with-machine-lockouts/)
- [Safe Work Australia: model Code of Practice, managing risks of plant](https://safeworkaustralia.gov.au/doc/model-code-practice-managing-risks-plant-workplace)
- SOPstart's own: `.planning/research/customer-interviews/2026-05-05-visy-findings.md`, ROADMAP backlog 999.4–999.6
