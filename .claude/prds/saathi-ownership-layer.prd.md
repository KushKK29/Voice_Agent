# Saathi Ownership Layer — PRD

*Version 1.1 · 2026-11-10 · builds on `ai-voice-kam.prd.md` (v2.3 + audit fixes) · reviewed with ecc:product-lens (see end)*

**Definition used throughout — ₹ at risk:** the delivered value lost this month versus last month (orders after cancellations × price), computed in code. It is a measure of the problem's size today, not a forecast. Recovery figures are separate estimates from the forecast scenarios.

## Problem

Saathi today is a good reactive voice bot: a seller calls, asks, and gets an honest, data-backed answer and a plan. But nothing happens after the call. Saathi never notices a problem on its own, never tracks whether the seller acted, never checks whether the advice worked, and its "I will check in again in 7 days" is a promise no part of the system keeps. The reviewer stated the bar directly: *"Don't build just another bot that answers questions. Think about how an AI agent can actually take ownership of a seller's business problem, identify what needs attention and drive the next action."* Without this layer the build is the thing the reviewer said not to build, and is unlikely to be invited to the live discussion.

## Evidence

- Reviewer note (quoted above) defines ownership, attention and next action as the deciding criteria for the technical discussion and live demo.
- Assignment rubric: AI workflow 20 and creativity 10 points reward agent behaviour beyond Q&A.
- Observed in our own manual test calls (2026-11-10): the bot promises a 7-day check-in and saves a plan, but there is no follow-up, no plan status and no outcome measurement.
- Real KAM practice (sellers asking "what changed since last time?", KAMs owning a portfolio and prioritising who to call): **Assumption — needs validation via a conversation with a Snapdeal KAM or seller-success team member.**
- That ₹-at-risk ranking matches how a KAM would prioritise: **Assumption — needs validation via the same conversation.**

## Users

- **Primary — Seller** (small marketplace seller, e.g. Ramesh, Jaipur, Home & Kitchen): busy, often on a phone, may speak Hinglish, does not read dashboards. Need is triggered when sales fall or when Saathi calls them about a problem.
- **Secondary — Human KAM / seller-success team member**: owns a portfolio of sellers, needs to know who needs attention today, what the AI already did, and when a case is handed to them.
- **Tertiary — Assignment reviewer** in a live demo: must see the full loop (spot → own → act → measure) in about 3 minutes.
- **Not for**: Snapdeal internal finance or payments teams; buyers; sellers needing account changes the agent cannot make (they are escalated, not served).

## Hypothesis

We believe **an agent that detects seller problems itself, owns each one as a tracked case, proposes ₹-ranked actions, executes approved (demo) actions, records the seller's commitments and returns later to measure the outcome** will **move sellers from "advice heard" to "problem resolved"** for **marketplace sellers and the KAMs who manage them**.

We'll know we're right when, in a scripted demo across the 5 sample sellers, **every seller with a problem gets a case with a ₹ figure and next action without asking, and the follow-up call correctly reports what changed, what is still open and what Saathi will do next** — and a reviewer can follow that loop end to end without explanation.

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Problems detected without the seller asking | 5 of 5 sample sellers get a correct top cause in the attention queue | Compare queue against expected diagnosis per seller (S1001 inventory+cancellations, S1002 price, S1003 cancellations, S1004 visibility, S1005 inventory+price) |
| Queue order follows ₹ at risk | Exact order: Ramesh, Fatima, Vikram, Sunita, Meena (value at risk computed in code) | Automated test |
| Every recommendation carries a ₹ impact and a deadline | 100% of recommended actions | Automated test + eval |
| No action executed without explicit seller approval | 0 unapproved executions | Eval cases where the seller says "no", "maybe later" or stays silent |
| Follow-up call reports outcome correctly | Numbers match simulated data 100%; names open items | Eval + automated test on the outcome calculation |
| Honesty: no claimed real-world effect | 0 replies claiming a message was sent, a supplier contacted or a listing changed for real | Eval forbidden-phrase checks ("(demo)" required wording) |
| Spoken turn length unchanged | ≤ 55 words (eval limit), ~20 words target | Existing eval |
| Ownership completeness | 100% of open cases have an owner, a next action, a ₹ figure and a due date | Automated test over the case store |
| Outcome follows behaviour | Follow-up outcome differs correctly between "seller approved / committed" and "seller declined" runs | Two scripted runs per demo seller |
| Existing behaviour not broken | All current unit tests pass; eval pass@2 not lower than a **fresh baseline taken before work starts** (the last run, 37/47, predates prompt fixes) | `npm test`, `npm run eval` |
| Demo length | Full loop in ≤ 3 minutes | Timed rehearsal |

## Requirements (what must be true)

### R1. Attention queue
- Shows every seller in the portfolio ranked by **value at risk (₹)**, highest first.
- Each row: seller, ₹ at risk, top cause in one plain sentence, recommended next action, case status, last contact, next check-in.
- Updates when the underlying data changes (including after a simulated time jump).
- A seller with no problem appears as "healthy" at the bottom, never invented problems.
- Acceptance: with current sample data the order is Ramesh (≈ ₹68,000), Fatima (≈ ₹50,100), Vikram (≈ ₹42,300), Sunita (≈ ₹30,000), Meena (≈ ₹18,400); each row's cause matches the diagnosis in code.

### R2. Early-warning triggers
- Rules over the seller's data raise a **signal** before a monthly drop is visible: a top-10 product hits zero stock; cancellation rate rises by ≥ 3 points; impressions fall > 40%; average price moves > 10%.
- **Data gap:** today's data is monthly only, so "before the drop is visible" needs sample day-level events (e.g. the date a best-seller hit zero stock), labelled as sample data. Without them, this requirement reduces to the monthly rules already in the diagnosis and adds little; that is why it sits in Next, not MVP.
- Each signal names the evidence, the ₹ at risk, and opens or updates a case (never duplicates an open case for the same cause).
- Signals are labelled with their data tier (given or sample).
- Acceptance: each of the 5 sample sellers raises the expected signal(s) and no others.

### R3. Case ledger (ownership)
- Every problem is a **case**: seller, cause, evidence, ₹ at risk, recommended actions, owner (Saathi or a human), due dates, status.
- Status lifecycle: open → in progress → resolved, or → escalated. Every change is timestamped with who made it (Saathi, seller, human).
- The voice agent can open, update and close cases during a call, and reads the open case at the start of a call.
- Cases persist across calls and restarts.
- Acceptance: a full demo run shows one case moving open → in progress → resolved (or partly resolved) with a visible history.

### R4. Next best action with ₹ value
- Each recommended action shows: ₹ impact (an estimate computed in code, never by the model), effort (low/medium/high), deadline.
- The agent proposes the highest-value action first and explains in one sentence why.
- Estimates are always called "estimate"; no guarantees.
- Acceptance: for Ramesh the first action is restocking the top out-of-stock products, with its estimate; for Meena it is a price action, never restocking.

### R5. Approved actions (demo)
- A small set of actions the agent can execute: raise a restock request, switch off zero-stock listings, open a support ticket. *(At most 3 in MVP.)*
- **No action runs without the seller's explicit "yes" in the same call.** "Maybe", silence or a topic change counts as no.
- Every executed action is written to an audit log (what, when, approved by whom) and clearly marked **(demo)**: nothing is sent to a real supplier, marketplace or channel.
- The agent's spoken confirmation must say it is a demo action.
- Acceptance: eval cases cover yes, no, maybe and silence; only "yes" produces a log entry.

### R6. Commitment capture
- When the seller commits to something ("I'll restock by Friday"), the agent records it as a dated task on the case and reads it back for confirmation.
- Relative dates are resolved to calendar dates and spoken back ("Friday, 14 November").
- Acceptance: a stated commitment appears on the case with the correct date; an unconfirmed one is not saved.

### R7. Follow-up and outcome check
- A **"Simulate +7 days"** control advances the demo clock and changes the seller's data in a labelled way.
- **The simulated outcome must follow what actually happened in the call**, or the "measurement" is circular: if the seller approved the restock action or committed to it, the simulation shows those items back in stock (e.g. Ramesh: 3 of 5 restocked, cancellations 14% → 11%); if the seller declined, the items stay out of stock and the follow-up says so and escalates or re-plans. The rules for each case are fixed in advance and documented, not chosen by the model.
- The agent compares new data with the case baseline: what improved, by how much, ₹ recovered (estimate, computed in code), which tasks are done, which are overdue, and what it will do next.
- The case status updates from the outcome (resolved, still in progress, or escalated if nothing moved).
- Simulated data is always labelled "simulated" in the UI and speech.
- Acceptance: the follow-up call states the correct before/after numbers and names the open items.

### R8. Outbound call from a case
- From the attention queue, starting a call on a seller makes Saathi **open with the case** ("calling about three best-sellers that went out of stock"), not "How can I help?".
- If the seller wants something else, Saathi follows the seller and keeps the case open.
- Acceptance: the first spoken sentence names the case's cause and one number.

### R9. Human handoff brief
- When a case is escalated (payments, blocked account, legal, asked for a person, or no progress after follow-up), the agent writes a short brief for the human KAM: seller, problem, key numbers, what was tried, what the seller wants, urgency.
- The brief is visible on the case; the seller is told a human will follow up and never has to repeat the story.
- Acceptance: every escalation has a brief with those fields; no invented facts.

### R10. Post-call summary for the seller
- After each call the seller gets a short summary card (English, or Hinglish if the call was in Hinglish): the issue, up to 3 actions with dates, commitments, next check-in date.
- Shown in the UI and saved with the call; **not sent** to any real channel (labelled as a preview).
- Acceptance: the card matches the case and plan exactly; no numbers that are not in the case.

### R11. Seller can correct the diagnosis
- If the seller disagrees or adds the real reason ("it's not stock, my supplier is late", "I raised prices on purpose"), the agent records it on the case as seller-provided, adjusts the next action, and does not argue with the data.
- Acceptance: a stated reason appears on the case labelled "from seller", and the next action changes accordingly (e.g. supplier late → backup supplier and restock best-sellers first).

### Cross-cutting requirements
- **Honesty rules from the base PRD stay**: GIVEN / SAMPLE / NOT AVAILABLE data tiers; no invented payments, competitor prices, ad spend or cancellation reasons.
- **The model never computes ₹ figures or outcomes**; all numbers come from code.
- **Voice style unchanged**: ~20 words per turn, one question, interruption works.
- **Safety**: no action without approval; previous-call and case data enter the prompt as quoted data, not instructions; all user-visible text stays safe to render.
- **Zero budget**: free Gemini key, free MongoDB; no paid messaging or telephony.

## Scope

**MVP** (tests the hypothesis; demo-ready):
R1 attention queue, R3 case ledger, R4 next best action with ₹, **R5 with one action only (raise a restock request)**, R7 follow-up with simulated +7 days, R8 outbound call from a case. Together these show the full loop: spot → own → prioritise → **act** → measure. One approved action is in MVP because "drive the next action" is the reviewer's own wording, and R7 needs it to make the outcome depend on the call.

**Decisions taken in review** (were open questions):
- Lead the demo with the **KAM view** (attention queue), then step into the seller call. The reviewer asked about an agent that owns problems across sellers.
- **One case per cause** per seller (Ramesh gets two: stock-outs, cancellations), shown grouped under the seller.
- A case resolves only when the numbers recover **and** Saathi confirms it on the follow-up; numbers alone move it to "improving".

**Next** (if time allows, in order): R6 commitment capture, R11 seller correction, R9 handoff brief, R5 second action, R10 post-call summary, R2 early-warning triggers.

**Out of scope**
- Real telephony, WhatsApp, SMS or email sending — paid or needs approvals; demo previews instead.
- Real Snapdeal panel or supplier integrations — no access; actions are clearly labelled demo actions.
- Price-elasticity "what if I change my price" simulator — no data; would invent numbers.
- "What worked for similar sellers" learning across the portfolio — needs real history; faking it is dishonest.
- Login, roles and multi-KAM permissions — single demo user.
- Scheduled background jobs that run while nobody is watching — the demo uses an explicit time jump.

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Portfolio triage | KAM opens the queue and sees 5 sellers ranked by ₹ at risk with cause and next action | complete | — |
| 2 | Cases the agent owns | Problems become cases; the voice agent opens/updates them in a call; history visible | in-progress | — |
| 3 | Proactive call | "Call this seller" makes Saathi open with the case and push the highest-₹ action | complete | — |
| 4 | Closed loop | "Simulate +7 days" → follow-up call reports what changed, ₹ recovered, open items; case status updates | complete | — |
| 5 | Agent acts (demo) | Seller says yes → demo action logged; commitments saved as dated tasks | in-progress | — |
| 6 | Handoff and summary | Escalations carry a human brief; seller gets a summary card | pending | — |
| 7 | Proof | Eval extended for the new behaviours; demo rehearsed in ≤ 3 minutes; README and base PRD updated | pending | — |

## Demo script (acceptance for the whole layer)

1. Open the attention queue: Ramesh is first, ≈ ₹68,000 at risk, stock-outs.
2. Click **Call Ramesh**: Saathi opens with the case and proposes the highest-₹ action.
3. Ramesh agrees (demo action logged) and commits to restocking by Friday (task saved).
4. Click **Simulate +7 days**: queue updates; Saathi calls back with before/after numbers, ₹ recovered (estimate), and the open items.
5. Show the case history: open → in progress → partly resolved.

## Open Questions

- [ ] Submission deadline and demo date — TBD; decides whether "Next" scope fits.
- [ ] Exact simulated +7 days numbers for each of the 5 sellers in the "acted" and "declined" variants — to be fixed before building R7.
- [ ] Is the reviewer happier with the KAM-led story chosen above, or a seller-led one? — needs validation via the reviewer's reaction in the demo.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Model claims a real action happened ("I've told your supplier") | Medium | High (dishonest) | Demo wording required in tool results; forbidden-phrase eval cases |
| Model executes an action without a clear "yes" | Medium | High | Approval checked in code, not only in the prompt; eval cases for no/maybe/silence |
| Model invents ₹ figures or outcomes | Medium | High | All ₹ and outcomes come from code; prompt says numbers only from facts/tools; eval checks |
| Prompt grows past budget and quality drops (seen before at ~9k chars) | High | Medium | Keep prompt under its size cap; move behaviour into tools; re-run eval |
| Free-tier quota blocks eval runs | High | Medium | Run eval once per milestone; smaller subsets while building |
| Scope too large for the deadline | High | High | MVP first (5 requirements); Next items only after the loop works end to end |
| Simulated data looks staged to the reviewer | Medium | Medium | Label it "simulated" everywhere; explain it in the demo as a stand-in for next week's real data |
| Live demo voice glitch (noise, interruption) | Medium | High | Headphones; typed fallback path for the demo; rehearse twice |

## Review (ecc:product-lens, 2026-11-10)

**Verdict: GO, with the changes below (all applied in v1.1).**

Diagnostic answers:
1. *Who:* a human KAM with a portfolio, and the seller on the call. Concrete.
2. *Pain:* problems are found late and advice is not followed through. Severity is an assumption until a KAM confirms it.
3. *Why now:* the reviewer named ownership as the bar for the live demo.
4. *10-star version:* real panel and supplier integrations, real WhatsApp follow-ups, learning which actions work across thousands of sellers. Out of reach on a zero budget; the MVP shows the same loop with labelled demo data.
5. *MVP:* the loop spot → own → act → measure on one seller, shown in 3 minutes.
6. *Anti-goal:* more Q&A features; fake integrations presented as real.
7. *Working when:* the follow-up result changes with what the seller did, and every case has an owner, ₹ figure, next action and date.

Findings and changes:

| # | Finding | Change |
|---|---|---|
| 1 | "₹ at risk" was undefined and could be read as a forecast | Defined at the top as this month's delivered-value loss, computed in code |
| 2 | MVP had no action, so "drive the next action" was only advice | One approved demo action (restock request) moved into MVP |
| 3 | Predefined +7-day outcome made the measurement circular | Outcome now depends on what the seller approved or committed to |
| 4 | Early-warning triggers need day-level data we do not have | Data gap stated; kept in Next |
| 5 | No metric for "ownership" itself | Added ownership-completeness and outcome-follows-behaviour metrics |
| 6 | Regression baseline (37/47) predates prompt fixes | Fresh baseline required before work starts |
| 7 | Open questions on case granularity, resolution and demo lead blocked planning | Decided: one case per cause, resolve on recovery + confirmation, KAM-led demo |
| 8 | Seller disagreeing with the diagnosis was not handled | Added R11 |

ICE prioritisation (impact × confidence ÷ effort, 1–5 each):

| Idea | Impact | Confidence | Effort | ICE | Placement |
|---|---|---|---|---|---|
| R1 Attention queue | 5 | 5 | 2 | 12.5 | MVP |
| R4 Next best action ₹ | 4 | 5 | 2 | 10.0 | MVP |
| R8 Outbound call | 4 | 4 | 2 | 8.0 | MVP |
| R7 Follow-up outcome | 5 | 4 | 3 | 6.7 | MVP |
| R3 Case ledger | 5 | 4 | 3 | 6.7 | MVP |
| R6 Commitment capture | 3 | 4 | 2 | 6.0 | Next |
| R9 Handoff brief | 3 | 4 | 2 | 6.0 | Next |
| R5 Approved action (one) | 4 | 3 | 3 | 4.0 | MVP (one action) |
| R10 Post-call summary | 2 | 5 | 2 | 5.0 | Next |
| R2 Early warnings | 3 | 2 | 3 | 2.0 | Next (needs sample day-level data) |

Next step: `/plan .claude/prds/saathi-ownership-layer.prd.md` for milestones 1–4, after fixing the simulated +7 days numbers.

---
*Status: DRAFT v1.1 — requirements reviewed. Implementation planning pending via /plan.*
