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
  pre code { background: transparent; color: #d7e0f2; }
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

Staff Engineer — Courier Offer & Rewards
**Tony (Qihuan Yang)**

<!--
Opening (say this in ~30s):
- ~32 min on UC1, ~22 min on UC2, a few minutes for Q&A.
- My read on Staff: drive decisions through INFLUENCE, NOT AUTHORITY; be hands-on — POCs, fail fast.
- I'll answer both cases to that standard. I also built a runnable prototype to validate the UC1 design.
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
Spine: UC1 proves I can do architecture + technical decisions; UC2 proves I can multiply a team, not do the work for them.
Showing I manage time is itself a Staff signal.
-->

---

# Use Case 1

## Courier Offering System Modernization

<!-- _class: lead -->

---

## Problem & Constraints

- 15 countries · 50,000+ couriers · **2M offers/hour** peak (~556 RPS)
- SLA **200 ms p95** — today ~180 ms → only **~20 ms real headroom**
- Needs: A/B presentation · personalized earnings · gradual rollout · multiple earning models

**Today:** one hardcoded `Offer.java`, earnings logic across 3 services, every change = full multi-region deploy, **zero experimentation**

> Already an **event-driven, distributed** system (SQS + Temporal + AppSync on AWS), already pushing structured JSON to mobile → my answer is **evolution, not rewrite**.

<!--
Nail the constraints, especially the 20ms headroom — every later choice lives inside it.
The pain is RIGIDITY, not performance: nothing can change or be tested.
The last line sets up recommending C, and hits the JD's event-driven / distributed systems.
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
Put up only the two the prompt gives (A/B), expose each one's fatal flaw — A trades away UX+latency, B trades away experiment speed+consistency.
Don't jump to the answer; this sets up the reveal of C on the next slide.
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
This is the reveal — "the prompt framed it as A or B, but the answer is C." Recommend C clearly: from A take "experiment without release", from B take "native UX".
Be honest about the cost. Transition: "now that we've picked C, here's how it's built."
-->

---

## System Design — Hybrid (Approach C)

**Server decides _what + order_; mobile decides _how_.**

4 new in-process components, after Temporal returns pay + bonus:

![w:1080](img/system-design-flow.png)

- Each component carries a **latency budget + a failure mode** — fail-closed · dual-write · idempotency · cache-independent sticky hash. *That's the distributed-systems design, not just impl.*

**+10ms — and it won't tail-spin:** in-process + cached (no hot-path network I/O); flag/config outage → **fail-closed**. If measured latency nears budget → move resolution off the request path (precompute).

<!--
(Continuing: we picked C, here's how it lands.)
p95 isn't simple addition — preempt the tail-latency probe: zero hot-path I/O + fail-closed means a dependency hiccup can't blow the SLA.
Walk each component with a latency budget + a failure mode: fail-closed, dual-write, idempotency, cache-independent sticky hash — sell these as "distributed-systems design".
Show the demo / recording here: a runnable POC validating the boundary + sticky bucketing + SSE push.
-->

---

## Latency Budget — estimate, then measure

| Component | Hot path (real) | Budget (ceiling) |
|---|---|---|
| Experiment Resolver | sub-ms — hash + cached lookup | ~3 ms |
| Earnings Calculator | sub-ms — arithmetic (data prefetched) | ~3 ms |
| Layout Composer | sub-ms — in-memory config | ~2 ms |
| Payload Builder | ~0.1–1 ms — build + JSON | ~2 ms |
| **Total added** | **~1–3 ms** | **~10 ms** |

- **Budgets carved from the ~20ms headroom — not measurements.** Hot path is in-memory; the budget absorbs cache-miss / GC / serialization.
- For scale: **Temporal pay+bonus ~150ms dominates** — these four are a rounding error.
- **Before rollout: load-test on a real cluster → replace with measured p95.** If Δ > 15ms → push experiment/layout off the request path.

<!--
If asked "how did you get 3ms/10ms?", this is the slide: they're budgets, not measurements — hot path is sub-ms in-memory, the budget absorbs cache-miss/GC. I'd measure on a real cluster before rollout; if it creeps past budget, move resolution off the request path. Don't pretend you measured it.
(Skim in ~30s in the main flow; expand only if probed.)
-->

---

## The Payload Contract

```json
{
  "experiment": { "earnings_display": { "variant": "breakdown_v2", "group": "treatment" } },
  "layout": { "components": ["earnings_breakdown", "surge_indicator", "accept_cta"],
              "hints": { "highlight_field": "surge" } },
  "data": { "earnings_breakdown": { "model": "surge", "total": 730, "currency": "CAD" } }
}
```

- Same delivery, **different layout per market** (CH / UK / CA)
- Layout is embedded per offer (cheap; memoized by variant/zone/tier)

<!--
Grounds the abstract architecture in a concrete payload — seeing the JSON makes the panel trust you've thought it through.
Stress the registry is bounded (~10–15) — the hook for "bounded complexity" in the leadership section.
-->

---

## ▶ Live POC — Hybrid SDUI (I built this)

![w:600](img/demo-client.png)

- Server-driven layout · **sticky A/B** (inspector: bucket 95 → control) · **SSE push** · runnable (React + Express)
- **▶ LIVE:** `/admin` change layout → save → live · `/client` offer pushed · `/approaches` A vs B vs C side-by-side

<!--
🔴 This IS the JD's hands-on POC / fail fast — don't just say "I built a demo", switch to the running demo and click through it.
Live order: /admin change layout → Save → green toast; /client click Dispatch → offer pushed to the phone; /approaches see the three A/B/C payloads.
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
⚠️ Behavioral question, not technical. It separates Staff (drives a cross-team decision) from Senior (sells the "right answer").
Anti-pattern: pre-writing the decision and walking it in for rubber-stamping — mobile sees through it, trust collapses.
The prototype is mobile-led — removes the "you're forcing this on us" frame.
-->

---

## The closing posture

> **"My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision.**
> **I'd advocate C, but I'd rather ship B with mobile fully bought in than ship C with mobile compliant but quietly resentful."**

<!-- _class: lead -->

<!--
Memorize this; say it at the end of the leadership section. It's the Senior/Staff watershed — influence over authority made concrete.
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
Stress guardrail metrics: not just whether acceptance went up — watch dispute/crash/latency for REGRESSIONS.
Read business metrics PER VARIANT, otherwise the A/B is meaningless.
-->

---

## Use Case 1 — in one line

> *"I recommend the hybrid (C): server controls layout + experiments, mobile renders natively. It buys experiment velocity **and** native UX within 200 ms / 2M-per-hour, evolves the existing event-driven system, and migrates with instant rollback — and the real Staff work is making mobile a **co-author** of the decision."*

<!-- _class: lead -->

---

# Use Case 2

## Real-time Fraud Detection — Team Guidance

<!-- _class: lead -->

---

## The Situation

- 4 engineers (2–3 yrs), Kafka + Flink fraud detection
- **45s latency** vs <5s target · scope crept **3 → 12 patterns**
- Sprint review in **3 days, nothing to demo** · low morale · PM escalating

**Principle: the crisis is the deadline, not the architecture.**
Don't parachute in and rewrite it — buy time, narrow scope, coach, let them ship something they understand.

> Role: guide **without doing the work for them**, working **with** the Tech Manager — not replacing them.

<!--
Most common Staff failure: charge in, rewrite the architecture to "save" the sprint — solves the demo, breaks the team.
Second principle: the engineer who wants to "start over with a simpler approach" might be right — take it seriously.
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
The prompt says "you're not the TM, you work with the TM." Traps: negotiating with the PM yourself, unilaterally cutting scope, using the TM's authority without coordinating.
-->

---

## 1 · Diagnose — ask, don't lead

- **Architecture:** "Walk the data flow on a whiteboard." "Where are the 45s spent — measured or inferred?" "Sync I/O in operators? parallelism? watermarks?"
- **🔑 The big one:** "Is Flink even right for our event rate?" — **UC2 gives no number**. Delivery events ≈ **~20/sec**; *with GPS pings* likely **~1k–3k/sec** (UC1's 2M/hr ≈ 556/sec confirms hundreds/sec). Range straddles overkill vs justified → **measure first, then right-size.**
- **Scope:** "Which 3 of the 12 do stakeholders want *this quarter*?"
- **Data quality:** "What % of events miss location — null / stale / missing entirely?"
- **Testing:** "Show me how you test one rule end-to-end."

<!--
Ask in waves, don't fire all 30 at once. Key: diagnose with real streaming concepts to show depth FIRST, then land the right-sizing conclusion.
Don't let "Flink is overkill" be the opener — it reads as dodging streaming.
-->

---

## 2 · The 3-day plan — ruthlessly descope

**Load-bearing move:** ship **one** pattern that tells the story —
*"marked complete >500m from destination"* (data's already there, just a distance calc, <5s with or without Flink).

- **Day 1:** TM 1:1 (RACI) · architecture walk-through — **audit Flink telemetry** (bad watermarks? sync I/O in an operator?) · **scope-lock with PM in writing** (1 pattern, 11 deferred) · pair (they drive)
- **Day 2:** pair to a working skeleton · first test fixture · draft an honest review narrative
- **Day 3:** dry run (they present) · **pre-brief the Director with the TM** · schedule a post-demo retro

Avoid a half-working live demo that fails. **The team presents and gets the credit.**

<!--
Load-bearing line: the team's problem isn't building 12 — it's trying to ship 12 when 1 tells the story.
Descope is PM-confirmed in writing + leadership pre-briefed — never let the team face a hostile escalation alone.
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
Calibration: neither write it for them, nor stubbornly refuse to give answers. Withholding facts isn't coaching.
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
This prevents the next 3-day crisis. Without it, I'm back in this room in two months.
Teaching is the highest form of learning — at 90 days, having them teach it means they own it.
-->

---

## 5 · Work with TM / Principals / Leadership

- **TM (peer):** daily 15-min during crunch; architecture runs through me, scope is theirs, individual feedback is theirs — **never go around the TM**
- **Principals:** early second opinions + pattern-matching; a resource, not political backup
- **Leadership:** get ahead of the escalation — **brief jointly with the TM**:

> *"The team picked Flink for a workload well below its design point at the rate we measured. We've descoped to one pattern; we'll formally evaluate the architecture over 30 days. We'd like your air cover with the PM."*

<!--
If the "start over" engineer was right: praise them publicly, frame the Flink work as not wasted (it surfaced data-quality/scope/real-event-rate), own the lesson.
Good leadership brief: honest about what went wrong (engineering judgment, not blame) + timeline + a specific ask (air cover) + TM and Staff together.
-->

---

## Use Case 2 — the posture

> **"My role is to make the team better at this — not to do the work for them. The 3-day deadline is a constraint to navigate, not a performance to deliver.**
> **If I do my job right, this team handles the next streaming project without a Staff parachute."**

<!-- _class: lead -->

<!--
Staff = leverage over time, not heroics in the moment.
-->

---

## Closing — two postures, one standard

- **UC1 (leadership):** make the team that ships it a **co-author** — *"I'd rather ship B fully bought-in than C quietly resentful."*
- **UC2 (guidance):** **leverage over time, not heroics** — *"no Staff parachute next time."*

Both answered the same way:
**influence, not authority · fail fast · hands-on POCs** — exactly what the role calls for.

**Thank you — happy to go deeper on any part (a running POC included).**

<!-- _class: lead -->

<!--
The influence / fail-fast planted in the opening close the loop here (a bookend). Then open Q&A:
"I've got deeper detail on both — architecture, migration, component governance, streaming diagnostics, plus a runnable POC — happy to go in any direction."
-->
