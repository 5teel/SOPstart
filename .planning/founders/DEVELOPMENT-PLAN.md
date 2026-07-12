# SOPstart — Founders' Presentation & Discussion Document

_Author: Simon Scott — Lead Developer, Melbourne_
_Audience: Joe (CMO, NZ), Bobby (Silent partner, NZ), Bryce (Silent partner-in-waiting, NZ)_
_Status: Draft v0.2 — 2026-05-20_

> **Important disclaimer.** This document spells out a working model for our company structure, equity split, and tax positioning. The numbers and tax outcomes in §11–§13 are educated estimates based on current AU/NZ tax rules. Before incorporation we **must** get sign-off from a qualified Australian accountant (for Simon / Potenco) and a NZ commercial lawyer (for SOPstart NZ Ltd). Treat this as a structured starting point for our discussion — not as advice to act on without professional review.

---

## Slide 1 — Why we're meeting

We need to align on five things before incorporation:

1. The product vision and the pilot we're committing to (§2–§6)
2. The roadmap beyond the pilot (§7)
3. The legal/commercial structure of the business (§8)
4. The equity split, with eyes open on each founder's pros/cons (§9–§10)
5. How we pay ourselves without losing 40–47% of every dollar to personal income tax (§11–§13)

---

## Slide 2 — One-line summary

SOPstart turns the SOP binders and Word docs that already sit on factory PCs into clear, signed-off, on-the-floor procedures that low-literacy workers can actually follow — starting at Visy NZ, scaling across AU/NZ industrial manufacturing.

---

## Slide 3 — The pain we're solving

| Pain | Source |
| --- | --- |
| SOPs live on office PCs → workers print outdated paper copies | Visy interviews, Phase 13 customer research |
| Workers have low reading/writing comprehension, work in loud environments | Visy interviews |
| Existing SOPs are inconsistent (Word, PDF, scanned image) — no one is going to retype them | Visy corpus inspection |
| Compliance audits demand a signature chain paper printouts can't reliably deliver | Visy compliance team brief |
| Visy alone has ~100 AU/NZ sites (glass, cans, cardboard) — and is actively asking for a fix | Direct ask |

**Wedge:** Visy NZ pilot, NZD $20,000 PO, single site, narrow corpus. Win that, then expand.

---

## Slide 4 — Product outcomes (12-month horizon)

| Outcome | Definition of done |
| --- | --- |
| **O1 — Visy NZ pilot live** | One Visy NZ site running ≥10 converted SOPs daily, with audited completions |
| **O2 — Pilot PO collected** | NZD $20,000 invoiced and paid, reference call agreed |
| **O3 — Conversion pipeline at site-scale** | Visy hands us 50+ raw docs and gets them back as searchable, sign-off-ready SOPs without bespoke dev work per doc |
| **O4 — Print-equivalent SOPs** | Every SOP renders cleanly to A4 PDF — Visy's existing workflow is preserved while we displace it |
| **O5 — Tablet + desktop first-class** | The factory tablet and the office PC are the primary surfaces. Mobile is a bonus |
| **O6 — Second customer pipeline** | Two qualified discovery calls beyond Visy, AU or NZ |

Mobile, video, and capture-coordination are NOT 12-month outcomes — they are 18–30 month outcomes (Slide 7).

---

## Slide 5 — Pilot scope (what earns the NZD $20k PO)

Five capabilities. Anything not on this list is post-pilot.

1. **Convert their actual documents** — DOCX/PDF/image → structured SOPs, photos anchored to the right step, admin review in a builder
2. **Find the right SOP, fast** — full-text + tag search, in-SOP table of contents, jump-to-step
3. **Print-equivalent output** — one-click branded A4 PDF preserving photos, hazards, sign-off lines
4. **Profile-select sign-off (no auth)** — worker taps profile on shared tablet → every approval signs the audit log with their name + signature + timestamp
5. **Audit trail Visy can export** — CSV/PDF per-SOP completion log for compliance audits

**Out of pilot (stated clearly to Visy):** mobile-first walkthrough, video content, AI capture, self-serve org onboarding.

---

## Slide 6 — Build status — honest read

| Capability | Status | Pilot-readiness |
| --- | --- | --- |
| DOCX → structured SOP | Live, side-by-side step+photo (Phase 20 in progress) | ~3 weeks |
| PDF / image OCR → structured SOP | Live (Phase 5) | Ready, tune confidence per Visy corpus |
| Builder + admin review | Live (Phase 13) | Ready |
| Multi-tenant org + RLS | Live (Phase 1) | Ready |
| Worker walkthrough | Live, mobile-first | Needs tablet/desktop pass |
| Photo evidence + completion tracking | Live (Phase 4) | Ready |
| Supervisor sign-off | Live (Phase 4) | Tune for kiosk model |
| Library + search | Live (Phase 3) | Tune ranking + in-SOP nav |
| Offline PWA | Live | Useful for shop-floor tablets |
| **Print-to-PDF** | Not started | **Net new — pilot gate** |
| **Kiosk profile-picker sign-off** | Not started | **Net new — pilot gate** |
| **Audit export** | Data layer only | **Net new — pilot gate** |
| **Visy-skinned tablet/desktop UX** | Not started | **Net new — pilot gate** |

**Bottom line: ~70% of pilot already shipped through existing v1–v3 milestones. Remaining 30% is well-scoped.**

---

## Slide 7 — Phased roadmap

| Phase | Window | Goal |
| --- | --- | --- |
| **P0 — Pilot Earn** | 8–10 weeks from kickoff (target 2026-Q3) | Earn the NZD $20k Visy NZ PO |
| **P1 — Pilot Expand** | Q4 2026 → Q1 2027 | Visy ongoing contract, second customer discovery, mobile hardened |
| **P2 — Capture Coordination** | Q2–Q3 2027 | Site managers allocate capture; 2-person video capture with AI scene description |
| **P3 — Video-first SOPs** | Q4 2027 → 2028 | Step-level video clips with chapters, auto overlay, voiceover |
| **P4 — POV Glasses** | 2028+ | Single-operator capture via smart glasses (Meta / Vuzix-class) |

Backlog / opportunistic: native iOS/Android apps, voice Q&A, HR/ERP integration (Visy uses Success Factors), real-time multi-worker coordination.

---

## Slide 8 — Business structure recommendation

**Recommendation: Form a new NZ company — SOPstart NZ Ltd — with all four founders as shareholders. Simon's stake is held by Potenco Pty Ltd, not Simon personally.**

### Why a new NZ entity (not "just use Potenco")

| Factor | New SOPstart NZ Ltd | Use Potenco Pty Ltd |
| --- | --- | --- |
| First customer is NZ-based, NZD-invoiced | ✅ Natural fit, NZ GST clean | ⚠️ AU-NZ cross-border GST, withholding |
| 3 of 4 founders are NZ residents | ✅ Local entity for local people | ⚠️ AU resident director majority complicates things |
| Simon's other consulting work runs through Potenco | ✅ Clean separation | ❌ Mixes unrelated revenue; bad for valuation/exit |
| Future investor / acquirer DD | ✅ Single-purpose entity is standard | ❌ Carve-out is painful |
| Speed to start | ⚠️ Incorporation + agreement = 4–6 weeks | ✅ Today |

**The structure:**

```
SOPstart NZ Ltd (NZ-incorporated)
  ├── Potenco Pty Ltd (AU) ← Simon's holding vehicle for his stake
  ├── Joe (NZ individual, or via Joe's holding co)
  ├── Bobby (NZ individual, or via Bobby's holding co)
  └── Bryce (NZ individual, or via Bryce's holding co — vests on pilot)
```

**Why Simon goes through Potenco rather than holding shares personally:**

1. Potenco is the entity that actually performs the AU-based development work, invoices SOPstart NZ Ltd, and is eligible for the AU R&D Tax Incentive (§13). Aligning the share register with the entity that bears the AU corporate footprint keeps the IP, the revenue, and the tax position consistent.
2. Dividend flows from SOPstart NZ Ltd → Potenco are taxed at company rates and can be retained in Potenco for reinvestment, instead of hitting Simon's personal income at 47%.
3. On exit, capital gains are realised inside Potenco (eligible for AU small business CGT concessions if the conditions are met) rather than against Simon personally.

**Why other founders should consider holding through their own holding company:**

Same logic in reverse — directly held shares produce dividend income that hits each founder's NZ marginal rate (33% or 39%). Holding companies allow income to be retained at 28% NZ corporate tax until distribution. Worth a brief chat with their own accountants.

---

## Slide 9 — Equity split sketch (starting point for discussion)

This is **a starting point, not a settled position**. The numbers should be debated openly.

### Principles I've used

1. **Anchor founder weighting** — Simon is the sole technical founder, doing the build, taking the operational and IP-creation risk. SaaS founder studies (Carta, Y Combinator) put sole-technical-founder stakes typically at 50–60% pre-ESOP.
2. **Active co-founder weighting** — Joe is going to be working the commercial side actively (CMO role), so weighted accordingly.
3. **Silent partner weighting** — Bobby is contributing capital/network, not labour. Modest stake reflecting that.
4. **Future joiner weighting** — Bryce joins post-pilot, so a smaller initial stake that vests on pilot delivery is fair to current contributors.
5. **ESOP reserve** — 10% set aside for future hires (we will almost certainly need to bring on a second dev for P1 expansion, and possibly a NZ-based ops/training lead).

### Sketch

| Holder | Stake | Vesting | Rationale |
| --- | --- | --- | --- |
| **Simon (via Potenco Pty Ltd)** | **45%** | 4-year vest, 25% cliff at 12 months from incorporation | Lead developer, sole technical founder, IP creator, full-time builder during P0 |
| **Joe** | **22%** | 4-year vest, 25% cliff at 12 months | CMO, active commercial role, Visy relationship lead |
| **Bobby** | **13%** | Fully vested at incorporation | Silent partner, capital/network contribution |
| **Bryce** | **10%** | Vests in full on pilot PO collection (binary milestone) | Joins post-pilot; vesting tied to milestone he hasn't yet contributed to |
| **ESOP (option pool)** | **10%** | Granted to future hires with their own vesting | Reserve for second dev, ops/training lead, future commercial hires |
| **Total** | **100%** | | |

### How this compares to common splits

- Sole technical founder typically 45–60% — Simon at 45% is **on the lower end**, reflecting that Joe is more active than a typical co-founder and that we're carrying two silent partners
- Active business co-founder typically 20–30% — Joe at 22% is **on the lower end**, reflecting that he's not currently full-time
- Silent partners typically 5–15% combined — Bobby + Bryce at 23% combined is **on the higher end**; defensible only if their contributions (capital, network, sales doors at Visy) materially de-risk the venture
- ESOP at 10% is **standard for pre-seed**

### Discussion prompts

- Is Simon at 45% the right anchor given he's carrying all the build risk? Higher (50–55%) is defensible.
- Are Bobby and Bryce making contributions that justify ~13% / ~10%? If primarily capital, what dollar amount? If network, what specific doors do they open?
- Should Joe vest on commercial milestones (e.g., 50% of his stake unlocks at Visy PO; remainder over time) rather than pure time-vest?
- Does ESOP need to be larger (15%) if we know we're hiring a second dev in P1?

---

## Slide 9A — How vesting works when shares are held by Potenco (or any holding company)

This is the critical mechanical detail: **vesting is a contractual feature, not a tax feature**, and it has to be re-engineered slightly when the shareholder is a company (Potenco) rather than a natural person (Simon).

### The core problem

Normal founder vesting says: "If the founder stops working, unvested shares are clawed back." That clause assumes the founder is *also* the shareholder. When Potenco holds the shares, Simon could theoretically leave SOPstart NZ Ltd entirely while Potenco keeps the full 45%. That's obviously not what we want.

### The solution — "reverse vesting" with a service condition

This is standard practice for founder vehicles (used by virtually every VC-backed startup where founders hold via family trusts or holding cos).

**How it works:**

1. **All 45% issues to Potenco on day one.** Legally, Potenco owns the full stake from incorporation.
2. **SOPstart NZ Ltd has a contractual right (not obligation) to buy back unvested shares at nominal value (NZD $1 total).** This right is set out in the Shareholders Agreement.
3. **The buyback right falls away on a vesting schedule** — each tranche that vests becomes "safe" (no longer subject to buyback).
4. **The vesting schedule is tied to Simon's continued service** via a defined "Service Condition" in the Shareholders Agreement.

### The Service Condition — what keeps shares vesting

Shares only continue to vest while ALL of the following are true:

| Service Condition Test | Plain English |
| --- | --- |
| **Simon controls Potenco** (≥51% beneficial ownership + director) | Simon can't sell Potenco to a third party and keep SOPstart vesting |
| **Potenco delivers under the Services Agreement** with SOPstart NZ Ltd | If Potenco stops working for SOPstart, vesting stops |
| **Simon personally performs the services** through Potenco | Simon can't sub out all the dev work to a stranger and keep vesting |
| **No material breach of either agreement** | Working for a direct competitor, IP theft, gross misconduct = breach |

If any of these fail, the Service Condition is broken and Simon (via Potenco) becomes a "Leaver" — see below.

### Concrete vesting schedule for Simon's 45%

Standard 4-year vest with 12-month cliff, expressed in actual SOPstart NZ Ltd shareholding %:

| Date (months from incorporation) | Cumulative vested | Subject to buyback |
| --- | --- | --- |
| 0 (incorporation) | 0% | 45% |
| 11 months | 0% | 45% |
| **12 months (cliff)** | **11.25% (25% of stake)** | **33.75%** |
| 13 months | ~12.19% | ~32.81% |
| 24 months | 22.5% (50%) | 22.5% |
| 36 months | 33.75% (75%) | 11.25% |
| **48 months** | **45% (100%)** | **0%** |

Post-cliff vesting is monthly, in 36 equal tranches of 0.9375% each.

The same mechanic applies to Joe's 22% (4-year vest, 12-month cliff) — substitute his service condition (continued CMO engagement) for Simon's. Bobby's 13% is fully vested at incorporation (no buyback right). Bryce's 10% issues at incorporation but is fully subject to buyback until the **pilot PO is collected**, at which point it vests 100% in a single tranche.

### Leaver definitions — what happens when the Service Condition breaks

Standard market practice splits departures into two categories:

| Category | Triggers | What happens to UNVESTED shares | What happens to VESTED shares |
| --- | --- | --- | --- |
| **Good Leaver** | Death, permanent disability, mutual agreement to part, termination without cause | Bought back at **fair market value** (FMV) — or in some structures, accelerated 12-month vesting credit | Retained by Potenco — paid out at FMV if company chooses to buy back |
| **Bad Leaver** | Voluntary resignation before vest completion, termination for cause (fraud, gross misconduct, material breach), Simon selling control of Potenco | Bought back at **nominal value (NZD $1 total)** — i.e., forfeited | Bought back at the **lower of FMV or cost** — i.e., Potenco gets its original investment back, not the appreciation |

The exact dividing line between Good and Bad needs the lawyer's eye. Common edge cases:
- Simon resigns to take a competing role → Bad Leaver
- Simon resigns because Joe and Bobby outvote him on direction → arguable, typically Good Leaver via mutual agreement
- Simon's health forces him to step back → Good Leaver

### What this means for Simon practically

- Potenco holds 45% on paper from day one, but Simon is **functionally** earning that stake over 4 years
- If Simon walks at month 18 voluntarily, Potenco keeps 16.875% (vested) and loses 28.125% (unvested clawed back at $1)
- If Simon dies at month 18, Potenco keeps 16.875% PLUS another 11.25% (12-month acceleration credit), so 28.125% total — distributable to Simon's estate
- Selling Potenco to a third party is a **deemed departure** — the third party can't inherit Simon's vesting. This protects the other founders from "Simon sells out and a stranger ends up at 45%"

### What this means for IP

Critical detail: the Services Agreement must include **automatic IP assignment** from Potenco to SOPstart NZ Ltd for all work product produced for SOPstart. Without this, if Simon becomes a Bad Leaver, Potenco could theoretically keep the IP. The agreement assigns IP **as it's created**, not on completion of vesting, so the IP is always safe inside SOPstart NZ Ltd regardless of vesting outcomes.

### Open questions for the lawyer

1. Do we use **single-trigger** or **double-trigger** acceleration on change of control? (Single-trigger = full vest on company sale. Double-trigger = full vest on sale AND involuntary termination within X months post-sale. Double-trigger is more common, more acquirer-friendly.)
2. Should there be a small "founder grant" pool of shares that vests immediately at incorporation (e.g., 5% of each active founder's stake) to recognise pre-incorporation work?
3. What's the dispute mechanism if a founder claims Good Leaver and the others vote Bad Leaver?

---

## Slide 10 — Pros & cons per founder

Each founder reads this section asking "is this fair to me, and what am I signing up for?"

### Simon (45% via Potenco)

| Pros | Cons |
| --- | --- |
| Largest single stake; aligned with build/IP risk | Bears all the technical execution risk; if pilot misses, that's on him |
| Dev work flows through Potenco (AU company tax 25%) instead of personal salary (47%) — see §11 | PSI rules in AU (§11) require careful structuring; if mishandled, the 25% benefit collapses back to 47% |
| Eligible for AU R&D Tax Incentive on AU-based dev spend — up to 43.5% refundable offset — see §13 | R&D claim requires annual AusIndustry registration, technical documentation, and audit risk |
| Existing Potenco infrastructure (accountant, bank, ABN, software) — minimal setup overhead | Mixing SOPstart work with other Potenco clients is fine, but PSI safety improves with multiple clients (currently a strength) |
| Capital gains on exit realised inside Potenco — potential AU small business CGT concessions if held >12 months | Cash flow during P0: Simon's existing salary continues, but P0 dev hours are unpaid until pilot revenue lands |
| 4-year vest means he's locked in but also protected if a co-founder exits early | Lock-in cuts both ways — Simon can't walk if life circumstances change without forfeiting unvested shares |

### Joe (22%)

| Pros | Cons |
| --- | --- |
| Second-largest stake, recognising active commercial role | Smaller than typical co-founder share, reflecting part-time involvement |
| Visy relationship is high-leverage — closing the pilot is most likely "earned" largely by Joe | If Visy stalls, Joe's contribution is harder to quantify until the next customer is in pipeline |
| Stake structure protects against doing all the sales work for an equity holder who walks | Time vest may feel unfair if commercial milestones land before vest cliff |
| As CMO, has clear board influence and decision rights | Living in NZ, working AU/NZ hours — coordination overhead with Simon |
| NZ dividend imputation credits offset most NZ tax on distributions (see §12) | Day-job income already at NZ top bracket — any salary from SOPstart is heavily taxed |

### Bobby (13%, fully vested)

| Pros | Cons |
| --- | --- |
| Fully vested at incorporation — no claw-back if life circumstances change | Highest absolute %age outside the active builders — bears scrutiny from Joe/Simon |
| No operational obligations — pure shareholder | No board seat, limited say in direction |
| Dividends flow through NZ imputation system — tax efficient if structured via holding co | Day-job income at NZ top bracket — salary not viable |
| Capital contribution (assumed) creates leverage for early infrastructure / legal costs | Capital "in" sets a valuation precedent — needs careful framing |
| Liquidity event on exit aligned with active founders | Time horizon to liquidity is likely 5–7 years; capital is illiquid until then |

### Bryce (10%, vests on pilot)

| Pros | Cons |
| --- | --- |
| Lower-risk entry — only commits once pilot is proven | Smallest stake — reflects late entry, not signal of value |
| Cleanly defined trigger (pilot PO collected) — no ambiguity on when shares unlock | If pilot is delayed, Bryce's stake stays unvested longer than he might prefer |
| Same passive structure as Bobby once vested | No influence on pre-pilot direction |
| Demonstrates discipline — we don't dilute up-front for someone not yet contributing | Bryce may negotiate for partial vest at incorporation as recognition for pre-commitment |
| Joining alongside an already-validated pilot reduces his personal risk significantly | He misses the upside compression that comes from being a day-one shareholder |

---

## Slide 11 — Tax impact: Simon (Australia)

**The core problem:** Simon already earns at AU top marginal tax rates from his Summit Insights day job. Any SOPstart-related personal income gets taxed at **47% (45% + 2% Medicare levy)** above AUD $190k.

So we must avoid Simon taking personal salary or dividends from SOPstart NZ Ltd until well after the pilot, and even then route through Potenco wherever legally possible.

### AU personal tax brackets (2025–26, resident rates)

| Income (AUD) | Marginal rate | + Medicare 2% |
| --- | --- | --- |
| $0 – $18,200 | 0% | 0% |
| $18,201 – $45,000 | 16% | 18% |
| $45,001 – $135,000 | 30% | 32% |
| $135,001 – $190,000 | 37% | 39% |
| $190,001+ | 45% | **47%** |

### Three ways money can reach Simon — and what each costs

| Route | Tax cost to Simon | Notes |
| --- | --- | --- |
| **1. Salary from SOPstart NZ Ltd directly to Simon** | **~47% AU marginal** + NZ payroll/withholding complications | Worst option. NZ entity pays AU-resident employee = administrative pain + Simon loses ~half. **Avoid.** |
| **2. SOPstart NZ Ltd pays Potenco for development services (Simon retains Potenco salary at minimum threshold; rest stays as retained earnings)** | **25% AU company tax** on Potenco profits | Best option. PSI rules and transfer pricing must be navigated. Potenco retains earnings or pays modest salary to Simon up to the 32% bracket. |
| **3. Dividend from SOPstart NZ Ltd → Potenco → eventual dividend to Simon when he's no longer at top bracket (e.g., career break, semi-retirement)** | **25% company tax in Potenco** + personal rate when finally distributed (potentially 32% or lower if timed) | Best long-term wealth route. Defer personal distribution until marginal rate drops. |

### The Personal Services Income (PSI) trap

The ATO's PSI rules are the single biggest risk to the Potenco-as-contractor structure.

**Trigger:** If more than 50% of Potenco's revenue from SOPstart work is for Simon's personal effort/skills (i.e., he's the one writing the code), the income is classified as PSI and **taxed at his personal marginal rate (47%)** regardless of corporate structure.

**The 80% rule:** If more than 80% of Potenco's income comes from a single client (here, SOPstart NZ Ltd), it's automatically PSI unless Potenco passes the **Results Test**.

**The Results Test — Potenco can pass it if:**
1. ✅ Paid to produce a specific result (deliverable software / pilot launch / phase completion) — **yes, contracts should be structured as fixed-fee for milestones**
2. ✅ Supplies its own tools/equipment — **yes, Simon owns the dev hardware**
3. ✅ Liable to rectify defects at own cost — **yes, build that into the SOPstart-Potenco agreement**

**Mitigations to lock in:**
- Draft the Potenco ↔ SOPstart NZ Ltd contract as **fixed-fee milestone deliverables** (not hourly), pass the Results Test
- Keep Potenco's other consulting clients active — diversification helps the 80% rule
- Document each milestone deliverable as a "result" with acceptance criteria

If we can't pass the Results Test, Potenco's SOPstart income is effectively taxed at 47% and the whole AU-side structuring benefit collapses. **This is the single most important detail to confirm with an AU accountant before incorporation.**

### Transfer pricing — arm's length only

Because Potenco (AU) and SOPstart NZ Ltd (NZ) are related parties, the price Potenco charges must be at "arm's length" — what an unrelated NZ company would pay for equivalent services. ATO and IRD both audit this.

**Safe approach:**
- Get one quote from an independent AU dev shop for equivalent scope
- Set Potenco's rate at or near that quote with a documented small margin (10–20%)
- Document the methodology before invoicing

### Net effect for Simon (illustrative)

Assume P0 development effort = AUD $80,000 of equivalent contractor value over 8–10 weeks.

| Route | Pre-tax | After AU tax | Effective rate |
| --- | --- | --- | --- |
| Personal salary (top bracket) | $80,000 | ~$42,400 | 53% retained |
| Potenco contractor revenue (Results Test passes), retained inside Potenco | $80,000 | ~$60,000 (after 25% company tax) | 75% retained |
| Potenco contractor revenue + R&D Tax Incentive offset (see §13) | $80,000 | **~$77,000 effective** if R&D-eligible spend | **~96% retained** |

The R&D Tax Incentive is the real lever. Slide 13 covers it.

---

## Slide 12 — Tax impact: NZ founders (Joe, Bobby, Bryce)

Each NZ founder is already earning at NZ top brackets from their day jobs.

### NZ personal tax brackets (2025–26)

| Income (NZD) | Marginal rate |
| --- | --- |
| $0 – $15,600 | 10.5% |
| $15,601 – $53,500 | 17.5% |
| $53,501 – $78,100 | 30% |
| $78,101 – $180,000 | **33%** |
| $180,001+ | **39%** |

NZ company tax: **28%**.

### Distribution mechanics

**Salary from SOPstart NZ Ltd to NZ-resident founder:** Taxed at marginal rate (33% or 39%). Same trap as Simon's Australian situation — avoid.

**Dividend from SOPstart NZ Ltd to NZ-resident founder:** NZ imputation credits attach (since the company has already paid 28% NZ tax on the underlying profit). The founder pays the difference up to their marginal rate.

| Recipient bracket | Effective top-up tax | Total effective rate |
| --- | --- | --- |
| 33% bracket | 5% top-up | 33% total |
| 39% bracket | 11% top-up | 39% total |

So a NZ founder taking a NZD $10,000 dividend at the 33% bracket pays NZD $500 extra (after the imputation credit), effective ~33% overall.

**Better: route through a NZ holding company.** SOPstart NZ Ltd dividend → founder's holding co at 28% (or 0% if fully imputed) → retain inside holding co for reinvestment / wait for a lower-tax year. Each founder's accountant should advise.

### Withholding considerations

Dividends from SOPstart NZ Ltd to NZ-resident shareholders are clean. Dividends to Simon's Potenco (AU resident) carry a 15% NZ Non-Resident Withholding Tax (NRWT) under the AU-NZ Double Tax Agreement (potentially 5% if Potenco holds ≥10%). Potenco then claims a Foreign Income Tax Offset (FITO) against AU company tax, so the net leakage is small but non-zero.

### Net effect

| Founder | Best structure | Top-bracket effective rate |
| --- | --- | --- |
| Joe / Bobby / Bryce | Hold through own NZ holding co, retain until distribution timing is favourable | 28% retained inside holding co, 33–39% when ultimately personally distributed |
| Joe / Bobby / Bryce | Hold shares directly | 33–39% effective on dividends after imputation top-up |
| Joe / Bobby / Bryce | Take salary | 33–39% directly, no imputation benefit, plus PAYE admin |

Conclusion for NZ founders: **don't take salaries; take dividends; prefer holding-co structure if your existing tax position justifies the setup cost.**

---

## Slide 13 — Offsetting AU development costs (the R&D Tax Incentive)

This is the single largest financial lever Simon can pull, and it only works because development happens in Australia.

### What it is

The **Australian R&D Tax Incentive (R&DTI)** gives a refundable tax offset to AU-resident companies conducting eligible R&D in Australia.

For an entity with aggregated annual turnover under AUD $20M (Potenco qualifies):
- **Refundable tax offset = corporate tax rate + 18.5% premium**
- For Potenco (25% base rate entity): **25% + 18.5% = 43.5% refundable offset on eligible R&D spend**

"Refundable" means: if the offset exceeds Potenco's tax liability, the ATO **pays the difference in cash**. This is real money in the bank, not just a deduction.

### What's eligible

**Core R&D activities** must:
- Involve experimental work with technical uncertainty (outcome not knowable in advance to a competent professional)
- Be conducted for the purpose of generating new knowledge

**Supporting R&D activities** must be directly related to core activities.

**SOPstart-relevant work that likely qualifies:**
- AI parsing pipeline development (DOCX/PDF/image → structured SOPs with novel image-anchoring)
- AI scene description for video capture (P2)
- Auto-generated voiceover and text overlay synthesis (P3)
- Reliable offline-first sync engine for mixed-connectivity industrial environments
- Novel kiosk sign-off architecture without traditional authentication

**Likely NOT eligible:**
- Standard CRUD / admin UI
- Configuration / customer onboarding work
- Marketing site, documentation
- Bug-fixing / maintenance

A typical SaaS company might claim 40–60% of its dev spend as R&D-eligible. For SOPstart's AI-heavy pipeline, the ratio is likely on the higher end.

### Mechanics

1. **Register annually with AusIndustry** within 10 months of financial year end
2. **Document each R&D activity** — hypothesis, technical uncertainty, experimental approach, outcomes
3. **Track eligible expenditure** — salaries (Simon's Potenco salary, apportioned to R&D), contractor costs, software, cloud (Supabase, OpenAI), etc.
4. **Lodge the R&D schedule** with Potenco's annual tax return
5. **Receive the refundable offset** as cash or applied against tax liability

### Illustrative numbers (P0 only)

Assume Potenco's P0 SOPstart-related spend = AUD $80,000.

| Eligible portion | R&D spend | Refundable offset @ 43.5% | Effective net cost to Potenco |
| --- | --- | --- | --- |
| 50% eligible | $40,000 | $17,400 | **$62,600** |
| 70% eligible | $56,000 | $24,360 | **$55,640** |
| 90% eligible | $72,000 | $31,320 | **$48,680** |

If the bulk of P0 work is AI pipeline, builder, and offline sync (all defensibly experimental), we're realistically targeting the 70–90% band.

### Compliance overhead

- Annual AusIndustry registration: ~1 day of Simon's time + accountant fees (typically AUD $2–5k)
- Audit risk is real but well-understood — contemporaneous documentation is key
- Don't claim what's not defensible — overclaiming and losing on audit costs more than the modest claim it would have replaced

### Net effect

The R&D Tax Incentive is the structural reason Simon should not personally hold SOPstart shares. Potenco holds them, Potenco does the R&D, Potenco claims the offset, and the refund stays inside Potenco's balance sheet — building Simon's wealth at company tax rates rather than personal tax rates.

### Other AU-side offsets worth knowing

| Offset | Relevance |
| --- | --- |
| **Export Market Development Grants (EMDG)** | If SOPstart starts selling to AU/NZ from AU-side marketing spend, Potenco may be eligible for 50% reimbursement on certain export marketing costs. Lower priority — review after first paid customer. |
| **Instant asset write-off** | Capital purchases (laptops, capture equipment, video glasses for P4) can be fully deducted in year of purchase, subject to threshold (currently $20,000 per asset for small business). Standard practice. |
| **Small business CGT concessions** | On a future exit, Potenco may qualify for 50% active asset reduction + 15-year exemption / retirement exemption / rollover, materially reducing the AU tax on Simon's eventual capital gain. Worth a dedicated conversation with the accountant 6–12 months before any exit. |

---

## Slide 13A — Sale of the company (full exit to a third-party acquirer)

This slide spells out what happens if the four of us collectively decide to sell SOPstart — to a strategic acquirer (e.g., a larger SaaS player), a private equity buyer, or a competitor.

### The legal mechanics

These four clauses live in the Shareholders Agreement and are what actually drive a sale:

| Clause | Plain English | Recommended threshold |
| --- | --- | --- |
| **Drag-Along** | If shareholders holding ≥75% of voting shares agree to sell to a bona fide third-party buyer, they can **compel** the remaining shareholders to sell on the same terms | **75%** |
| **Tag-Along** | If majority sells, every remaining shareholder has the right to be **included** in the same deal at the same per-share price | **100% of remaining holders can tag** |
| **Pre-emption on transfers** | Before any shareholder sells to an outsider, they must first offer their shares to existing shareholders at the same price | Standard ROFR (Right of First Refusal) |
| **Change of control acceleration** | What happens to unvested shares on a sale (single-trigger vs double-trigger — see Slide 9A) | **Double-trigger** is recommended for acquirer-friendliness |

At 75% drag-along threshold, our shareholding works out as follows:

| Group | Voting % | Can they trigger drag alone? |
| --- | --- | --- |
| Simon (Potenco) | 45% | No — needs Joe + at least one of Bobby/Bryce |
| Simon + Joe | 67% | No — still short of 75% |
| Simon + Joe + Bobby | 80% | **Yes** |
| Simon + Joe + Bryce | 77% | **Yes** |
| Joe + Bobby + Bryce | 45% | No — Simon's consent is required |

This means: **no single founder can force a sale, but any three founders aligned can.** Simon is protected (no sale without him agreeing), and the silent partners are protected (no sale without at least one of them agreeing if Simon and Joe align).

### Worked example — full sale for NZD $5,000,000

Assume year 3, all founders fully vested (or accelerated via change-of-control trigger), ESOP fully exercised, no external debt.

| Shareholder | Stake | Gross proceeds | Notes |
| --- | --- | --- | --- |
| Simon (via Potenco) | 45% | NZD $2,250,000 | Lands in Potenco — see AU tax below |
| Joe | 22% | NZD $1,100,000 | NZ-resident shareholder — see NZ tax below |
| Bobby | 13% | NZD $650,000 | NZ-resident shareholder |
| Bryce | 10% | NZD $500,000 | NZ-resident shareholder |
| ESOP exercises | 10% | NZD $500,000 | Net of exercise price, taxed as employee benefit at exercise |
| **Total** | **100%** | **NZD $5,000,000** | |

### Tax on sale, by holder

**Simon (Potenco, AU resident)**

Sale proceeds land in Potenco. Potenco realises a capital gain.

| Step | Calculation |
| --- | --- |
| Proceeds | NZD $2,250,000 (≈ AUD $2,070,000 at indicative rate) |
| Less cost base | ~$0 (shares acquired at incorporation for nominal value) |
| Gross capital gain | ~AUD $2,070,000 |
| NZ withholding on sale (if applicable) | 0% under AU-NZ DTA for share sales by non-residents (generally — confirm with lawyer) |
| AU capital gain | ~AUD $2,070,000 |
| **If Potenco qualifies for SBE CGT concessions:** | |
| 50% active asset reduction | -$1,035,000 |
| 15-year exemption (if held >15y) OR retirement exemption ($500k cap) OR rollover | varies |
| Taxable gain (illustrative, no 15-yr exemption) | ~$535,000 |
| AU company tax @ 25% | ~$134,000 |
| **Net to Potenco** | **~AUD $1,936,000** (≈ 93% retained, vs ~52% if held personally) |

The Small Business CGT Concessions (50% active asset reduction + retirement exemption + others) are the difference between Simon netting ~$1.94M and ~$1.08M. Worth their own conversation with the accountant **12 months before any planned exit**, because qualifying conditions require pre-planning.

**NZ founders (Joe, Bobby, Bryce)**

NZ does not have a general capital gains tax. Provided the founder shares were:
1. Not acquired with the dominant purpose of resale (passes the "intention test")
2. Held for a meaningful period (typically several years)
3. Not part of a share-trading business

…the sale proceeds are likely **tax-free** at the personal level.

This is a huge structural advantage for the NZ founders. A NZ-resident individual selling SOPstart shares in a genuine business exit typically pays $0 tax on the gain.

**Caveats:**
- The "bright-line" rule for property doesn't apply to shares, but IRD will scrutinise short-hold or quick-flip transactions
- If shares are held via a NZ holding company, the sale proceeds enter the holding co tax-free, and dividend tax applies only when the founder distributes from the holding co to themselves personally
- ESOP holders (employees exercising options) are taxed differently — the gain between exercise price and sale price is generally treated as employment income, taxed at marginal rate

### Side-by-side: net to each founder on a $5M sale

| Founder | Gross | Estimated tax | Estimated net | Effective retention |
| --- | --- | --- | --- | --- |
| Simon (Potenco, SBE concessions apply) | $2,250,000 | ~$134,000 | ~$2,116,000 | 94% |
| Simon (Potenco, no SBE concessions) | $2,250,000 | ~$517,000 | ~$1,733,000 | 77% |
| Joe (NZ, capital gain tax-free) | $1,100,000 | ~$0 | ~$1,100,000 | 100% |
| Bobby (NZ, capital gain tax-free) | $650,000 | ~$0 | ~$650,000 | 100% |
| Bryce (NZ, capital gain tax-free) | $500,000 | ~$0 | ~$500,000 | 100% |

**This is why the NZ entity structure is the right call** even before considering Simon's AU positioning. NZ founders win on exit tax. Simon wins on operating tax (R&D incentive) inside Potenco.

### Process — what an actual sale looks like

1. **Offer received** (or initiated via banker)
2. **Board reviews and recommends** to shareholders
3. **Shareholders vote** — drag-along requires ≥75% in favour
4. **Due diligence period** — typically 30–60 days; acquirer reviews books, code, IP, contracts
5. **Definitive agreement signed** with conditions precedent (regulatory approval, escrow, etc.)
6. **Completion** — funds flow, shares transfer
7. **Earn-out / lock-up period** (often 12–24 months) — founders may be locked into the acquirer with deferred consideration tied to continued performance

Realistic timeline from first offer to cash in bank: **4–8 months**.

---

## Slide 13B — One founder buying another out (partial exit)

This is the messier scenario, and the one most worth thinking through in advance. It happens when one founder wants to leave but the others want to keep building.

### When this typically happens

- A founder loses interest, has a life event, or wants liquidity
- A founder underperforms and the others want to remove them
- Founders disagree on direction and one wants out
- A new investor wants more equity and an existing founder is willing to sell down

### The default mechanism — Right of First Refusal (ROFR)

The Shareholders Agreement requires that any departing founder must first offer their shares to existing shareholders, in proportion to current holdings, at a defined price.

**Step by step:**

1. **Departing founder serves a Transfer Notice** specifying the shares, the proposed price, and (if relevant) the third-party buyer
2. **Remaining shareholders have 30 days to accept**, pro-rata to their existing stakes
3. **If fully taken up** — shares transfer, departing founder receives cash, cap table updates
4. **If only partially taken up** — taking shareholders absorb their share, remaining unsold shares can be offered to a third party at no less than the noticed price (so departing founder can't sell to a friend at a discount that bypasses the ROFR)
5. **If no takers** — departing founder can sell to a bona fide third party at the noticed price, subject to drag-along/tag-along (Slide 13A) and a "consent to transferee" check (so a competitor or hostile party can be blocked)

### How the price gets set — three options

| Option | How it works | When to use |
| --- | --- | --- |
| **A. Mutual agreement** | Departing founder and remaining founders negotiate | Default — try this first |
| **B. Independent valuation** | An agreed valuer (typically a Big-4 or specialist boutique) sets fair market value | When negotiation stalls; cost is split (typically departing pays 50%, remaining 50%) |
| **C. Formula** | Pre-agreed formula in Shareholders Agreement (e.g., 4× trailing 12-month ARR for SaaS) | Provides predictability but may distort outcomes when company is in flux |

**Recommended:** A first, B as fallback, C as floor/ceiling sanity check.

### The Shotgun Clause — for when things break down

If founders can't agree on price and no third-party buyer materialises, a shotgun clause prevents stalemate.

**How it works:**
1. Founder A (the one initiating) offers to **buy** Founder B's shares at price X, OR
2. Founder B can **flip it** and require Founder A to **sell** their shares at the same price X
3. Whoever named the price is bound by it either way

This forces fair pricing — Founder A can't lowball because Founder B can flip the offer and buy A out cheap. Usually the wealthier or more committed party prevails, which is generally aligned with who should be staying with the company.

Worth including as a last-resort mechanism in the Shareholders Agreement, but with a 6–12 month "cooling off" requirement before it can be triggered.

### Payment terms — cash vs deferred

A single founder rarely has $1M+ in liquid cash to buy out another founder. Standard structures:

| Structure | How it works | Pros | Cons |
| --- | --- | --- | --- |
| **Cash on completion** | 100% paid upfront | Clean break, no ongoing relationship | Requires the buying founder(s) to raise the cash — bank loan, personal capital, or external investor |
| **Vendor finance** | Buying founder(s) pay 20–40% upfront, rest over 24–36 months at agreed interest rate | Manageable cashflow; departing founder gets steady income | Departing founder still has financial relationship with the company; default risk |
| **Company buy-back** | SOPstart NZ Ltd buys the shares itself, using retained earnings or new debt; shares move to treasury and remaining founders' % increases proportionally | No founder needs to find the cash personally | Reduces company working capital; subject to NZ Companies Act solvency tests |
| **External investor buy-in** | New investor takes departing founder's shares directly | No founder cashflow burden | Brings a new shareholder onto the cap table with potentially different incentives |

**Recommended default:** Company buy-back (where solvency permits) + vendor finance to bridge any gap. This is the cleanest structure for a small founder-only company.

### Worked example — Joe buys Simon out at year 3

Hypothetical: year 3, company valued at NZD $3,000,000, Simon decides to exit (Good Leaver — mutual agreement). Simon is 100% vested.

| Step | Detail |
| --- | --- |
| Simon's stake | 45% = NZD $1,350,000 at agreed valuation |
| Initial offer | Joe offers $1.2M (negotiating below valuation) |
| Counter-offer | Simon counters at $1.35M (full valuation) |
| Settled price | $1.275M (midpoint) — both compromise |
| Payment structure | $300k cash on completion (Joe + company contribute), then $300k per year over 3 years from company earnings |
| Joe's stake after | 22% + 45% = 67% (Joe now controlling shareholder) |
| Bobby's stake after | 13% (unchanged) |
| Bryce's stake after | 10% (unchanged) |
| ESOP | 10% (unchanged) |
| Total | 100% |

**Simon's tax (AU side, illustrative):**

- Proceeds to Potenco: NZD $1,275,000
- Capital gain inside Potenco: ~AUD $1.17M
- With 50% active asset reduction: ~AUD $585k taxable
- AU company tax @ 25%: ~AUD $146k
- **Net to Potenco: ~AUD $1.02M** (≈ 87% retention)

Spread over 4 tax years (one upfront + three deferred), Simon can manage timing of dividend distribution from Potenco to himself to optimise his personal AU tax position.

**Joe's funding (NZ side):**

- $300k upfront (Joe contributes $100k from savings, company contributes $200k from retained earnings)
- $900k over 3 years from company earnings (effectively reducing Joe's dividend distributions during that period)
- Joe's net tax exposure is minimal — he's not realising any income event, just buying shares

### Edge case — Bad Leaver buyout

If Simon leaves voluntarily before year 4 and is classed as a Bad Leaver:

- Unvested shares (whatever portion hasn't vested) are bought back at nominal value (~$1 total)
- Vested shares are bought back at **lower of FMV or original cost**

In practice, original cost is near-zero (incorporation), so a Bad Leaver gets effectively nothing for their vested stake. This is a heavy hammer — used only for fraud / gross misconduct / material breach scenarios. The Good Leaver default is the norm.

### Open questions for the lawyer

1. ROFR pro-rata or open offer to all remaining shareholders? (Pro-rata is fairer; open is faster.)
2. Should ESOP holders have ROFR rights, or only "real" founders?
3. Inclusion of a shotgun clause — yes/no, and at what notice period?
4. Bad Leaver buyback at "lower of FMV or cost" or "discount to FMV" (e.g., 50% of FMV)? The former is harsher.
5. Definition of "competing role" — narrow (direct SaaS competitor in industrial SOPs) or broad (any SaaS company)?

---

## Slide 13C — Wind-down (the unhappy path)

If we collectively decide the business isn't viable and choose to close it, the mechanics are:

1. **Board resolves to wind up**, shareholders vote (typically 75% threshold)
2. **Pay creditors first** — suppliers, taxes, employees
3. **Pay any deferred founder consideration** (e.g., if mid-buyout)
4. **Distribute remaining assets** to shareholders pro-rata
5. **Deregister the company** with NZ Companies Office

At our scale, remaining assets are likely just the IP and any cash. IP can be:
- Sold to a third party
- Returned to Simon (under license-back terms if originally assigned from Potenco) — this should be pre-agreed in the IP assignment to avoid disputes
- Open-sourced or shelved

This scenario is unlikely if the pilot succeeds, but it should be addressed in the Shareholders Agreement so we don't end up litigating over the carcass.

---

## Slide 14 — Commercial path

| Stage | Target | Revenue (NZD) |
| --- | --- | --- |
| Pilot (P0) | Visy NZ, 1 site | **$20,000 one-off PO** |
| Pilot expand (P1) | Visy NZ + 1 more AU/NZ customer | $80–120k ARR |
| Capture-enabled (P2) | 3–5 paying customers | $300–500k ARR |
| Video-first (P3) | 10+ customers, multi-site | $1m+ ARR |

**Pricing model post-pilot:** per-site annual subscription + per-SOP conversion credit. **Not** per-seat (workers shouldn't be metered).

---

## Slide 15 — Top risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Visy stalls pilot decision | Joe lands a parallel discovery call by P0 week 4 |
| Conversion fidelity is "good not great" on Visy's corpus | Spike 001 has validated PDF image extraction. Budget 2 weeks of corpus-tuning before pilot launch |
| Print-to-PDF is harder than it looks | Single-purpose workstream, 2-week budget, "print stylesheet only" fallback |
| Kiosk sign-off isn't compliance-grade for Visy | Confirm with Visy compliance team BEFORE building. Fallback: hybrid PDF export signed at end-of-shift |
| Founders disagree on equity / direction | Founders' agreement signed BEFORE Visy PO is signed. Non-negotiable |
| Simon as single bus factor | P0 deliberately doesn't require dev hires. Post-PO budget allocates for a contractor on P1 |
| PSI rules collapse the Potenco structure | Confirmed with AU accountant pre-incorporation; contracts drafted to pass Results Test |
| R&D Tax Incentive claim audited and reduced | Contemporaneous documentation, only claim defensible activities, conservative apportionment |
| AU/NZ legal cost overruns | Cap legal spend at NZD $5k for incorporation + agreement. Fixed-fee NZ commercial lawyer |

---

## Slide 16 — Decisions we need from this meeting

1. **Confirm structure:** SOPstart NZ Ltd, Simon's stake via Potenco. Yes / no / discuss.
2. **Agree equity sketch (Slide 9) in principle:** 45 / 22 / 13 / 10 / 10 ESOP — or counter-propose.
3. **Confirm vesting structure:** 4-year vest with 12-month cliff for active founders, full vesting for Bobby, milestone-vest for Bryce.
4. **Engage professionals:** Nominate a NZ commercial lawyer and an AU R&D-savvy accountant. Cap initial spend at NZD $5k.
5. **Founders' top-up:** Do we contribute NZD $5–10k each for incorporation + legal + early infrastructure? Or run on Simon's Potenco cashflow until the PO lands?
6. **Bryce's vest trigger:** Pilot live, PO signed, or PO collected?
7. **Joe's vest structure:** Pure time-vest, or milestone-weighted (e.g., 50% on PO collection)?
8. **Banking / invoicing:** NZ business account (which bank?), Xero, Stripe / Wise for AU receipts.
9. **Founders' agreement scope:** Pre-emption rights, drag-along / tag-along, IP assignment from Potenco → SOPstart NZ Ltd, board composition.
10. **Compliance discovery with Visy:** Joe to confirm Visy compliance team will accept profile-picker kiosk sign-off (Slide 5, capability 4) — pre-empts our biggest pilot-scope risk.

---

## Appendix A — Documents / artefacts referenced

| Artefact | Path | Note |
| --- | --- | --- |
| Customer interviews | `.planning/research/customer-interviews/` | Visy interview transcripts, 2026-05-05 |
| Project description | `.planning/PROJECT.md` | Current product status |
| Conversion pipeline V2 spec | `.planning/phases/20-conversion-pipeline-v2/` | P0.1 workstream |
| Spike 001 — PDF image extraction | `.planning/spikes/001-pdf-image-extraction-bundle-safe/` | De-risks Phase 20 |

## Appendix B — Glossary

| Term | Meaning |
| --- | --- |
| **PSI** | Personal Services Income — AU tax rule that re-classifies company income as personal when >50% comes from one person's effort |
| **R&DTI** | R&D Tax Incentive — AU refundable tax offset on eligible experimental development |
| **NRWT** | Non-Resident Withholding Tax — NZ tax withheld on payments to non-NZ residents |
| **FITO** | Foreign Income Tax Offset — AU credit against AU tax for foreign tax paid on the same income |
| **DTA** | Double Tax Agreement — bilateral treaty (AU-NZ exists) preventing double taxation on cross-border income |
| **ESOP** | Employee Share Option Plan — reserved equity for future hires |
| **Vesting / cliff** | Shares earned over time. "Cliff" = no shares unlock until cliff date (typically 12 months) |
| **CGT** | Capital Gains Tax — tax on gain when an asset (like company shares) is sold |
| **Imputation credit** | NZ system that attaches the company tax already paid to a dividend, so the recipient isn't taxed twice |
