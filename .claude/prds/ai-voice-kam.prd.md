# PRD — "Saathi": AI Voice Key Account Manager (KAM) for Snapdeal Sellers

> **Context:** Snapdeal AI-First Intern practical assignment. 24-hour deadline, ~1–2 h expected effort.
> **Author:** Kush Goel · **Date:** 2026-11-10 · **Status:** DRAFT v2 (reviewed — see §16 changelog)
> **One-liner:** A browser voice bot. A seller can talk to it like a human KAM. It finds why the seller's sales dropped, gives 2–3 concrete fixes, and ends with a summary of next steps.

---

## 0. TL;DR

| Item | Decision |
|---|---|
| What | Browser-based, voice-first, two-way conversational KAM |
| Core job | Diagnose a sales drop from seller data plus conversation, recommend 2–3 actions, summarise |
| Key insight from data | The drop is **100% volume-driven** (ASP flat). The main cause is **inventory**: OOS SKUs went from 5 to 18 (3.6×). That also explains the **cancellation spike** (8% to 14%). Price is ruled out as the primary cause. |
| Differentiator | Numbers come from a **deterministic analysis tool**. The LLM never does the math, so no hallucinated figures. **Hinglish-aware** speech. **Live metrics panel** plus an end-of-call **action-plan card**. |
| Recommended stack | **Zero cost.** Gemini Live API (free tier, speech-to-speech, native audio) over WebSocket. Function calling. A small Node server (token + tool endpoints). **MongoDB Atlas free tier (M0)** for seller data and call history. Static frontend. Fallback: browser Web Speech API + Gemini Flash (text) + browser TTS. |
| Success | A natural 2–3 minute call, correct diagnosis, actionable recommendations, a clean summary, under 1.5 s voice response latency |

---

## 1. Problem

Snapdeal's sellers are mostly small and mid-sized businesses, many in Tier-2/3 cities. When sales fall, a seller rarely knows why. The answer is spread across dashboards they don't read: inventory, cancellations, pricing and visibility. Human KAMs can explain it, but they don't scale to hundreds of thousands of long-tail sellers. When nobody explains the cause, the seller guesses (for example, "cut prices") or churns. Both cost GMV for the seller and for Snapdeal.

**Why now:** speech-to-speech models with low latency and tool calling are now available, and some have free tiers. That makes a natural voice KAM cheap enough to offer to every long-tail seller, not only the top accounts.

**Cost of leaving it unsolved:** for the sample seller, the drop is **₹65,000/month gross (−32.5%)**. After cancellations, the net delivered value falls by about **₹68,000 (−37%)**. Most of this can be recovered with simple operational fixes the seller has not made.

## 2. Evidence

- **Assignment brief:** the seller says *"My sales have dropped significantly this month. I don't understand why."* The seller sees the symptom and not the cause.
- **Sample data:** every signal points to operations, not demand or price (see §5).
- *Assumption — needs validation via seller interviews or analytics:* sellers prefer to speak rather than read dashboards, and prefer Hindi/Hinglish. This is plausible for Snapdeal's value-segment seller base, but this PRD does not validate it.
- *Assumption:* on marketplaces in general, stock-outs and high cancellation rates reduce search ranking and visibility. This is a general marketplace heuristic, not confirmed Snapdeal ranking logic.

## 3. Users

- **Primary: small/mid seller ("Ramesh")**
  - Runs a home & kitchen store from Jaipur. About 60 active SKUs. Manages inventory in Excel or WhatsApp with suppliers.
  - Speaks Hindi and English, often mixed. Uses a phone or laptop. Is busy.
  - **Trigger:** sees a lower payout or fewer orders and wants an answer in minutes, not a report.
- **Secondary: assignment evaluators.** They judge naturalness, understanding, recommendation quality, AI workflow and creativity (see §7 rubric mapping).
- **Not for:**
  - Buyers or customer support.
  - Large enterprise brands that already have dedicated human KAMs.
  - Payment/settlement disputes, account suspension or legal issues. These are escalated, not solved.

---

## 4. Hypothesis

We believe a **voice-first AI KAM that grounds every statement in the seller's own data** will **turn a confused complaint into a clear, prioritised action plan** for **small Snapdeal sellers**.
We'll know we're right when, in **≥ 9 of 10 scripted test calls**:
- the bot names inventory/OOS and cancellations as the drivers;
- it quotes only correct numbers;
- it gives 2–3 specific, time-bound actions;
- it closes with a summary;
- the call takes **≤ 3 minutes** and median response latency is **< 1.5 s**.

---

## 5. Data Analysis & Diagnosis (the "brain")

### 5.1 Given data and derived metrics

| Metric | Last month | This month | Δ | Read |
|---|---|---|---|---|
| Sales (gross) | ₹2,00,000 | ₹1,35,000 | **−₹65,000 (−32.5%)** | Symptom |
| Orders | 400 | 270 | **−130 (−32.5%)** | Volume drop explains 100% of decline |
| ASP | ₹500 | ₹500 | 0% | **Price not the primary cause** (Sales = Orders × ASP holds exactly) |
| Cancellation rate | 8% | 14% | **+6 pp (1.75×)** | Fulfilment / stock-sync problem |
| Cancelled orders *(derived)* | 32 | ~38 | +6 | Even with fewer orders, more cancellations |
| Net delivered orders *(derived)* | 368 | ~232 | **−37%** | Real loss is worse than headline |
| Net delivered value *(derived)* | ₹1,84,000 | ~₹1,16,100 | **≈ −₹68,000** | — |
| Out-of-stock products | 5 | 18 | **+13 (3.6×)** | **Primary root cause** |

### 5.2 Causal story (what the bot should explain in plain words)

1. **13 more products went out of stock.** Customers can't buy them, and listings that are stocked out or unreliable tend to lose visibility. Result: **orders fall**.
2. **Stock on the panel doesn't match real stock.** Orders arrive for items the seller no longer has, and the seller cancels them. Result: **cancellations rise to 14%**.
3. High cancellations hurt seller rating and visibility further. **This is a loop.**
4. **Price stayed the same (₹500 ASP)**, so discounting is *not* the first fix. The bot should actively warn the seller against a reflexive price cut.

**Illustrative attribution (assumption, labelled in-product):** if the 13 newly-OOS SKUs sold about 10 orders/month each last month, they account for about 130 lost orders. That is the entire drop. The bot confirms this by asking whether the OOS items are the seller's best-sellers.

**Recovery potential (illustrative):** restoring orders to about 400 and cancellations to 8% returns net delivered value to about ₹1.84 L. That is **≈ +₹68,000/month** versus today.

### 5.3 Added mock data (assumptions — stated in UI and in the submission note)

The given table is enough for a diagnosis but too thin for a rich conversation. The following are added and clearly labelled as assumptions:

- Seller profile: "Ramesh Home Essentials", Jaipur, Home & Kitchen category, **60 active SKUs** (so OOS share goes from 8% to 30%).
- Top OOS SKUs with last-month velocity, for example "Steel Lunch Box Set — 28 orders last month, 0 stock now".
- Cancellation reason split: **~70% seller-initiated (stock unavailable)** and ~30% customer-initiated.
- "This month" is a **completed month** and not month-to-date. *The bot should confirm this. A month-to-date comparison would invalidate the whole diagnosis.*
- The seller is **already identified**, as if logged in to the seller panel. The bot knows the seller's name and ID from `seller.json` before the call starts. There is no login or verification step.

### 5.4 Diagnosis rules (deterministic, run before the LLM speaks)

| Signal | Threshold | Finding | Recommended action |
|---|---|---|---|
| OOS count ↑ > 50% **or** OOS share > 15% | 5 → 18 ✅ | Inventory gap | Restock top SKUs by velocity within 48–72 h. Set reorder points (daily sales × supplier lead time + buffer). |
| Cancellation rate > 10% **or** +3 pp MoM | 14%, +6 pp ✅ | Stock-sync / fulfilment failure | Update panel stock daily. Set zero-stock SKUs inactive immediately. Target < 8% in 2 weeks. |
| ASP change > ±10% | 0% ❌ | — | Don't cut prices. Only benchmark against competitors on hero SKUs. |
| Orders ↓ with OOS, cancellations and ASP all flat | n/a | Visibility / demand / seasonality | Listing quality (images, titles), deals or sponsored listings, check whether last month had a sale event |
| After restock (sequenced) | — | Visibility recovery | Short time-boxed deal or ads on restored hero SKUs to rebuild ranking |

**Recommendation order the bot should give (max 3):**
1. **Restock best-sellers first.** Name the top OOS SKUs. Set reorder alerts.
2. **Stop cancellations at the source.** Keep panel stock in sync daily and deactivate zero-stock listings. Target < 8%.
3. **Re-ignite visibility after restock.** Run a 7-day deal or small ad budget on restored hero SKUs. Do not discount the whole catalogue.

Each recommendation must be **specific** (which SKUs), **measurable** (what target) and **time-bound** (by when).

---

## 6. Scope

### 6.1 MVP (P0 — must ship for submission)

| # | Feature | Maps to brief |
|---|---|---|
| F1 | One-click "Call your KAM" in browser. Mic permission. Live two-way voice. **"End call" button.** | §3 natural two-way voice |
| F1b | Visible call states: connecting → listening → thinking → speaking → ended. Clear error if mic is denied or the API fails. | Execution quality |
| F2 | **Bot speaks first:** greeting plus open-ended discovery ("What's on your mind today?") | Greet & understand reason |
| F3 | **Barge-in:** seller can interrupt and bot stops talking | Natural conversation |
| F4 | Data-informed follow-up questions, **one at a time, 2–4 total** | Relevant follow-ups |
| F5 | Tool-grounded diagnosis (`get_seller_metrics`, `analyze_sales_drop`) | Use sample data |
| F6 | 2–3 prioritised, quantified recommendations | Recommend 2–3 actions |
| F7 | Spoken end-of-call summary: issues, actions, next steps, follow-up date | Summarise |
| F8 | Live transcript on screen | Demo clarity |
| F9 | Visible "Assumptions" note in the UI | "Clearly mention assumptions" |
| F10 | **MongoDB persistence.** Seller profile, metrics and SKUs are read from the `sellers` collection. Every call is saved to the `calls` collection: transcript, diagnosis, action plan and follow-up date. | AI workflow / execution |

### 6.2 P1 — stretch (creativity points, only if MVP is solid)

Ranked by ICE score: Impact × Confidence ÷ Effort, each scored 1–5. Build them in this order and stop when time runs out.

| Rank | Feature | I | C | E | ICE | Why |
|---|---|---|---|---|---|---|
| 1 | **Hinglish / Hindi mirroring.** If the seller speaks Hindi, the bot replies in Hinglish. Amounts are said the Indian way ("1.35 lakh"). | 4 | 3 | 1 | 12 | Prompt-only change. Strong "authentic to Snapdeal sellers" signal. Confidence is limited by speech recognition quality on Hinglish. |
| 1b | **Returning-caller memory.** On a second call, the bot reads the last call from Mongo and opens with something like "Last time we planned to restock your lunch box sets. Did that happen?" | 4 | 4 | 1 | 16 | Makes Mongo earn its place. Feels like a real KAM relationship. Needs only one extra query plus a prompt line. |
| 2 | **Action-plan card.** Rendered at the end from the `create_action_plan` tool call. Copyable, like a "WhatsApp to self" message. | 4 | 5 | 2 | 10 | Gives a visible payoff in the recording. The tool already exists for F7. |
| 3 | **Live metrics panel.** The metric the bot is talking about highlights on screen. | 4 | 4 | 2 | 8 | Syncs voice and visuals. Driven by which tool was just called. |
| 4 | **Escalate to human KAM.** Mock tool for out-of-scope topics (payments, suspension) or a frustrated seller. | 2 | 4 | 1 | 8 | Cheap. Shows guardrail thinking. Rarely appears in a 2-minute demo. |
| 5 | **Scenario switcher.** A second mock seller (for example, a price-driven drop where ASP rose 20%). | 3 | 4 | 2 | 6 | Proves the bot isn't scripted, but needs a second dataset and a second test pass. |

### 6.3 Out of scope

- Real telephony / PSTN calls. The brief says browser is enough.
- Real Snapdeal data, auth or integrations. The brief says mock data only.
- Mobile app.
- User accounts or login. A seller is picked from a dropdown or fixed by URL.
- Multi-seller analytics or admin dashboards.
- Actually executing actions (placing restock orders, changing prices). The bot advises and does not act.

---

## 7. Success Metrics (mapped to the evaluation rubric)

| Rubric (marks) | Metric | Target | How measured |
|---|---|---|---|
| Voice & natural conversation (30) | Voice-to-voice latency | p50 < 1.5 s, p95 < 3 s | Timestamp between end of user speech and first audio out |
| | Barge-in stops bot | < 500 ms | Manual test, 5 interruptions |
| | Bot turn length | ≤ 2–3 short sentences / ~35 words (except summary) | Transcript review |
| | Questions per turn | Exactly 1 | Transcript review |
| Understanding queries (20) | Intent correctly identified (sales drop vs other) | 10/10 scripted English openers. Add Hinglish openers only if P1 Hinglish ships. | Test script set |
| | Handles vague or off-topic replies gracefully | 5/5 edge cases (§8.5) | Test script set |
| Recommendation quality (20) | Root cause = inventory + cancellations | ≥ 9/10 runs | LLM-as-judge plus manual review |
| | Numbers quoted match data | 100% | Compare transcript to tool output |
| | Actions are specific, measurable, time-bound | 3/3 per call | Rubric check |
| AI implementation (20) | All figures come from tools, not LLM arithmetic | 100% | Tool-call log |
| Creativity & execution (10) | Working public link plus clean recording | Shipped | — |
| — | Full call duration | 1.5–3 min | Recording |

---

## 8. Conversation Design

### 8.1 Flow (state machine, enforced by the prompt rather than code)

```
GREET → DISCOVER → PROBE (2–4 Qs) → DIAGNOSE (share data, confirm) → RECOMMEND (2–3) → Q&A → SUMMARISE → CLOSE
                       ↘ off-topic / anger / out-of-scope → ESCALATE (P1) ↗
```

### 8.2 Voice persona

- **Name:** "Saathi", Snapdeal Seller Success. Warm, calm, respectful (uses "ji" when the seller speaks Hindi). Sounds like a senior KAM, not a call-centre script.
- **Style rules:**
  - Short sentences. One question per turn. No lists read aloud. No markdown.
  - Acknowledge before probing ("Samajh gaya, that's a big drop. Let me pull up your numbers.").
  - Say numbers naturally ("about thirty-two percent", "1.35 lakh").
  - Use the seller's name.
  - Never blame the seller.

### 8.3 Follow-up question bank (the bot picks 2–4 based on data, never all)

1. "Is the drop across all your products, or a few specific ones?"
2. "I see 18 of your products are out of stock now, up from 5. Are some of those your best-sellers?" *(highest-value question)*
3. "What's causing the stock-outs: supplier delay, cash flow, or just not updated on the panel?"
4. "Your cancellations went from 8 to 14 percent. Are you cancelling because the stock wasn't there, or are customers cancelling?"
5. "Did you change any prices, or stop any ads or deals this month?"
6. "Did last month have a sale event? That can make this month look worse." *(seasonality check — outside-the-doc)*
7. "Is this month's number for the full month, or till today?" *(data sanity — outside-the-doc)*
8. "How many days does your supplier take to restock?" *(lets the bot set a concrete restock deadline)*
9. "How often do you update stock on the panel?" *(confirms the stock-sync cause of cancellations)*

**Selection rules:**
- Never ask what the data already answers. For example, state that price is flat instead of asking about it.
- Skip a question if the seller's earlier answer already covered it.
- Demo default order: Q1 → Q2 → Q3 → Q4.

### 8.4 Sample happy-path (target ~2 min)

Each bot turn follows the ≤ 2–3 short sentences rule. Only the summary is allowed to run longer.

> **Bot:** Namaste Ramesh ji, I'm Saathi, your Snapdeal account manager. How can I help today?
> **Seller:** My sales have dropped a lot this month, I don't understand why.
> **Bot:** I understand, let me check your numbers. Sales went from 2 lakh to 1.35 lakh, about 32 percent down, but your price is unchanged. Is the drop across all products, or a few?
> **Seller:** Mostly my kitchen items, I think.
> **Bot:** That fits. 18 products are out of stock now, up from 5, including your steel lunch box set. Is your supplier delayed?
> **Seller:** Yes, supplier was late after Diwali.
> **Bot:** That also explains why cancellations jumped from 8 to 14 percent: orders are coming in for items you don't have. So the real issue is stock, not demand. Shall I suggest what to do?
> **Seller:** Yes, please.
> **Bot:** First, restock your top 5 out-of-stock items this week. Second, update stock on the panel daily and switch off anything at zero, which should bring cancellations under 8 percent.
> **Seller:** *(interrupts)* Should I also reduce prices?
> **Bot:** No need. Your price is the same as last month, so a discount won't fix this. Third step instead: once restocked, run a one-week deal on those items to win back visibility.
> **Seller:** Okay, makes sense.
> **Bot:** To summarise: sales fell 32 percent mainly because 13 more products went out of stock, which also pushed cancellations to 14 percent. Your steps are restock the top sellers this week, sync stock daily, and run a short deal after restock. You could recover an estimated 60 to 70 thousand a month. I'll check in with you in 7 days. Anything else?

### 8.5 Edge cases the bot must handle

| Case | Behaviour |
|---|---|
| Seller is silent or unclear | Re-prompt once gently, then offer a choice ("Is it orders, payments, or something else?") |
| Seller speaks Hindi | Mirror in Hinglish |
| Seller disputes data ("No, I have stock!") | Don't argue. Suggest panel stock may not be synced, which also explains cancellations |
| Seller asks for something out of scope (payment delay, account blocked) | Acknowledge, say a human KAM will follow up (P1 escalate tool), return to main topic |
| Seller angry | Empathise first, slow down, offer escalation |
| Seller asks "should I reduce price?" | Explain with data that ASP is flat and the issue is stock |
| Seller interrupts mid-sentence | Stop, listen, respond to the new input |
| Asks for numbers not in data (returns, ads spend) | Say "I don't have that in front of me", never invent |

---

## 9. Implementation Approach

> Included because the assignment explicitly evaluates "AI implementation and workflow". This section is kept deliberately minimal: the brief says simple beats complex.

### 9.1 Stack decision

| Option | Latency | Effort | Barge-in | Tool calls | Cost | Verdict |
|---|---|---|---|---|---|---|
| **A. Gemini Live API (native-audio Flash model, WebSocket)** | Low (~1 s) | Low–Med | Built-in VAD | Native | **Free tier** (Google AI Studio key) | **Chosen.** Free, speech-to-speech, natural voice. |
| B. Pipeline: browser Web Speech API (STT) → Gemini Flash text API → browser `speechSynthesis` (TTS) | Higher (1.5–3 s) | Medium | Manual (stop TTS when mic hears speech) | Yes | **Free** | **Fallback** if Live API quota or region blocks. Chrome-only STT, more robotic voice. |
| C. OpenAI Realtime | Lowest | Low | Built-in | Native | Paid | Rejected: costs money |
| D. Vapi / Retell / ElevenLabs agents | Low | Lowest | Built-in | Webhooks | Trial credits only | Rejected: credits run out, less code to explain |

**Decision:** A. **Budget constraint: ₹0.** Only a free Gemini API key from Google AI Studio is needed.
**Free-tier caveats:**
- Rate limits: requests per minute and per day are low. That is fine for a demo and about 10 test calls. Don't leave sessions open idle.
- Session length cap: a few minutes per Live session. The call targets ≤ 3 min.
- Free-tier prompts may be used by Google to improve products. Acceptable, because all data is mock.
- Check that model name and limits match current AI Studio docs at build time.

### 9.2 Architecture

```
┌──────────────────────── Browser (single page) ────────────────────────┐
│  [Call button]  [Live transcript]  [Metrics panel]  [Action-plan card] │
│        │                    ▲                                          │
│   mic audio (16kHz PCM, WebSocket)   audio + events (WebSocket)        │
│        ▼                    │                                          │
│  Tool dispatcher: forwards Gemini tool calls → server /api/tools/*    │
└────────┬───────────────────────────────────────────────────────────────┘
         │ 1. POST /session (ephemeral token)
         │ 3. POST /api/tools/:name  (tool call → JSON result)
┌────────▼──────────────────┐   2. Live API WebSocket (audio in/out + tool calls)
│ Node server               │ ─────────────────────────►  Gemini Live API (free tier)
│ - holds GEMINI_API_KEY    │                              (STT + LLM + TTS in one)
│ - analyze.js (pure rules) │
│ - MONGODB_URI             │
└────────┬──────────────────┘
         ▼
┌───────────────────────────┐
│ MongoDB Atlas M0 (free)   │
│  sellers  │  calls        │
└───────────────────────────┘
```

- **Why the tools run on the server:** the browser must never hold DB credentials. The browser only relays tool calls. The server reads Mongo, runs the deterministic `analyze.js`, and returns JSON.
- **Why a database at all:**
  - it stores multiple sellers (which enables the scenario switcher);
  - it keeps call history (which enables returning-caller memory);
  - it gives an audit trail of what the bot recommended.
- **Secrets:** `GEMINI_API_KEY` and `MONGODB_URI` live only in the server's environment. *This is a non-negotiable security boundary. Never ship either to the client.*

### 9.2a Data model (MongoDB)

```js
// sellers
{ _id: "S1001", name: "Ramesh Home Essentials", owner: "Ramesh", city: "Jaipur",
  category: "Home & Kitchen", active_skus: 60, assumptions: [ "..." ],
  metrics: { last_month: { sales: 200000, orders: 400, cancel_rate: 0.08, asp: 500, oos: 5 },
             this_month: { sales: 135000, orders: 270, cancel_rate: 0.14, asp: 500, oos: 18 } },
  oos_skus: [ { sku: "LB-01", name: "Steel Lunch Box Set", last_month_orders: 28, stock: 0 } ],
  cancel_reasons: { seller_stock_unavailable: 0.70, customer: 0.30 } }

// calls
{ seller_id: "S1001", started_at, ended_at, transcript: [ { role, text, ts } ],
  diagnosis: { ... }, action_plan: { issues: [], actions: [ { what, target, by_when } ] },
  follow_up_date }
```

- `seed.js` loads the given data plus the labelled assumptions (§5.3) into `sellers`. A second seller (S1002, price-driven drop) supports the scenario switcher.
- Index: `calls` on `{ seller_id: 1, started_at: -1 }`, for the "last call" lookup.

### 9.3 Tools (function-calling contract)

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `get_seller_metrics` | `seller_id` | Raw last/this month table | Ground truth |
| `analyze_sales_drop` | `seller_id` | Deltas, derived metrics, ranked findings with severity, recovery estimate | **Deterministic diagnosis.** The LLM narrates and never computes. |
| `get_oos_products` | `seller_id`, `limit` | Top OOS SKUs by last-month velocity | Specific, named recommendations |
| `create_action_plan` | `issues[]`, `actions[{what, target, by_when}]`, `follow_up_date` | Renders summary card | Structured summary (F7, P1 card) |
| `escalate_to_human` *(P1)* | `reason` | Ack | Out-of-scope handling |
| `get_last_call` *(P1)* | `seller_id` | Previous call's action plan and date, or null | Returning-caller memory |

All tools are served by the Node server, which reads Mongo. `create_action_plan` also writes the call document. The transcript is appended when the call ends.

### 9.4 System prompt (outline)

1. **Role & persona** (§8.2).
2. **Hard rules:**
   - Only state numbers returned by tools.
   - One question per turn.
   - At most 2–3 short sentences per turn, except the summary.
   - Never promise refunds, policy exceptions or guaranteed results.
   - Never recommend a blanket price cut when ASP is flat.
3. **Flow** (§8.1), with an instruction to call `analyze_sales_drop` right after the seller describes the problem.
4. **Recommendation rules:** at most 3; each one specific, measurable and time-bound; ordered by impact.
5. **Language:** mirror the seller's language. Use Indian number formatting.
6. **Closing:** always call `create_action_plan`, then speak the summary.

### 9.5 Minimal repo layout

```
index.html        # UI: call button, transcript, metrics panel, plan card
app.js            # Live API WebSocket session, mic capture / audio playback, relays tool calls to server
analyze.js        # deterministic diagnosis rules (§5.4) + self-check asserts (pure, no DB)
server.js         # POST /session, POST /api/tools/:name, static files, Mongo client
seed.js           # loads sellers S1001 (+ S1002) into Mongo
.env.example      # GEMINI_API_KEY=, MONGODB_URI=
README.md         # run steps, architecture, assumptions
```

### 9.6 Quality and latency budget

- **Audio formats:**
  - The Live API takes **16 kHz 16-bit PCM** input and returns **24 kHz PCM** output.
  - Use an `AudioWorklet` for capture and playback. This is the trickiest part of M1, so budget time for it.
- **Turn detection:** use the Live API's automatic voice-activity detection. Tune its silence sensitivity so the bot doesn't cut off a seller who pauses to think.
- **Barge-in on the client side:** when the server signals that the turn was **interrupted**, flush the local playback queue immediately. Otherwise the bot keeps talking from its buffer even though the model stopped.
- **Bot speaks first:** send one initial text turn (for example, "call started") on connect, so the greeting plays without the seller speaking first.
- **Transcript (F8):** enable input and output audio transcription in the session config. No separate STT is needed.
- **Key handling:**
  - Preferred: the server mints a short-lived **ephemeral token**.
  - If that is unavailable on the free tier, the server **proxies the WebSocket** instead.
  - In both cases the key never reaches the browser.
- **Audio:** `echoCancellation: true` and `noiseSuppression: true` on the mic. Use headphones for the recording.
- **Deployment:** HTTPS is required for mic access. Use Vercel, Render or Railway free tier. Localhost also works for the demo.

---

## 10. Guardrails & Trust

- **No fabricated numbers.** All figures come from tools. When data is missing, the bot says "I don't have that data."
- **No promises.** The bot gives no guaranteed sales outcomes, refunds or policy exceptions. It calls recovery estimates "estimated" or "could".
- **Labelled assumptions.** Assumed data (catalogue size, SKU names, cancellation split) is visibly marked.
- **Stays in scope.** Off-topic requests are politely redirected or escalated.
- **Privacy.**
  - Mock data only.
  - Call transcripts and plans are stored in Mongo, but only for fictional sellers.
  - No audio recordings are stored.
  - Use a dedicated DB user with read/write access to this one database only.
- **Secret handling.** The API key stays server-side. The client only gets short-lived tokens.

---

## 11. Test & Evaluation Plan

1. **Unit self-check.** `analyze.js` asserts the derived numbers: −32.5%, +6 pp, 3.6×, ~232 net orders.
2. **Scripted voice runs (10).** Three happy paths, two Hinglish, two "seller disputes data", one interruption-heavy, one off-topic, one "should I cut prices?". Score each against §7.
3. **Transcript audit.** Check every number spoken against tool output.
4. **LLM-as-judge (optional).** Feed transcripts with the rubric to a separate model and score 1–5 per criterion.
5. **Scenario switcher (P1).** Run the price-drop scenario and confirm the diagnosis changes. This proves the bot isn't hard-coded.

---

## 12. Delivery Milestones (time-boxed within the 24 h window)

| # | Milestone | User-visible outcome | Time box | Status |
|---|---|---|---|---|
| M1 | Voice loop | Click call, bot greets first, two-way talk with barge-in, transcript, end call | 60–90 min | pending |
| M2 | Grounded brain | Atlas M0 set up and seeded. Bot pulls data via server tools from Mongo and diagnoses inventory + cancellations correctly. | 60 min | pending |
| M3 | Recommend & summarise | 2–3 specific actions, spoken summary, `create_action_plan` called, assumptions note visible | 30 min | pending |
| M4 | Polish (P1) | P1 features in ICE order (§6.2) | ≤ 45 min | pending |
| M5 | Ship | Deployed HTTPS link, 1–2 min recording, one-page note, README | 45 min | pending |

**Effort reality check:** the brief expects 1–2 h. M1–M3 plus M5 is about 3–3.5 h, because raw audio handling in M1 takes real effort. That still fits easily within the 24 h window.

**Cut line:** if time runs short, drop M4 entirely. M1–M3 plus M5 meet every stated requirement.

### 12.1 Submission deliverables checklist

- [ ] Working demo link (HTTPS) or runnable repo with a 3-step README.
- [ ] **1–2 min recording.** Real voice. Show:
  - opener → data pull (metrics panel lights up, if P1 shipped) → one probing question → diagnosis → 3 actions → summary (card, if P1 shipped);
  - ideally one interruption, to prove barge-in.
- [ ] **One-page note:**
  - (1) models and voice platform and why;
  - (2) architecture diagram (§9.2);
  - (3) workflow and tools;
  - (4) prompt strategy;
  - (5) assumptions;
  - (6) what I'd do next (§15).
- [ ] Be ready to explain: the prompt, each tool, why the math is deterministic, and the latency trade-offs.

---

## 13. Open Questions

- [x] Which API access is available? **Resolved: Gemini API key only (free tier). Budget is ₹0.**
- [ ] Does Gemini Live free-tier quota allow about 10 test calls plus the recording in one day? Verify in AI Studio before building. If not, use the §9.1 option B pipeline.
- [ ] Is "Sales" gross order value or net delivered value? *Assumed gross, since 400 × ₹500 = ₹2,00,000.*
- [ ] Is "this month" a full month or month-to-date? *Assumed full. The bot confirms in conversation.*
- [ ] Is Hindi/Hinglish support valued by evaluators, or is English enough? *Treated as P1.*
- [ ] Hosted link vs local runnable: is either acceptable? *Plan for hosted. Keep local as backup.*

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM states wrong numbers | Med | High | Deterministic `analyze_sales_drop` tool. Prompt rule "only quote tool numbers". Transcript audit. |
| Latency feels robotic | Med | High | Speech-to-speech model. Short turns. Tune VAD. |
| Bot cuts the seller off, or never stops talking | Med | High | Tune VAD silence threshold. Test barge-in. |
| STT mishears Indian accents, Hinglish or numbers | Med | Med | Bot confirms key facts. Diagnosis doesn't depend on the seller's spoken numbers. |
| Bot sounds scripted and over-talks | Med | Med | Short-turn rule (§9.4), one question per turn, natural acknowledgements |
| Echo or feedback loop in recording | Med | Med | Headphones, `echoCancellation` |
| Mic blocked (no HTTPS) or browser incompatibility | Low | High | HTTPS deploy. Test on Chrome. Record backup. |
| API key leak | Low | High | Ephemeral tokens only. Key in server env, never in the repo. |
| Free-tier quota or rate limit hit during testing or demo | Med | High | Use a short test script. Close idle sessions. Switch to the free pipeline fallback (§9.1 B). The pre-recorded video is the safety net. |
| Over-scoping past 24 h | Med | High | Hard cut line at M3. P1 only after the MVP works end-to-end. |
| Raw audio plumbing (PCM resampling, playback queue) eats the time budget | Med | High | Start from Google's official Live API browser example rather than from scratch. If stuck after 90 min, switch to the §9.1 B pipeline. |
| Mongo adds latency, or a cold connection makes the bot pause mid-call | Med | Med | Connect once at server start and reuse the client. Read the seller document at call start and cache it for the session. Tool calls stay under about 200 ms. |
| Atlas blocks the deployed server (IP access list) | Med | High | Free hosts have changing IPs, so allow `0.0.0.0/0` together with a strong password and a least-privilege DB user. Test the deployed URL before recording. |
| Bot keeps talking after interruption | Med | Med | Flush the playback queue on the server's interrupted signal (§9.6). |

---

## 15. Beyond the Assignment — Production Vision (for the note and interview)

- **Proactive outbound KAM.** An anomaly detector notices OOS spikes or cancellation jumps and the bot calls the seller *before* sales fall.
- **Telephony.** Real phone calls (for example, an Exotel/Twilio bridge) for sellers who don't use laptops.
- **Indic languages.** Tamil, Telugu, Bengali and others beyond Hinglish.
- **Closed loop.** The bot checks back after 7 days, measures whether the actions worked, and re-diagnoses.
- **Acting, not just advising.** With consent, the bot can deactivate zero-stock SKUs, set restock alerts or create a deal directly.
- **Human handoff with context.** Escalations reach a human KAM with the transcript and diagnosis attached.
- **WhatsApp summary.** The action plan is delivered where sellers already work.

---

## 16. Review & Changelog

**v2 review (product-lens diagnostic).** Verdict: **GO.** The problem, user, MVP, anti-goals and metrics are all concrete. The data story is strong and sound. The main risk is execution time on audio plumbing, not product direction.

| # | Finding in v1 | Fix in v2 |
|---|---|---|
| 1 | No "why now" | Added to §1 |
| 2 | Seller identity never explained (how does the bot know "Ramesh"?) | Assumption added to §5.3 |
| 3 | No "End call" button, no call states or error states | F1 and F1b in §6.1 |
| 4 | Not specified that the bot speaks first | F2 and §9.6 |
| 5 | Sample dialogue broke its own 2-sentence rule and showed no barge-in | Dialogue tightened, interruption added, rule set to 2–3 short sentences |
| 6 | Hinglish metric was in MVP success criteria though Hinglish is P1 | §7 metric made conditional |
| 7 | P1 features had no priority order | ICE ranking in §6.2 |
| 8 | Repo layout still said "WebRTC" after the switch to Gemini | Fixed in §9.5 |
| 9 | Missing Gemini Live specifics: audio formats, interrupted-signal flush, transcription config, token fallback | Added to §9.6 |
| 10 | M1 time underestimated; total effort exceeded the brief's 1–2 h without saying so | §12 re-estimated, with an effort reality check |
| 11 | Recording checklist assumed P1 features | Made conditional |
| 12 | Audio-plumbing risk missing | Added to §14 |
| 13 | Question bank lacked selection rules | §8.3 extended |

**v2.1 — MongoDB added (user decision).**
- Atlas M0 (free) with `sellers` and `calls` collections.
- Tools moved from the browser to the server, so DB credentials never reach the client.
- New P1 feature: returning-caller memory (`get_last_call`). Mongo exists to enable it.
- "Persistent memory" removed from out-of-scope.
- M2 re-estimated to 60 min.
- Two new risks added: DB latency and the Atlas IP access list.

**v2.2 — implementation deviations (ponytail pass).**
- The server **proxies the Gemini WebSocket** and runs the tools itself. The browser never calls Gemini or sends tool calls. This replaces the ephemeral-token design in §9.2 and is simpler.
- `get_seller_metrics` is folded into `analyze_sales_drop`, which returns the raw metrics too.
- `get_last_call` is replaced by injecting the previous plan into the system prompt at call start.
- No Express: Node's built-in `http` serves `public/`. Three runtime dependencies: `@google/genai`, `mongodb`, `ws`.
- Built: M1 (voice loop), M2 (Mongo + tools), M3 (plan + summary), plus metrics highlight, action-plan card, scenario switcher and returning-caller memory. Hinglish is handled by one prompt line.
- Verified without a Gemini key: 4 unit tests pass, server boots, seeding works, path traversal blocked, bad-key error reaches the UI. **Not yet verified:** real Gemini audio, barge-in, and the model name, because that needs a key and a microphone.

**v2.3 — full KAM coverage (user decision: bot must answer questions across the whole seller business).**
- Scope widened from "why did sales drop" to 12 categories: sales, orders, inventory, cancellations, pricing, products, visibility, returns, growth, targets and forecasts, operations, payments/escalation. **No per-question if/else:** the model understands the intent and picks a tool.
- Data is labelled in three tiers: GIVEN (the brief's five metrics), SAMPLE (top-10 products, traffic, return reasons, earlier months, all disclosed by the bot), NOT AVAILABLE (cancellation reasons, payments, competitor prices, ad spend: the bot asks or escalates, never invents).
- Tools now: `analyze_sales_drop`, `get_business_data(topic)`, `get_oos_products`, `get_forecast`, `create_action_plan`, `escalate_to_human`. Recovery and target maths is in code (`forecast`), described as estimates.
- Verified headline facts are computed in code and placed in the system prompt, so common answers need no tool call (faster voice, no invented numbers).
- Guardrails added: cannot change the seller's account, no competitor claims, refuse off-topic and prompt-extraction, admits it is an AI, escalates payments and blocked accounts, stays short for voice.
- Prompt, tools and data moved to `kam.js` (shared by server and eval). New `eval.mjs`: 33 evaluator-style questions, rule-graded. Result on a small text model (`gemini-3.1-flash-lite`): pass@1 31/33, pass@2 33/33 (pass^2 29/33). Iterating on this found real defects: asking permission instead of answering, over-long answers, inventing numbers when skipping tools, Devanagari Hindi.
- Cancellation-reason split removed from the mock data (the brief gives none).

---
*Status: DRAFT v2.3 — reviewed, MVP implemented, full-coverage eval passing. Next: build M1 → M3, then P1 in ICE order.*
