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
SAY (~40 sec):
- "Hi everyone, thanks for having me. Quick intro — I'm Tony, a Senior Java Developer on the scheduling team. I've been with the company for three years, working on things like Keycloak and shift-planning automation."
- "We have the hour — about 30 minutes on UC1, 20 on UC2, plus questions throughout."
- "Please jump in any time — I'd rather make this a conversation."
- "My read on Staff is two things: influence, not authority. And hands-on — POCs, fail fast."
- "I'll answer both cases to that standard."
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
- "Quick agenda."
- "For UC1, I'll walk through four things — the technical decision, then the system design, then leadership with the mobile team, and finally migration."
- "Then UC2 — diagnosis, guiding without solving, the 3-day plan, knowledge transfer, and working with the TM."
- "And please jump in any time — I'd rather make this a conversation than a one-way talk."
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
- "Here's the situation."
- "15 countries. Over 50,000 couriers. Two million offers an hour at peak — about 556 a second."
- "The SLA is 200 milliseconds at p95. We're already at about 180 today. So realistically, we only have around 20 milliseconds of real headroom."
- "Today, there's one hardcoded Offer.java file. Every change is a full multi-region deploy. And no A/B testing."
- "So the real pain isn't performance — it's rigidity. Nothing can change. Nothing can be tested."
- "But the system is already event-driven and distributed — SQS, Temporal, AppSync on AWS — and it already pushes structured JSON to mobile."
- "So my answer is going to be an evolution, not a rewrite."
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
- "Approach A is a server-side template engine. The server pre-renders the finished text — the app just paints it."
- "The good: experiments are fast, no app release needed."
- "The bad: at 2 million an hour, the server is rendering on the hot path — that's a real 200ms risk. And the native UX is poor."
- "So A trades native UX and latency for experiment speed."
- "Approach B is the opposite. The server sends raw data. Mobile owns all the layout."
- "The good: native UX is great, the backend stays light."
- "The bad: every layout experiment needs an app-store release. iOS and Android drift. And mobile complexity grows without limit."
- "So B trades experiment speed and consistency for native UX."
- "[pause] Neither alone wins. Which forces the question — is there a third way?"
- ⚠️ 这页【不要】提 Approach C —— 留给下一张做悬念揭晓。
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
- "There is a third way — Approach C, a hybrid. It takes the best of both."
- "From A, the server controls which components show and in what order. So we can experiment without an app release."
- "From B, the mobile app renders them natively. So the UX stays great."
- "Here's the key idea — server decides what and order. Mobile decides how. Through a small registry of about 10 to 15 components."
- "If you ask how this is different from B — in B, the layout is app logic. In C, it's data the server sends."
- "Honest cost: C needs an upfront contract and component governance. And changing an existing component still needs a release."
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
- "Now that we've picked C, here's how it's built."
- "Four new components, all running inside the same service. They kick in right after Temporal returns pay and bonus."
- "Two things I want to point out, as distributed-systems design."
- "First — each component has a latency budget AND a failure mode. What to do if something goes wrong: fall back to a safe default, dedupe [dee-DOOP], never double-count."
- "Second — together they add about 10 milliseconds. That's well inside our 20."
- "And here's why it won't blow up under load — none of them make a network call on the hot path. If the flag service is slow or down, we just fall back to defaults."
- "If we ever measure latency creeping toward budget, we'd move that work off the request path — pre-compute it in the background."
- "Next slide — I'll drill into each component."
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
- "Let me drill into each component, starting with the server side."
- "Four components, right after Temporal returns pay and bonus."
- "The first one is the Experiment Resolver. It picks the variant for this courier using a sticky hash — same courier, same variant, every time. No database. If anything goes wrong, it falls back to control."
- "Then the Earnings Calculator. It calculates the courier's total earnings — base pay plus distance plus surge plus tips. Pure compute — the data is already fetched upstream."
- "Layout Composer comes next. It reads the variant and the market from config, and produces the list of components plus any hints."
- "Last is the Payload Builder. It assembles the final JSON, and branches on min_app_version so old apps get the legacy format."
- "The key thing — all four run in-process. No network calls on the hot path. That's why adding 10 milliseconds won't blow up under load. There's no dependency to time out on."
- "Next slide — the mobile half."
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
- "Now it is mobile — let me talk about the component registry."
- "The component registry is a locked map: component name to a native renderer view."
- "About 10 to 15 entries, governed by a review board to keep it under control."
- "Both iOS and Android codegen this from one shared schema — so they cannot drift. That directly addresses the complexity concern mobile raised."
- "Whenever the server sends data containing the components and the data slices, the mobile app looks each one up in the registry and renders it natively with the matching data."
- "If a component name is unknown, the app silently skips it — so the server can ship ahead of the app."
- "[slow, the killer line]"
- "Server sends data. Mobile ships code. Two teams, one contract."
- "[transition]"
- "Now let me show you what the contract actually looks like."
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

- Same delivery, **different layout per market** (PL / UK / CA)
- Layout is embedded per offer (cheap; memoized by variant/zone/tier)

<!--
SAY:
- "Here's what the contract looks like."
- "Three blocks in the JSON:"
- "  experiment — tracks which variant the courier saw (for the A/B test reporting)."
- "  layout — which components, in what order (the server's call)."
- "  data — the actual values the components render."
- "Same delivery can go out with a different layout per market — Poland, UK, Canada — all from config."
- "Unknown components are silently skipped — older apps stay safe."
- "[transition]"
- "And this isn't just on paper — let me show you a running version."
-->

---

## ▶ Live POC — Hybrid SDUI (I built this)

🌐 **Live: <https://offer.gummui.com>** — runnable, on AWS, with TLS

![w:600](img/demo-client.png)

- **<https://offer.gummui.com/admin>** — change layout → save → green toast (no deploy)
- **<https://offer.gummui.com/client>** — offer **pushed** down via SSE, sticky hash per courier
- **<https://offer.gummui.com/approaches>** ← **A vs B vs C payloads on the wire** (the data difference)
- Server-driven layout · sticky A/B (inspector: bucket 95 → control) · SSE push · React + Express

<!--
SAY:
- "This isn't just on paper — I built a running prototype, deployed on AWS at offer.gummui.com."
- "[switch to /admin]"
- "First, /admin. I change the layout and hit save. Green toast — live, no deploy, no app release."
- "[switch to /client]"
- "Then /client — the offer is pushed down a stream. The same courier always resolves to the same variant via sticky hash."
- "[switch to /approaches]"
- "And finally /approaches — this shows all three approaches side by side, on the wire."
- "A sends finished strings — like '$11.76' already rendered. The app is just a painter."
- "B sends raw data plus flags — mobile owns all the presentation logic."
- "C sends layout plus data — server decides what and order, mobile decides how."
- "[back to slides]"
- "This is the hands-on, fail-fast piece — I'd rather show a small running thing than just describe it."
- 🔴 兜底:如果线上挂了,这页有截图;本地 localhost:5173 也跑着。
-->

---

## Technical Leadership

> *Mobile is worried Approach B/C increases their complexity. How do you facilitate?*

**Principle: validate the concern, then sharpen it.** (not *whether* — *how much, what kind, what's on the other side*)

1. Acknowledge in writing → us-vs-problem
2. Working session, sharpen "complexity" → **bounded mitigations** (locked registry, codegen, forward-compat, co-owned RFC)
3. Propose a **small reversible proof, mobile-led** (1 zone, 1 component, 4 weeks) — *fail fast*; pre-state escalation in the [ADR](https://github.com/tonyQihuanYang/offer-master/blob/main/adr/ADR-001-hybrid-sdui.en.md) (status: *Proposed*)

This is **influence, not authority**.

<!--
SAY:
- "Now the leadership question. Mobile is worried that C adds complexity for them. Honestly — they're right to worry."
- "But here's what I won't do — I won't walk in with a prepared answer."
- "Different mobile teams worry about different things. Is it testing? Hand-parsing? Code review load? iOS and Android drifting? Each one has a different mitigation."
- "So my principle is: first I agree the concern is real, then I let them make it specific."
- "Three steps."
- "Step one — I acknowledge it in writing first. That frames it as us vs the problem, not me vs them."
- "Step two — a working session, not a presentation. Mobile tells me what 'complexity' actually means to them, in their own words. Based on what they say, I bring concrete mitigations. For example:"
- "  if it's hand-parsing — codegen from a shared schema solves it."
- "  if it's the registry growing — we lock it at 10 to 15 components."
- "  if it's iOS and Android drift — the same codegen makes them byte-identical."
- "  if it's 'we won't have a voice in this' — we co-author the RFC."
- "Step three — instead of a vote, a small POC the mobile team leads. One zone, one component, four weeks. Easy to undo."
- "And I say upfront how we'd escalate if we still disagree. So nobody feels trapped."
- "This is influence, not authority."
-->

---

## Leadership — the posture

> **"My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision."**

<!-- _class: lead -->

<!--
SAY (memorize, slow, firm):
- "My job isn't to win the architecture argument."
- "It's to make the team that ships and maintains this a co-author of the decision."
- 🎯 这是 Senior / Staff 的分水岭金句。慢下来。看面试官眼睛。
-->

---

## Migration & Metrics

**4 phases, every step reversible:**
Foundation (no-op) → Dual payload (`data` + `data_v2`) → Flag rollout (1→5→25→50→100% per city) → Experiment live

| Class | Metric | Target |
|---|---|---|
| SLA | p95 / p99 | ≤200 / ≤300 ms |
| Business (per variant) | acceptance / time-to-accept / **complaints** | no regression |
| Experiment | assignment consistency / flag fallback | 100% / <1% |
| Migration | % on v2 / field parity | tracked / 100% |

**Rollback:** feature-flag instant-off + dual-write → mobile always falls back to `data`.

<!--
SAY:
- "Migration is reversible at every step — four phases, each one you can undo in seconds."
- "We start with a no-op foundation, where the new pipeline runs but doesn't change anything for the user. We verify it in shadow mode."
- "Then we move to dual payloads — old and new run side by side. Mobile still reads the old one."
- "Next, we ramp the flag from 1% up to 100% per city, using the sticky hash so no courier ever flips."
- "And finally, experiments go live."
- "For metrics, four areas to watch: latency at p95 and p99; business numbers per variant — acceptance, time to accept, complaint rate; experiment health — assignment consistency and flag fallback; and migration progress — percent on the new payload, plus field parity."
- "And the principle — any step rolls back in seconds. Because the old field is always on the wire, mobile can fall back instantly."
-->

---

## Use Case 1 — summary

> *"I recommend the hybrid (C): server controls layout + experiments, mobile renders natively. It buys experiment velocity **and** native UX within 200 ms / 2M-per-hour, builds on the existing event-driven system, and migrates with instant rollback — and the real Staff work is making mobile a **co-author** of the decision."*

<!-- _class: lead -->

<!--
SAY:
- "To summarize Use Case 1 — I recommend the hybrid."
- "The server controls layout and experiments. The mobile app renders natively."
- "It gives us experiment speed and native UX, inside the 200ms / 2-million-per-hour budget."
- "It builds on the existing event-driven system, and it migrates with instant rollback."
- "And the real Staff work — making mobile a co-author of the decision."
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
- Sprint review in **3 days, nothing to demo** · low motivation · PM escalating

**Principle: the crisis is the deadline, not the architecture.**
Don't charge in and rewrite it — buy time, narrow scope, coach, let them ship something they understand.

> Role: guide **without doing the work for them**, working **with** the Tech Manager — not replacing them.

<!--
SAY:
- "So — here's the situation."
- "Four engineers. Kafka and Flink."
- "Latency is 45 seconds against a 5-second target."
- "Scope crept from 3 patterns to 12."
- "Nothing to demo in 3 days. Low motivation. PM is escalating."
- "[slow, the principle]"
- "My core principle here — the crisis is the deadline, not the architecture."
- "The common Staff mistake is to charge in, rewrite, and 'save' the sprint. That solves the demo but breaks the team."
- "The right move is to buy time, narrow scope, coach. Let them ship something they understand."
- "And the engineer who wants to start over with something simpler — they might be right. I'd take that seriously."
-->

---

## Staff vs Tech Manager — draw the line first

| Area | TM owns | Staff owns |
|---|---|---|
| Sprint scope · deadlines · PM negotiation | ✓ | technical framing |
| Individual performance · motivation | ✓ | surface tech causes |
| Architecture · testing · RFCs · mentorship | | ✓ |
| Sprint-review narrative · escalation | shared | shared |

**First 30 min = a 1:1 with the TM** to draw exactly this line.

<!--
SAY:
- "Before anything else, I draw the line with the TM. The prompt says clearly — I work with them, not as them."
- "So my first 30 minutes is a 1:1. I listen first — how they see the team, what's going on with the PM, what's their read on the situation."
- "Then I propose the split. The TM owns scope, deadlines, the PM, and motivation. I own architecture, testing, RFCs, and mentorship. Review story and escalation — we share."
- "The trap I'd avoid is stepping into their job. Even if I'm right on the technical call, going around the TM undermines them. So I don't."
-->

---

## 1 · Diagnose — ask, don't lead

- **Architecture:** "Walk the data flow on a whiteboard." "Where are the 45s spent — measured or inferred?" "Sync I/O in operators? parallelism? watermarks?"
- **Scope — audit the 12 first:** dupes? subsets? data-unavailable? mergeable? *Often "12" collapses to 4–5 distinct patterns.* Then: "which do stakeholders actually want this quarter?"
- **Data quality:** "What % of events miss location — null / stale / missing entirely?"
- **Testing:** "Show me how you test one rule end-to-end."
- **Tool fit:** Is what we have sized right for the actual event rate? *Once data is in hand: range may straddle overkill vs justified — measure first, then right-size.*

<!--
SAY:
- "Diagnosis — I ask questions, I don't feed the answer."
- "Five areas I'd cover, a few questions at a time:"
- "  Architecture — where are the 45 seconds actually going?"
- "  Scope — audit the 12 first; usually it collapses to 4 or 5 real ones."
- "  Data quality — how many events miss the location field?"
- "  Testing — show me one rule tested end-to-end."
- "  Tool fit — is what we have sized right for the actual event rate?"
- "I ask a few at a time, not 30 at once. The questions are the coaching."
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
- "The key move here is to cut scope hard."
- "We'd ship one pattern — the simplest one. If a courier marks a delivery as complete but they're more than 500 meters from where the customer actually is, that's a flag. The data is already in the events, and the math is just a distance check."
- "But cutting scope alone isn't the fix — we also dig into what's actually slow, in parallel."
- "So Day 1 — I sit down with the TM. Two audits happen at the same time:"
- "  what's actually slow,"
- "  and what are the 12 patterns really. Usually 12 collapses to 4 or 5."
- "Then we lock scope with the PM, in writing."
- "Day 2 — pair with engineers. Build the working version. Draft the honest story for the review."
- "Day 3 — dry run. The team presents. The TM and I brief the director ahead."
- "At the review, I sit in the audience. The team gets the credit."
- "No half-working live demo. Only what's solid."
-->

---

## 3 · Guide without solving

- Pair, don't solve · whiteboard principles, not fixes · code-review **in questions**
- They write the RFC, you comment · bring a Principal for a second opinion (they present)

**Worked example — the 45s latency:**
- ❌ Senior: *"It's backpressure — add async I/O, double parallelism."*
- ✅ Staff: *"What's the latency breakdown? → what does the metric say? → how do we confirm? → run it — what would the result tell us?"*

Same destination — the Staff version teaches the **debugging method**.

<!--
SAY:
- "Now — how I actually guide without taking over."
- "I pair with them, but they drive the keyboard. I whiteboard the principles, not the fixes. And when I review code, my comments are questions, not instructions — for example, instead of 'add a null check here,' I'd ask 'what happens if this is null?'"
- "Let me make that concrete with an example."
- "Say the team tells me, 'latency is 45 seconds.' A Senior engineer might jump to the answer: 'it's backpressure, add async I/O, double the parallelism.' I'd hold back and ask, 'where is the time actually going? what does the metric say? how would we confirm?'"
- "Same fix in the end. But the second way, they learn how to find it themselves."
-->

---

## 4 · Long-term — knowledge transfer (30/60/90)

| Window | Activity |
|---|---|
| **30 days** | streaming study group (2h/wk) · external expert sessions · architecture office hours |
| **60 days** | each builds a Flink toy project · team writes the v2 RFC · read another team's real job |
| **90 days** | each *teaches* one concept (watermarks, backpressure…) · name a streaming expert · pair with an experienced team |


<!--
SAY:
- "Longer term — this is what prevents the next 3-day crisis."
- "I'd put together a learning plan around 30, 60, and 90 days."
- "In the first 30 days, the team learns the fundamentals — a study group meeting weekly, some external experts brought in, and I run architecture office hours."
- "By 60 days, they start building. Each engineer builds a small Flink project, and the team writes a v2 RFC for the architecture."
- "By 90 days, they teach. Each engineer picks one concept — like watermarks or backpressure — and presents it back to the team. Because teaching is when they really own it."
-->

---

## 5 · Work with TM / Principals / Leadership

- **TM (peer):** daily 15-min during crunch; architecture runs through me, scope is theirs, individual feedback is theirs — **never go around the TM**
- **Principals:** early second opinions + pattern-matching; a resource, not political backup
- **Leadership:** get ahead of the escalation — **brief jointly with the TM**:

> *"Quick update. We took on 12 patterns this sprint — too many. We've cut to one that ships. Over the next 30 days, we evaluate the architecture with data. Could you help with the PM?"*

<!--
SAY:
- "Three lanes to manage carefully."
- "With the TM — a daily 15-minute check-in during the crunch. Architecture comes through me. Scope stays with them. I never go around them to the engineers."
- "With the Principals — I pull them in early for a second opinion. They've usually seen these problems in other teams, so they spot patterns I'd miss. But not to do the work for me — that takes ownership away from the team. And not as backup over my TM — that would undermine her."
- "With leadership — I get ahead of the escalation. If the PM gets to them first, I'm on defense. If I brief them first with the TM, I set the agenda — and leadership hates being surprised. Doing it together with the TM makes sure both views are heard, and her authority stays intact. Something like this:"
- "  'Quick update. We took on 12 patterns this sprint — too many. We've cut to one that ships. Over the next 30 days, we evaluate the architecture with data. Could you help with the PM?'"
- "And if the 'start over' engineer turns out to be right — I praise them publicly, frame the Flink work as not wasted, and own the lesson myself."
-->

---

## Use Case 2 — the posture

> **"My role is to make the team better at this — not to do the work for them. The 3-day deadline is a constraint to navigate, not a performance to deliver.**
> **If I do my job right, this team handles the next streaming project without me having to come back."**

<!-- _class: lead -->

<!--
SAY (memorize — slow, eye contact, integrated:

"My role is to make the team better at this —
not to do the work for them.

The 3-day deadline is a constraint to navigate,
not a performance to deliver.

If I do my job right, this team handles the next streaming project
without me having to come back."

🎯 整段一气念,中间两次自然停顿。看面试官眼睛。
这是 UC2 的金句。
-->

---

## Closing — two postures, one standard

- **UC1** — a **hybrid (C) design**, *and* the mobile team as **co-author** of it
  *"I'd rather ship B fully bought-in than C quietly unhappy."*
- **UC2** — a **data-driven diagnosis**, *and* **leverage over time, not heroics**
  *"No need to come back next time."*

Both answered the same way:
**hard technical calls + bringing the team along · influence, not authority · fail fast · hands-on POCs**

<!-- _class: lead -->

<!--
SAY (closing — read off the slide, slow, eye contact, bookend to opening):

"To close — two postures, one standard.

For UC1, the work was a hybrid design — and making mobile a co-author of it.
For UC2, the work was using data to diagnose the problem — and making the team stronger over time, not me saving the day.

Both answered the same way:
hard technical calls plus bringing the team along.

Influence, not authority. Fail fast. Hands-on POCs.

That's my read on Staff — and what this role calls for."

🎯 收口呼应开场。最后一段慢说,看面试官眼睛。然后翻 Slide 26 (Questions),说 "Thank you."
-->

---

## Questions

**Happy to take questions. Anything we don't get to lives here:**

- 📋 **[Q&A board](https://github.com/tonyQihuanYang/offer-master/blob/main/Q%26A.md)** — 25 anticipated questions with prepared answers
- 📐 **[ADR-001](https://github.com/tonyQihuanYang/offer-master/blob/main/adr/ADR-001-hybrid-sdui.en.md)** — the hybrid SDUI decision record
- 📐 **[RFC skeleton (UC2)](https://github.com/tonyQihuanYang/offer-master/blob/main/adr/RFC-skeleton-fraud-detection.en.md)** — fraud detection RFC
- 🌐 **[Live POC](https://offer.gummui.com)** — the running prototype

**Thank you.**

<!-- _class: lead -->

<!--
SAY:
- "Thank you. Happy to take questions."
- "Anything we don't get to is linked here — the Q&A board has the questions I anticipated with prepared answers, plus the ADR, the RFC, and the running prototype."
- "Where would you like to start?"
- 🎯 这页留在屏幕上做 Q&A 看板。面试官点链接就能看准备好的材料。
-->
