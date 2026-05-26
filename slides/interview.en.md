---
marp: true
paginate: true
size: 16:9
title: Staff Engineer Interview — Courier Offer System
author: Tony (Qihuan Yang)
math: false
style: |
  :root {
    --accent: #2f6fed;
    --ink: #1c2330;
    --muted: #6b7686;
    --bg: #ffffff;
    --soft: #f4f6fb;
  }
  section {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
                 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    font-size: 25px;
    color: var(--ink);
    background: var(--bg);
    padding: 56px 64px;
  }
  h1 { color: var(--ink); font-size: 46px; letter-spacing: -0.5px; }
  h2 { color: var(--accent); font-size: 33px; border-bottom: 2px solid #e6ebf5; padding-bottom: 8px; }
  h3 { color: var(--ink); font-size: 25px; }
  strong { color: var(--accent); }
  a { color: var(--accent); }
  table { font-size: 20px; border-collapse: collapse; width: 100%; }
  th { background: var(--soft); color: var(--ink); text-align: left; }
  th, td { border: 1px solid #e6ebf5; padding: 6px 10px; }
  code { background: var(--soft); color: #b3461d; padding: 1px 6px; border-radius: 4px; font-size: 0.85em; }
  pre { background: #0f1626; border-radius: 10px; font-size: 18px; }
  pre code { background: transparent; color: #e8eaed; }
  pre code .token.property { color: #ffc56e; }
  pre code .token.string { color: #b8e6a8; }
  pre code .token.number,
  pre code .token.boolean,
  pre code .token.null { color: #ff9faa; }
  pre code .token.punctuation { color: #9aa3b3; }
  blockquote { border-left: 4px solid var(--accent); color: var(--ink); background: var(--soft);
               padding: 12px 18px; border-radius: 0 8px 8px 0; font-style: normal; }
  section.lead { justify-content: center; text-align: left; }
  section.lead h1 { font-size: 54px; }
  .muted { color: var(--muted); }
  footer { color: var(--muted); font-size: 14px; }
  section::after { color: var(--muted); font-size: 14px; }  /* page number */
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Courier Offer System Modernization
## & Real-time Fraud Detection Team Guidance

**Tony (Qihuan Yang)**

<!--
SAY (~30 sec):
- "Hi everyone, thanks for having me."
- "We have the hour — about 30 minutes on UC1, 20 on UC2, plus questions throughout."
- "Please jump in any time — I'd rather make this a conversation."
- "My read on Staff is two things: influence, not authority. And hands-on — POCs, fail fast."
- "I'll answer both cases that way. And for UC1, I actually built a small running prototype."
-->

---

## Agenda

**Use Case 1 — Courier Offering System** (~30 min)
1. Technical Decision — evaluate Approach A vs B, then recommend
2. System Design — end-to-end architecture
3. Technical Leadership — facilitating the mobile team
4. Migration Strategy — metrics & rollback

**Use Case 2 — Fraud Detection Team Guidance** (~20 min)
Diagnose · Guide without solving · 3-day plan · Knowledge transfer · Work with TM

*Questions welcome throughout — let's make it a conversation.*

<!--
SAY:
- "For UC1, in this order: technical decision → system design → leadership → migration."
- "For UC2: diagnose · guide · 3-day plan · KT · work with TM."
- "Why decision before design? You can't design a system you haven't decided on."
- "Recommendation comes first; design backs it up."
- "Please jump in any time."
-->

---

# Use Case 1

## Courier Offering System Modernization

<!-- _class: lead -->

<!--
SAY:
- "Okay — Use Case 1. Modernizing the courier offering system."
-->

---

## Problem & Constraints

- 15 countries · 50,000+ couriers · **2M offers/hour** peak (~556 RPS)
- SLA **200 ms p95** — today ~180 ms → only **~20 ms real headroom**
- Needs: A/B presentation · personalized earnings · gradual rollout · multiple earning models

**Today:** one hardcoded `Offer.java`, earnings logic across 3 services, every change = full multi-region deploy, **no A/B testing**

> Already an **event-driven, distributed** system (SQS + Temporal + AppSync on AWS), already pushing structured JSON to mobile → my answer is **evolution, not rewrite**.

<!--
SAY:
- "15 countries, 50K+ couriers, 2M offers per hour at peak — ~556 a second."
- "SLA is 200ms p95. We're already at ~180. So only about 20ms of real headroom — remember that number."
- "Today: one hardcoded Offer.java. Every change is a full multi-region deploy. No A/B testing."
- "The real pain isn't performance — it's RIGIDITY. Nothing can change, nothing can be tested."
- "But: the system is already event-driven and distributed (SQS, Temporal, AppSync). Already pushes structured JSON to mobile."
- "So my answer is going to be an EVOLUTION, not a rewrite."
-->

---

## Technical Decision — A vs B (the two options on the table)

| | A (Template DSL) | B (Raw data + mobile) |
|---|---|---|
| Experiment speed | fast (server-only) | **slow** (app release per change) |
| 200 ms risk @ 2M/h | **high** (server renders) | low |
| Native UX | **poor** | great |
| iOS/Android consistency | guaranteed | **hard** |
| Mobile complexity | lowest | **highest** |

**Neither alone wins:** A buys experiment speed but gives up native UX *and* risks the 200 ms SLA; B keeps native UX but every layout experiment needs an app release.

<!--
SAY:
- "The prompt gives me two options. Let me evaluate them fairly."
- "Approach A — server-side template engine. Server pre-renders the finished text. App just paints it."
- "  Good: experiments are fast, no app release."
- "  Bad: at 2M/h, server is rendering on the hot path — that's a real 200ms risk. Native UX is poor."
- "  → A trades native UX and latency for experiment speed."
- "Approach B — server sends raw data. Mobile owns the layout."
- "  Good: native UX great. Backend light."
- "  Bad: every layout experiment needs an app-store release. iOS/Android drift. Mobile complexity unbounded."
- "  → B trades experiment speed and consistency for native UX."
- "[pause] Neither alone wins. Which forces the question — is there a third way?"
- "⚠️ Do NOT mention Approach C yet — that's the next slide's reveal."
-->

---

## Approach C (Hybrid) — take the best of both ✅

> The prompt framed it as A **or** B. The real answer **combines** them.

- **From A:** server controls *what + order* → experiment **without an app release**
- **From B:** mobile renders **natively** → great UX, uses the platform
- **One line:** *server decides what + order; mobile decides how* (component registry)

**B vs C — the one real difference:** "which components & in what order" is **app logic on mobile in B**, but **data from the server in C**.
→ **C = B + a server-controlled layout descriptor + experiment assignment moved server-side.**

**Honest cost:** upfront contract + component governance; changing an existing component's schema still needs a release / dual-emit.

<!--
SAY:
- "There IS a third way — Approach C, a hybrid. Takes the best of both."
- "From A: server controls WHAT components and IN WHAT ORDER → experiment with no app release."
- "From B: mobile renders NATIVELY → UX stays great."
- "North-star line: 'Server decides what and order; mobile decides how.' Via a small registry of ~10–15 components."
- "B vs C — one real difference: in B, layout is app logic. In C, it's data the server sends."
- "Honest cost: upfront contract + component governance. Changing an existing component still needs a release."
- "Not free — but the right trade."
-->

---

## System Design — Hybrid (Approach C)

**Server decides _what + order_; mobile decides _how_.**

4 new in-process components, after Temporal returns pay + bonus:

![w:1080](img/system-design-flow.png)

- Each component carries a **latency budget + a failure mode** — fail-closed · dual-write · idempotency · cache-independent sticky hash. *That's the distributed-systems design, not just impl.*

**+10ms — and it won't tail-spin:** in-process + cached (no hot-path network I/O); flag/config outage → **fail-closed**. If measured latency nears budget → move resolution off the request path (precompute).

<!--
SAY:
- "Now that we've picked C — here's how it's built."
- "4 new in-process components, right after Temporal returns pay and bonus."
- "Every component carries a LATENCY BUDGET and a FAILURE MODE — fail-closed, dual-write, idempotency, cache-independent sticky hash."
- "That's the distributed-systems design — not just implementation."
- "Adds ~10ms, inside our 20."
- "Why it won't tail-spin: in-process + cached, ZERO hot-path network I/O. A flag-service outage → fail closed."
- "If measured latency ever creeps toward budget → move resolution off the request path entirely."
- "[next slide drills into each component]"
-->

---

## How Approach C Works — Server side

**4 in-process components**, after Temporal returns pay + bonus:

| Component | Job | How it works |
|---|---|---|
| **Experiment Resolver** | pick variant for this courier | sticky hash `(courierId + expId) % 100 < pct` · no DB · **fail-closed → control** |
| **Earnings Calculator** | unify flat / distance / surge / tips | pure compute — data already fetched |
| **Layout Composer** | emit `components[]` + `hints` | read variant + market from config |
| **Payload Builder** | assemble final JSON | branch on `min_app_version` for legacy apps |

→ All four are **in-process, cached, zero hot-path I/O** — the reason `+10ms won't tail-spin`.

<!--
SAY:
- "Let me drill into how C actually works — first the server side."
- "4 in-process components, right after Temporal returns pay and bonus:"
- "  1. Experiment Resolver: picks the variant via sticky hash. No DB. Fails closed to control if anything's wrong."
- "  2. Earnings Calculator: unifies flat / distance / surge / tips. Pure compute — data already fetched."
- "  3. Layout Composer: emits components and hints from config."
- "  4. Payload Builder: assembles the final JSON. Branches on min_app_version so old apps get the legacy format."
- "Key point: all four are IN-PROCESS, CACHED, ZERO hot-path network I/O."
- "  That's why the +10ms won't tail-spin under load — no dependency to time out on."
- "[next slide: the mobile half]"
-->

---

## How Approach C Works — Mobile side (the registry)

**Component registry** (~10–15 entries):

- A locked **map: `component_name → native renderer`** (one shared schema → codegen iOS + Android)
- For each name in `layout.components[]`: **registry lookup → render natively with `data[name]`**
- **Unknown name → skip silently** — server can ship ahead of the app

```kotlin
// shared schema → codegen'd, identical on iOS + Android
registry = mapOf(
  "earnings_breakdown" to EarningsBreakdownView,
  "surge_indicator"    to SurgeIndicatorView,
  "accept_cta"         to AcceptCTAButton,
  // ... ~10–15 total, governed by review board
)
```

> Server sends **data** (`layout`); mobile ships **code** (`registry`). Two teams, one contract.

<!--
SAY:
- "Now the mobile half — the component registry."
- "It's basically a locked map: component_name → native renderer view."
- "About 10–15 entries, governed by a review board so it doesn't sprawl."
- "Both iOS and Android codegen this from ONE shared schema — so they cannot drift."
- "Render loop: for each name in layout.components, look it up, render natively with the matching data slice."
- "Unknown name? SILENTLY SKIPPED. That's how the server can ship ahead of the app — forward-compat by default."
- "The killer framing: 'Server sends DATA. Mobile ships CODE.' That's the boundary that makes C work."
-->

---

## The Payload Contract

```json
{
  "experiment": {
    "earnings_display": { "variant": "breakdown_v2", "group": "treatment" }
  },
  "layout": {
    "components": ["earnings_breakdown", "surge_indicator", "accept_cta"],
    "hints": { "highlight_field": "surge" }
  },
  "data": {
    "earnings_breakdown": { "model": "surge", "total": 730, "currency": "CAD" }
  }
}
```

- Same delivery, **different layout per market** (CH / UK / CA)
- Layout is embedded per offer (cheap; memoized by variant/zone/tier)

<!--
SAY:
- "Here's the contract, concrete."
- "Server sends three things: layout (components + order), raw data, and a few hints."
- "Mobile renders it through the registry."
- "Nice property: same delivery, different layout + earnings model per market — Switzerland, UK, Canada — all from config."
- "Unknown components silently skipped → older apps stay safe."
-->

---

## ▶ Live POC — Hybrid SDUI (I built this)

🌐 **Live: <https://offer.gummui.com>** — runnable, on AWS, with TLS

![w:600](img/demo-client.png)

- **<https://offer.gummui.com/approaches>** ← **A vs B vs C payloads on the wire** (the data difference)
- **<https://offer.gummui.com/admin>** — change layout → save → green toast (no deploy)
- **<https://offer.gummui.com/client>** — offer **pushed** down via SSE, sticky hash per courier
- Server-driven layout · sticky A/B (inspector: bucket 95 → control) · SSE push · React + Express

<!--
SAY:
- "This isn't just on paper — I built a running prototype, deployed on AWS at offer.gummui.com."
- "[switch to /approaches]"
- "Let me start with /approaches — this shows ALL THREE approaches side by side on the wire."
- "  A sends finished strings — '$11.76' already rendered. App is just a painter."
- "  B sends raw data plus flags — mobile owns all presentation logic."
- "  C sends layout + data — server decides what and order, mobile decides how."
- "[switch to /admin]"
- "On /admin: I change the layout, hit save — live, no deploy. No app release."
- "[switch to /client]"
- "On /client: the offer is PUSHED down a stream. The same courier always resolves to the same variant via sticky hash."
- "[back to slides]"
- "This is the hands-on, fail-fast piece — I'd rather show a small running thing than just describe it."
- "🔴 Fallback: if the live URL is down, this slide has a screenshot. Local copy also runs at localhost:5173."
-->

---

## Technical Leadership

> *Mobile is worried Approach B/C increases their complexity. How do you facilitate?*

**Principle: validate the concern, then sharpen it.** (not *whether* — *how much, what kind, what's on the other side*)

1. Acknowledge in writing → us-vs-problem
2. Working session, sharpen "complexity" → **bounded mitigations** (locked registry, codegen, forward-compat, co-owned RFC)
3. Propose a **small reversible proof, mobile-led** (1 zone, 1 component, 4 weeks) — *fail fast*; pre-state escalation (→ ADR)

This is **influence, not authority** — verbatim from the JD.

<!--
SAY:
- "Now the leadership question — mobile is worried C adds complexity. Honestly, they're right to worry."
- "My principle: FIRST I agree the concern is real. THEN I make it specific."
- "It's not WHETHER it adds complexity — it's HOW MUCH, WHAT KIND, and WHAT'S ON THE OTHER SIDE."
- "Three steps:"
- "  (1) Acknowledge it in writing first — frames it as us-vs-the-problem, not me-vs-them."
- "  (2) Working session, not a presentation — mobile tells me what 'complexity' actually means. I bring concrete fixes that cap the cost: locked registry (~10–15), codegen, forward-compat skip, shared RFC we co-write."
- "  (3) Instead of voting: a small POC the MOBILE TEAM leads. One zone, one component, four weeks. Easy to undo."
- "And I say upfront how we'd escalate if we still disagree — so nobody feels trapped."
- "This is influence, not authority — verbatim from the JD."
-->

---

## The closing posture

> **"My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision.**
> **I'd advocate C, but I'd rather ship B with mobile fully bought in than ship C with mobile compliant but quietly resentful."**

<!-- _class: lead -->

<!--
SAY (memorize, slow, firm):
- "My job isn't to win the architecture argument..."
- "...it's to make the team that builds and runs this a CO-AUTHOR of the decision."
- "I'd push for C — but I'd rather ship B with mobile fully bought in,"
- "...than ship C with mobile compliant but quietly resentful."
- 🎯 This is the Senior/Staff watershed line. Slow down. Eye contact.
-->

---

## Migration & Metrics

**4 phases, every step reversible:**
Foundation (no-op) → Dual payload (`data` + `data_v2`) → Flag rollout (1→5→25→50→100% per city) → Experiment live

| Class | Metric | Target |
|---|---|---|
| SLA | p95 / p99 | ≤200 / ≤300 ms |
| Business (per variant) | acceptance / time-to-accept / **dispute** | no regression |
| Experiment | assignment consistency / flag fallback | 100% / <1% |
| Migration | % on v2 / field parity | tracked / 100% |

**Rollback:** feature-flag instant-off + dual-write → mobile always falls back to `data`.

<!--
SAY:
- "Migration is reversible at every step. 4 phases."
- "Phase 1: no-op foundation — zero behavior change, verified in shadow mode."
- "Phase 2: dual payloads — old and new side by side."
- "Phase 3: flag rollout, 1% → 100% per city, with the sticky hash."
- "Phase 4: experiments go live."
- "Metrics in 4 buckets:"
- "  SLA — p95 and p99."
- "  Business metrics PER VARIANT — acceptance, time-to-accept, dispute rate. Watch for REGRESSION, not just lift."
- "  Experiment health: assignment consistency, flag fallback rate."
- "  Migration progress."
- "Principle: any step rolls back in seconds. Dual-write means mobile always has the old field to fall back to."
-->

---

## Use Case 1 — in one line

> *"I recommend the hybrid (C): server controls layout + experiments, mobile renders natively. It buys experiment velocity **and** native UX within 200 ms / 2M-per-hour, evolves the existing event-driven system, and migrates with instant rollback — and the real Staff work is making mobile a **co-author** of the decision."*

<!-- _class: lead -->

<!--
SAY:
- "In one line — hybrid. Server controls layout and experiments. Mobile renders natively."
- "Experiment speed AND native UX, inside the 200ms / 2M-per-hour budget."
- "Evolves the existing event-driven system. Migrates with instant rollback."
- "And the real Staff work: making mobile a CO-AUTHOR of the decision."
-->

---

# Use Case 2

## Real-time Fraud Detection — Team Guidance

<!-- _class: lead -->

<!--
SAY:
- "Okay — Use Case 2. A 4-person team building real-time fraud detection. And they're in trouble."
-->

---

## The Situation

- 4 engineers (2–3 yrs), Kafka + Flink fraud detection
- **45s latency** vs <5s target · scope crept **3 → 12 patterns**
- Sprint review in **3 days, nothing to demo** · low morale · PM escalating

**Principle: the crisis is the deadline, not the architecture.**
Don't parachute in and rewrite it — buy time, narrow scope, coach, let them ship something they understand.

> Role: guide **without doing the work for them**, working **with** the Tech Manager — not replacing them.

<!--
SAY:
- "Recap: 4 engineers. Kafka + Flink. 45-second latency vs 5-second target."
- "Scope crept 3 → 12 patterns. Nothing to demo in 3 days. Low morale. PM escalating."
- "My core principle: the crisis is the DEADLINE, not the architecture."
- "Most common Staff mistake: charge in, rewrite, 'save' the sprint. That solves the demo and breaks the team."
- "Right move: buy time, narrow scope, coach. Let them ship something they understand."
- "And the engineer who wants to 'start over with something simpler' — they might be right. Take it seriously."
-->

---

## Staff vs Tech Manager — draw the line first

| Area | TM owns | Staff owns |
|---|---|---|
| Sprint scope · deadlines · PM negotiation | ✓ | technical framing |
| Individual performance · morale | ✓ | surface tech causes |
| Architecture · testing · RFCs · mentorship | | ✓ |
| Sprint-review narrative · escalation | shared | shared |

**First 30 min = a 1:1 with the TM** to draw exactly this line.

<!--
SAY:
- "First, I draw the line with the TM. The prompt says clearly I work WITH them, not as them."
- "TM owns: scope, deadlines, PM negotiation, individual morale."
- "Staff owns: architecture, testing, RFCs, mentorship."
- "Shared: sprint-review narrative + any escalation."
- "Literally my first 30 minutes is a 1:1 with the TM to draw exactly that line."
- "Trap: stepping into their job. Using their authority without coordinating undermines them."
-->

---

## 1 · Diagnose — ask, don't lead

- **Architecture:** "Walk the data flow on a whiteboard." "Where are the 45s spent — measured or inferred?" "Sync I/O in operators? parallelism? watermarks?"
- **🔑 The big one:** "Is Flink even right for our event rate?" — **UC2 gives no number**. Delivery events ≈ **~20/sec**; *with GPS pings* likely **~1k–3k/sec** (UC1's 2M/hr ≈ 556/sec confirms hundreds/sec). Range straddles overkill vs justified → **measure first, then right-size.**
- **Scope — audit the 12 first:** dupes? subsets? data-unavailable? mergeable? *Often "12" collapses to 4–5 distinct patterns.* Then: "which do stakeholders actually want this quarter?"
- **Data quality:** "What % of events miss location — null / stale / missing entirely?"
- **Testing:** "Show me how you test one rule end-to-end."

<!--
SAY:
- "Diagnosis — ask questions that turn symptoms into causes. I don't feed them the answer."
- "On the 45 seconds: 'Walk the data flow on a whiteboard. Where's the time going — measured, or assumed? Sync I/O in operators? Parallelism? Watermarks?'"
- "The big one: 'Is Flink even right for our event rate — have we measured it?'"
- "Prompt gives NO number. Delivery events ≈ ~20/sec; with GPS pings, ~1k–3k/sec."
- "Range goes from overkill to justified — MEASURE FIRST, don't assume."
- "On scope: I don't just ask 'which 3 of 12.' I AUDIT the 12 first with the team."
- "  Often '12 patterns' is really 4–5 distinct ones — some are duplicates, subsets, or need data we don't have."
- "  That's not a number game — that's engineering the scope DOWN before we even pick."
- "Also ask: data quality, testing."
- "Ask in waves, not 30 at once. The questions ARE the coaching."
-->

---

## 2 · The 3-day plan — ruthlessly descope

**Load-bearing move:** ship **one** pattern that tells the story —
*"marked complete >500m from destination"* (data's already there, just a distance calc, <5s with or without Flink).

- **Day 1:** TM 1:1 (RACI) · architecture walk-through — **audit Flink telemetry** (bad watermarks? sync I/O?) · **audit the 12 patterns** (dupes / subsets / data gaps) · **scope-lock with PM in writing** (1 ship · rest grouped: deferred / merged / dropped) · pair (they drive)
- **Day 2:** pair to a working skeleton · first test fixture · draft an honest review narrative
- **Day 3:** dry run (they present) · **pre-brief the Director with the TM** · schedule a post-demo retro

Avoid a half-working live demo that fails. **The team presents and gets the credit.**

<!--
SAY:
- "Big call: CUT SCOPE, hard."
- "Ship ONE pattern that tells the story — 'marked complete more than 500m from destination.' Data's there, distance calc, well under 5s."
- "But I'm not just cutting business scope to dodge the real problem."
- "Day 1: TM 1:1. Two audits in parallel:"
- "  ① Flink telemetry — bad watermarks? Sync DB call in an operator?"
- "  ② The 12 patterns — duplicates? subsets? data we don't have? Often '12' collapses to 4–5 real ones."
- "  Then scope-lock with PM IN WRITING — 1 shipped, rest grouped as deferred / merged / dropped (not just '11 deferred')."
- "Day 2: pair to working skeleton + first test fixture. Draft honest review narrative."
- "Day 3: dry run, THE TEAM presents. TM and I pre-brief the director."
- "At review: I sit in the audience. The TEAM gets the credit."
- "Avoid a half-working live demo that fails."
-->

---

## 3 · Guide without solving

- Pair, don't solve · whiteboard principles, not fixes · code-review **in questions**
- They write the RFC, you comment · bring a Principal for a second opinion (they present)
- But don't withhold facts — if asked "ms or s for checkpoints?", just answer

**Worked example — the 45s latency:**
- ❌ Senior: *"It's backpressure — add async I/O, double parallelism."*
- ✅ Staff: *"What's the latency breakdown? → what does the metric say? → how do we confirm? → run it — what would the result tell us?"*

Same destination — the Staff version teaches the **debugging method**.

<!--
SAY:
- "How I guide without taking over:"
- "I pair, but they drive the keyboard."
- "I whiteboard PRINCIPLES, not fixes."
- "My code-review comments are QUESTIONS — 'what happens if this is null?' — not instructions."
- "Worked example, the 45s latency:"
- "  Senior move: 'It's backpressure — add async I/O, double parallelism.'"
- "  Staff move: 'What's the latency breakdown? What does the metric say? How would we confirm? Let's run it — what would the result tell us?'"
- "Same destination — but the Staff version teaches the debugging METHOD."
- "Caveat: I don't withhold facts to be pure. If they ask 'ms or s for checkpoints?' — I just answer."
-->

---

## 4 · Long-term — knowledge transfer (30/60/90)

| Window | Activity |
|---|---|
| **30 days** | streaming study group (2h/wk) · external SME sessions · architecture office hours |
| **60 days** | each builds a Flink toy project · team writes the v2 RFC · read another team's real job |
| **90 days** | each *teaches* one concept (watermarks, backpressure…) · name a streaming SME · pair with an experienced team |

**Don't let them learn in isolation** — broker a partnership with a team that runs production streaming.

<!--
SAY:
- "Longer term — this is what prevents the NEXT 3-day crisis."
- "30 days: streaming study group, external SMEs, architecture office hours."
- "60 days: each engineer builds a small Flink toy project. The team writes the v2 RFC."
- "90 days: each engineer TEACHES one concept back — watermarks, backpressure — because teaching is when they really own it."
- "Key principle: don't let them learn in isolation. If another team runs production streaming, I set up that connection."
- "Cross-team learning beats self-study."
-->

---

## 5 · Work with TM / Principals / Leadership

- **TM (peer):** daily 15-min during crunch; architecture runs through me, scope is theirs, individual feedback is theirs — **never go around the TM**
- **Principals:** early second opinions + pattern-matching; a resource, not political backup
- **Leadership:** get ahead of the escalation — **brief jointly with the TM**:

> *"The team picked Flink for a workload well below its design point at the rate we measured. We've descoped to one pattern; we'll formally evaluate the architecture over 30 days. We'd like your air cover with the PM."*

<!--
SAY:
- "With the TM: daily 15-min check-in during the crunch. Architecture through me. Scope theirs. NEVER go around them."
- "With Principals: pull them in early for a second opinion. Not to do the work. Not as backup over my TM."
- "With leadership: GET AHEAD of the escalation. Before PM frames it, the TM and I brief them TOGETHER:"
- "  'The team picked Flink for a workload well below its design point at the rate we measured. They're paying a complexity tax. We've descoped to one pattern. We'll evaluate the architecture over 30 days. We'd like your air cover with the PM.'"
- "And if the 'start over' engineer was right — I praise them publicly, frame the Flink work as not wasted, and own the lesson."
-->

---

## Use Case 2 — the posture

> **"My role is to make the team better at this — not to do the work for them. The 3-day deadline is a constraint to navigate, not a performance to deliver.**
> **If I do my job right, this team handles the next streaming project without a Staff parachute."**

<!-- _class: lead -->

<!--
SAY (memorize, slow, firm):
- "My role is to make the team better at this — NOT to do the work for them."
- "The 3-day deadline is a constraint to navigate — not a performance to deliver."
- "If I do my job right, this team handles the next streaming project WITHOUT a Staff parachute."
- 🎯 Slow down. This is the UC2 watershed line.
-->

---

## Closing — two postures, one standard

- **UC1 (leadership):** make the team that ships it a **co-author** — *"I'd rather ship B fully bought-in than C quietly resentful."*
- **UC2 (guidance):** **leverage over time, not heroics** — *"no Staff parachute next time."*

Both answered the same way:
**influence, not authority · fail fast · hands-on POCs** — exactly what the role calls for.

<!-- _class: lead -->

<!--
SAY:
- "To close — two postures, one standard."
- "UC1: making the team a CO-AUTHOR — 'I'd rather ship B fully bought-in than C quietly resentful.'"
- "UC2: LEVERAGE OVER TIME, not heroics — 'no Staff parachute next time.'"
- "Both answered the same way — influence not authority, fail fast, hands-on POCs."
- "That's my read on Staff, and what this role calls for."
-->

---

## Questions

**Happy to go deeper — I have notes and runnable artifacts ready:**

- **Experiment design** — deterministic sticky bucketing · multi-arm splits · collisions & mutual-exclusion groups
- **Latency at 2M/h** — the budget · the p99 tail · fail-closed under a slow dependency
- **Bringing the mobile team along** — registry governance · the co-authored contract
- **Migration & cost** — phased rollout · ~1 quarter to first experiment · POC-gated
- **UC2 streaming** — Flink right-sizing (measure first) · diagnosing the 45s lag

📂 *Live POC · ADR-001 · RFC skeleton — open on request*

**Thank you.**

<!-- _class: lead -->

<!--
SAY:
- "Thank you — happy to take questions."
- "I have deeper detail on any of these, plus a runnable POC."
- "Where would you like to start?"
- 🎯 Leave this board up during Q&A — it steers questions toward prepared ground.
-->
