# Staff Engineer Interview — Presentation Outline (1 hour)

> 中文版本：[`../study-notes/presentation-outline.md`](../study-notes/presentation-outline.md)
> 🗣️ Verbatim talk track (for speaking practice): [`presentation-script.md`](./presentation-script.md)
>
> A **one-hour talk outline** that integrates all the prep material.
> Each slide gives: **title** (ready for PPT) + **bullets** (what's on the slide) + **speaker notes** + **time**.
> Goal: cover both Use Cases in 1 hour, hitting all 9 assessment areas from the PDF (UC1's 4 + UC2's 5).

---

## Time budget (memorize this table)

| Segment | Content | Time | Cumulative |
|---------|---------|------|------------|
| Open | Title + Agenda | 2 min | 2 |
| **UC1** | Problem + current state | 5 min | 7 |
| **UC1** | Technical decision A vs B vs C (evaluate + recommend + why) | 6 min | 13 |
| **UC1** | System design (target architecture for C) | 9 min | 22 |
| **UC1** | Latency & scale | 3 min | 25 |
| **UC1** | Technical leadership (mobile team) | 5 min | 30 |
| **UC1** | Migration strategy + metrics | 4 min | 34 |
| **UC2** | Situation + core principle | 3 min | 37 |
| **UC2** | Staff vs TM boundary (RACI) | 3 min | 40 |
| **UC2** | Diagnostic questions | 4 min | 44 |
| **UC2** | 3-day action plan | 5 min | 49 |
| **UC2** | Guidance technique (don't do it for them) | 3 min | 52 |
| **UC2** | Long-term knowledge transfer | 2 min | 54 |
| **UC2** | Working with TM / Principals / Leadership | 3 min | 57 |
| Close | Two closing lines + Q&A | 3 min | 60 |

> ⏱️ **Time discipline**: the prompt gives a **full hour** (don't compress to 45–50 — that's a different format). Plan ~30 min UC1 + ~20 min UC2, but **don't script a 54-min monologue — invite questions throughout and treat it as a conversation**; the per-segment minutes below are ceilings, not a fixed read.
> If you run over: in UC1 cut the latency detail first; in UC2 cut the long-term-KT detail first — but *touch* every assessment area, never skip a whole one.

---

## The narrative spine (one line)

> **UC1 proves I can do architecture + technical decisions; UC2 proves I can multiply a team rather than do the work for them.**
> Both cases test two sides of one thing: **Staff = produce the right technical answer *and* get others to accept and maintain it.**

## ⭐ JD keywords (hit these verbatim while you talk)

The job description (`job-description.md`) literally spells out what the panel cares about. Both cases are designed around these — so land them on purpose:

| JD keyword | Where to hit it |
|------------|-----------------|
| **"influence, not authority"** | 🔴 the spine: open with it + UC1 leadership close + UC2 close — **say the phrase explicitly** |
| **"fail fast" / hands-on POCs / rapid prototypes** | 🔴 show the runnable `demo/` as a POC; tag UC1's "proof not vote" and UC2's "ship 1 pattern in 3 days" as fail-fast |
| **event-driven architecture & distributed systems** | UC1 system-design slide: **name it** event-driven; sell fail-closed / dual-write / idempotency / sticky hash as distributed-systems design |
| **big data & near real-time data processing** | UC2: **diagnose with real streaming concepts (watermark/backpressure/parallelism/checkpoint) to prove depth, then land the right-sizing conclusion** |
| lead / coach / develop (~55-person area) | UC2 30/60/90 knowledge transfer + force-multiplier close |
| cloud (AWS) | UC1: name AWS — SQS / AppSync / Temporal |
| third-party integration planning | UC1: a line on external services (Data Science pricing / Courier Pay / Bonus) + timeouts/retries |

> The role is in **Canada** → prefer the CA (Calgary) market for UC1 examples.

---

# Opening (2 min)

## Slide 0 — Title & Agenda

**On the slide:**
- Courier Offering System Modernization (Use Case 1)
- Team Guidance: Real-time Fraud Detection (Use Case 2)
- Agenda: Decision → System Design → Leadership → Migration ‖ Diagnose → Guide → Recover → Grow

**Speaker notes:**
- Set the pace in one line: "I'll spend ~32 min on UC1, ~22 on UC2, and leave a few minutes for Q&A."
- State the spine: "To me these test the two sides of Staff — technical judgment, and organizational leverage."
- 🔴 **Plant the JD keywords in the first sentence**: "My read on Staff is — drive technical decisions through **influence, not authority**, and be **hands-on: POCs, fail fast**. I'll answer both cases to that standard." → the panel hears their own JD words in minute one.
- Showing you **manage time** is itself a Staff signal.

---

# Use Case 1: Courier Offering System Modernization

## Slide 1 — Problem & Constraints (problem + current state, first half of the 5 min)

**Bullets:**
- 15 countries · 50,000+ couriers · 2M offers/hour peak (~556 RPS sustained, ~1500 peak)
- SLA: 200ms p95 (today ~180ms → **only ~20ms real headroom**)
- 4 business needs: A/B test presentation · personalized earnings · gradual rollout · multiple earning models
- Today: **one hardcoded `Offer.java` template** (329 lines), earnings logic scattered across 3 services, every change = full multi-region deploy, **zero experimentation**

**Speaker notes:**
- Nail the constraints, especially the **20ms headroom** — every later design choice has to "live inside that 20ms." It's the panel's most likely probe.
- Frame the pain as **rigidity**: "It's not that performance is bad — it's that nothing can change or be tested. Any presentation change needs a full regional deploy."
- Read out the 4 business needs and tell the panel "my architecture will map to these one by one."

## Slide 2 — Current Architecture (second half of the 5 min)

**Bullets (draw/paste the current flow):**
- `Courier Management → courier_offer_service → delco_orchestrator (Temporal) → courier_mobile_async_service → AppSync (WebSocket) → Mobile`
- Pay/bonus assembled by a 5-step Temporal workflow (pricing → pay → bonus → publish)
- Mobile renders a **fixed** offer card — no variant field, no feature flag

**Speaker notes:**
- The key insight, in one line: "The system **already pushes structured JSON to mobile** — so the hybrid approach is an evolution, not a rewrite." This sets up recommending C.
- Don't dwell on current state — ~1.5 min, just to motivate "where we need to change."

---

## Slide 3 — Technical Decision: A vs B (compare only the two the prompt gives) (~3 min)

**Bullets (show only the A vs B comparison, expose each one's fatal flaw):**

| Dimension | A (Template DSL) | B (Raw + Mobile) |
|-----------|------------------|------------------|
| Experiment speed | fast (server-side) | **slow (app release per change)** |
| 200ms risk @ 2M/h | **high (server renders)** | low |
| Native UX | **poor** | excellent |
| iOS/Android consistency | guaranteed | **hard** |
| Mobile complexity | lowest | **highest** |

- **Neither alone wins:** A buys experiment speed but gives up native UX *and* threatens the 200ms SLA; B keeps native UX but every layout experiment needs an app release.

**Speaker notes:**
- 🔴 **Put up only A/B first** (the two the prompt gives), explain each one's fatal flaw — don't jump to the answer yet, this sets up the reveal of C.
- The essence of A vs B: where does presentation logic live — A server-side (sends strings), B on mobile (sends raw data).
- The "$9.76 includes tip" example: A changes copy via a backend deploy; B formats on mobile but layout variants still need a release.

---

## Slide 3b — Introduce Approach C (synthesis + recommendation) (~3 min, ⭐ the reveal)

**Bullets (C = best of both):**

| Dimension | **C (Hybrid) ✅** |
|-----------|-------------------|
| Experiment speed | fast (layout, no release) / slow (new components only) |
| 200ms risk | low |
| Native UX | excellent |
| Consistency | enforced by a shared component contract |

- **From A:** server controls *what + order* → experiment without an app release; **from B:** mobile renders natively → great UX
- One line: **server decides what + order; mobile decides how** (component registry)
- **The one real B-vs-C difference** (most likely probe): "which components & in what order" is *app logic on mobile* in B but *data from the server* in C → **C = B + a server-controlled layout descriptor + experiment assignment moved server-side**
- Honest cost: upfront contract + component governance; changing an existing component's schema still needs a release / dual-emit

**Speaker notes:**
- This slide is the **reveal** — "the prompt framed it as A or B, but the answer is C." Proactively proposing C is a plus.
- Use industry references sparingly: Airbnb / Uber / Lyft / Grab are all hybrid (they support the argument, they don't replace it).
- Transition to the next slide: "**Now that we've picked C, here's how it's built.**"
- 🎒 **Deep reserve ammo (bring out only when asked — don't volunteer all of it; the main line is enough):**
  - "How is A really different from C?" → ① string on the wire vs raw value (A's client can only style the box — no count-up animation, locale re-format, value-conditional styling, or long-press base+tip breakdown) ② compute: A formats + i18n on the latency path, centralized; C pushes it to 50k phones (free / parallel / native). See the A-vs-Hybrid Q&A in `approach-evaluation.md`; in the demo, expand `/approaches` → "What's on the wire" to *show* it.
  - "How is B different from C?" → who owns layout: B on mobile (flag-driven app logic), C on the server (sends layout data). C = B + a server layout descriptor + experiment moved server-side. See the B-vs-Hybrid Q&A.
  - "What about old apps that don't upgrade?" → `app-version-compatibility.md` (add component/field = safe; change semantics = new component v2; remove field kept until min version; unknown components skipped).

---

## Slide 4 — System Design: Target Architecture (Hybrid) (9 min, ⭐ core)

**Bullets (draw the target architecture, 4 new components):**
1. **Experiment Resolver** — assigns variant by courierId/city/tier/zone; Caffeine cache 60s TTL; **deterministic stickiness** `hash(courierId+experimentId) % 100 vs treatment_pct`; flag service down → **fail-closed to control**; budget ~3ms
2. **Layout Composer** — emits `components[]` + `hints{}`; JSON config, 30s polled refresh, falls back to a bundled default on startup failure; budget ~2ms
3. **Unified Earnings Calculator** — unifies flat / distance / surge / tips_prediction (data already fetched by Temporal, compute only); budget <10ms
4. **Offer Payload Builder** — replaces `Offer.java`; version-branched output (old apps → legacy, new apps → modular)

**Speaker notes:**
- (Continuing from the prior slide: we picked C, here's how it lands.) This is where UC1 earns points. **Lead with the boundary line: "server decides what + order; mobile decides how."**
- 🔴 **Name the JD keywords up front**: "The current system is an **event-driven, distributed** architecture (SQS + Temporal + AppSync over AWS) — my design is incremental on that event chain, not a rewrite." Explicitly tag it as the JD's *event-driven architecture & distributed systems*.
- Walk each component, but attach a **latency budget** and a **failure mode** to each — Staff doesn't just draw boxes, it answers "what happens when it fails" and "does it fit the 20ms." Sell the failure modes (fail-closed fallback, dual-write, idempotency, cache-independent sticky hash) **as distributed-systems design**, not just implementation detail.
- Emphasize sticky assignment (a common probe): "Same courier always lands in the same variant, because it's a deterministic hash of courierId — no cache dependency, so eviction never flips a courier."
- 🟢 **third-party integration (JD point)**: a line on external-service integration — call boundaries to Data Science pricing / Courier Pay / Bonus, timeouts & retries (Temporal 1.5s signal + REST 2s/3 retries), and "bonus failure degrades gracefully" as a fault-tolerance choice.
- 🔴🔴 **Show the Demo as a POC now (don't wait till the end, don't say "if allowed")**: the JD stresses *hands-on POCs / rapid prototypes / fail fast* twice — proactively say "I built a **runnable POC** to validate this." The local `demo/` has the Experiment Resolver (FNV-1a hash bucketing) + component registry + control/treatment + a live admin preview. This is your **most direct evidence** for "fail fast / hands-on," so present it as a plus, not an aside.

## Slide 5 — The Payload Contract (folded into Slide 4, ~1.5 min)

**Bullets (paste a trimmed JSON):**
```json
{
  "experiment": { "earnings_display": { "variant": "breakdown_v2", "group": "treatment" } },
  "layout": { "components": ["offer_header","earnings_breakdown","distance_summary","surge_indicator","accept_cta"],
              "hints": { "highlight_field": "surge", "theme": "urgent" } },
  "data":   { "earnings_breakdown": { "model":"surge","base_pay":450,"surge_amount":120,"tip_estimate":80,"total":730,"currency":"CAD" } }
}
```
- Server sends: **layout (order) + raw data + hints**; Mobile renders via a **component registry** (~10–15 components)
- Same delivery, **different layout + different earning model** per market (CH/UK/CA, per-zone config)
- Unknown component → mobile **skips it silently** (forward-compat, old apps safe)

**Speaker notes:**
- This slide grounds the abstract architecture in a concrete payload. Seeing the JSON makes the panel trust you've thought it through.
- Stress that the registry is **bounded** (10–15) — this is the hook for the "bounded complexity" point in the leadership section.

---

## Slide 6 — Latency & Scale (3 min)

**Bullets:**
- 2M/hour = ~556 RPS sustained, ~1500 RPS peak
- 200ms is a **p95 SLA**, not the average; today ~180ms → **~20ms real headroom**
- Hybrid adds on-path work: experiment ~3ms + earnings ~3ms + layout ~2ms + payload ~2ms ≈ **+10ms** → p95 ~190ms, **still within SLA, ~10ms buffer left**
- ⚠️ Don't "double-count": 20ms of new work + 20ms of safety margin is wrong — there's one bucket of 20ms
- Backstop: if measured Δ > 15ms → push experiment/layout resolution **off the request path** (precompute), or reclaim from the existing 30ms assembly path

**Speaker notes:**
- This directly answers the most likely probe: "Is 200ms a bottleneck?" Answer: **not a throughput bottleneck, a latency-budget bottleneck.**
- Do the RPS math to show you reason in orders of magnitude. 556 RPS is "light" for a modern service — the bottleneck was never QPS, it's that 20ms.
- Stress "these are targets, not measurements — load-test on a real cluster before Phase 3." Staff doesn't treat estimates as facts.

---

## Slide 7 — Technical Leadership (5 min, ⭐ assessment area #3)

> Prompt: the mobile team is worried Approach B increases their complexity — how do you facilitate this decision?

**Bullets:**
- Principle: **validate the concern, then sharpen it.** Mobile is right — the question isn't *whether* but *how much, what kind, and what's on the other side*.
- 7-step facilitation (titles on the slide):
  1. Acknowledge the concern in writing (turn us-vs-mobile into us-vs-problem)
  2. A **working session**, not a presentation (both leads + the engineer who'd do the work; **no PM/manager/audience**)
  3. Sharpen "complexity" (is it LOC? iOS/Android divergence? coordination cost? headcount?)
  4. Reframe around **4 trade-off dimensions** (let mobile see pure A / pure B are worse for them)
  5. Offer **bounded-complexity mitigations** (locked registry, codegen, forward-compat skip, component reuse, snapshot tests, co-owned RFC)
  6. Propose a **small reversible proof, not a vote** (1 zone + 1 component + 4 weeks + mobile-led)
  7. Pre-state the **escalation path** (each writes a page → Principal/Director decides → ADR)

**Speaker notes:**
- ⚠️ **This is a behavioral question, not a technical one.** It separates Staff (drives a cross-team decision) from Senior (sells the "right answer").
- 🔴 **Hit the JD keyword explicitly**: open with "this is exactly the JD's **influence, not authority** — I can't pull rank on mobile, only make the trade-offs clear so they see the answer themselves." Lands the core requirement.
- 🟢 **Tag "proof not vote" as fail-fast**: step 6's small reversible prototype *is* the JD's *fail fast / rapid prototype* — say it: "rather than vote in a meeting, spend 4 weeks on one zone running a reversible experiment, decide on data, roll back if wrong. That's fail-fast."
- Name the key anti-pattern proactively: "the easiest way to blow this is pre-writing the decision and walking it in for rubber-stamping — mobile will see through it and trust collapses."
- Stress **the prototype is mobile-led** — it removes the "you're forcing this on us" frame.
- The line to land (memorize, say at the close):
  > *"My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision. I'd advocate C, but I'd rather ship B with mobile fully bought in than ship C with mobile compliant but quietly resentful."*
- That line is the Senior/Staff watershed — it's *influence over authority* made concrete.

---

## Slide 8 — Migration Strategy & Metrics (4 min, ⭐ assessment area #4)

> Prompt: what metrics would you track to ensure the migration succeeds?

**Bullets (4 phases, stress reversibility):**
- **Phase 1 (W1-3) Foundation**: add no-op versions of the 3 new components (resolver always returns control, calculator wraps old logic, composer returns default layout) → **zero behavior change**, verify via shadow mode
- **Phase 2 (W4-6) Dual Payload**: emit both `data` (legacy) + `data_v2` (modular); mobile starts implementing the registry; compare field parity
- **Phase 3 (W7-10) Flag Rollout**: mobile ships (registry + fallback); wire the **real** flag service; 1%→5%→25%→50%→100% per city
- **Phase 4 (W11-14) Experiment Live**: run the first **content** A/B (separate from the rollout flag); add surge/tips models; sunset legacy
- **Rollback**: feature-flag instant-off + dual-write → mobile can always fall back to the `data` field, zero data loss

**Metrics (4 classes):**
| Class | Metric | Target |
|-------|--------|--------|
| SLA | p95 / p99 latency | ≤200ms / ≤300ms |
| Business | acceptance rate / time-to-accept / dispute rate (per variant) | no regression |
| Experiment | assignment consistency / flag fallback rate / idea→live time | 100% / <1% / <1 week |
| Migration | % offers on v2 / legacy-vs-v2 field parity | tracked / 100% |

**Speaker notes:**
- Stress **guardrail metrics**: "Not just whether acceptance went up — watch dispute rate / crash rate / latency for **regressions**. In an A/B, guardrails matter more than the north star."
- Stress that business metrics are read **per variant** — otherwise the A/B is meaningless.
- One-line UC1 close: "The whole migration is designed so **any step rolls back in seconds** — dual-write means mobile always has an escape hatch."

---

# Use Case 2: Team Guidance — Real-time Fraud Detection

## Slide 9 — The Situation & The Principle (3 min)

**Bullets:**
- 4 engineers (2-3 yrs each), Kafka+Flink, 45s latency (target <5s), scope crept 3→12, data-quality unknowns, no test strategy, **sprint review in 3 days with nothing to demo**, low morale, one engineer wants to start over, PM escalating
- **Core principle: the crisis is the deadline, not the architecture.**
- Most common Staff failure: charge in, rewrite the architecture, write the critical-path code, "save" the sprint → **solves the demo, breaks the team**
- The right, harder move: **buy time, narrow scope, coach diagnostically, let the team ship something they understand**
- Second principle: **the engineer who wants to "start over with a simpler approach" might be right** — take it seriously, don't dismiss with "we already invested in Flink"

**Speaker notes:**
- Set the tone immediately: "I won't be the firefighter. My role is to multiply this team, not deliver for them."
- This slide answers the meta-question the PDF keeps testing: **can you be a force-multiplier without taking over?**

## Slide 10 — Staff vs Tech Manager Boundary (RACI) (3 min)

**Bullets (the boundary table):**
| Concern | TM owns | Staff owns | Joint |
|---------|---------|------------|-------|
| Sprint scope / deadlines | ✓ | | help TM make the technical case |
| Negotiating with PM / leadership | ✓ | | provide technical framing |
| Individual performance / careers | ✓ | | provide technical signal |
| Team morale | ✓ | | surface technical-frustration causes |
| Architecture / testing / RFCs | | ✓ | |
| Knowledge transfer / mentorship | | ✓ | TM resources it |
| Sprint-review narrative / escalation | | | ✓ shaped together |

- First 30 minutes: **a 1:1 with the TM to draw exactly this line**
- Two traps: ① stepping into the TM's job (negotiating with PM, unilaterally cutting scope) ② letting the TM make architecture calls in your absence

**Speaker notes:**
- The prompt explicitly says "you're not the TM, you work *with* the TM" — this slide answers that directly, **must cover it**.
- One line: "Using the TM's authority without coordinating undermines them and confuses the team."

## Slide 11 — Diagnostic Questions (4 min, ⭐ assessment area #1)

**Bullets (5 buckets, pick 1-2 per bucket — don't recite all 30):**
- **Architecture (the 45s problem)**: "Walk the data flow on a whiteboard" / "where are the 45s spent — ingest/process/sink? measured or inferred?" / "peak event rate per partition? parallelism?" / "any sync I/O in operators?"
- **🔑 The big one**: "Is Flink even right for our event rate? Have you measured it?" → 50K couriers × ~30/day ≈ **~1.5M events/day ≈ ~20 events/sec avg, ~100/sec peak**; **Flink is built for 100k+/sec — they may be paying a complexity tax for capacity they don't need.** ⚠️ **Caveat: UC2 gives no volume. ~20/sec counts delivery events only; with GPS pings it could be a few thousand/sec (and UC1's 2M/hr ≈ 556/sec shows the platform already runs at hundreds/sec). The range straddles "overkill" and "justified" — so don't assert overkill, measure the real rate first. That's the Staff phrasing.**
- **Scope (3→12)**: "Which 3 of 12 do stakeholders most want this quarter?" / "if we shipped only the original 3, does the headline outcome still hold?" (usually yes)
- **Data quality**: "What % of events miss location? distribution by city?" / "what does 'incomplete' mean — null/default/stale/missing?" / "right behavior when missing — drop / flag suspicious / deadletter / hold for late?"
- **Testing**: "Show me how you test one fraud rule end-to-end" / "do you have a known-fraud / known-clean labeled corpus?"

**Speaker notes:**
- 🔴🔴 **Narrative order matters (for the JD's "near real-time data processing")**: **diagnose with real streaming concepts to show depth first, then land the "maybe overkill" conclusion.** Order: ① watermark / event-time, ② backpressure, ③ parallelism / hot keys, ④ checkpoint / sync I/O — once you've hit these, the panel already believes "this person knows streaming"; **then** drop the right-sizing point.
- ⚠️ **Don't let "Flink is overkill" be the opener** — against a JD that explicitly wants streaming experience, that reads as "he's dodging streaming." Make it a *judgment after depth*, not avoidance: "I can diagnose down to the Flink layer, and *because* I understand it, I can see this volume may not need it — that's right-sizing, not avoidance."
- Technique: **ask in waves, don't fire all 30 at once.** Wave 1 listen; Wave 2 targeted follow-ups; Wave 3 1:1s.
- "These questions are diagnostic instruments — used right, they teach the team *how* to think, not just *what* to think."
- The **"order-of-magnitude estimate + it-depends-on-GPS + so-measure-first"** derivation is UC2's brightest technical point — make it clearly, but **after** showing streaming depth. Don't present ~20/sec as settled.

## Slide 12 — The 3-Day Action Plan (5 min, ⭐ assessment area #3)

**Bullets:**
- **The load-bearing decision: ruthlessly cut scope.** Pick the **simplest pattern that still demonstrates the architecture**: "courier marked complete >500m from destination" — data's already there, just a distance calc, runs <5s with or without Flink
- **Day 1**: ① TM 1:1 (align RACI + who tells the PM) ② 60-min team architecture walk-through (produce **their** bottleneck list) ③ scope-lock session (TM+team+PM, **1 pattern in, 11 deferred, PM agrees in writing**) ④ afternoon pairing (engineer drives, you ask questions)
- **Day 2**: keep pairing + write the **first test fixture** (5-10 positive+negative events) + draft the sprint-review narrative with TM + 1:1 with the "start over" engineer
- **Day 3**: team dry run (they present, you watch) + **pre-brief the Director with the TM** + schedule a post-demo architecture retro
- **At the sprint review**: you're in the audience, **the team presents and gets the credit**; TM owns the descope narrative; you and TM step in together only if an architecture question needs experienced framing
- Three acceptable demo outcomes (descending): ① real streaming demo of 1 pattern sub-5s ② batch demo + honest gap framing ③ architecture review (high-risk, only if 1/2 are impossible). **Avoid: a half-working streaming demo that fails live**

**Speaker notes:**
- The load-bearing line: "The team's problem isn't that they can't build 12 — it's that they're trying to ship 12 when 1 tells the story."
- Stress that **the descope is PM-confirmed in writing + leadership pre-briefed** — "never let the team face a hostile escalation alone in the room."

## Slide 13 — Guidance Technique: guide, don't solve (3 min, ⭐ assessment area #2)

**Bullets:**
- **Pair, don't solve** / **whiteboard principles, not fixes** / **code-review in questions** ("what happens if this map is null?" not "add a null check") / **they write the RFC, you comment** / **bring a Principal for a second opinion, let the team present** / **a reading list** (DDIA ch.11, Streaming Systems ch.1-3, Flink Concepts)
- Worked example (the 45s latency):
  - ❌ Senior: "It's probably backpressure — add async I/O, double the parallelism."
  - ✅ Staff: "What does the latency breakdown look like — which step is slowest?" → "what does the metric say?" → "how would we confirm that?" → "run the experiment — what would the result tell us?"
- But **don't swing to the other extreme**: if they ask "are checkpoints usually measured in ms or s?" — just answer "ms." Withholding facts isn't coaching.

**Speaker notes:**
- One line: "Same destination, different path. The Staff version teaches the **debugging method**; the Senior version teaches a symptom→fix mapping."
- Stress the calibration: neither write it for them nor stubbornly refuse to give answers.

## Slide 14 — Long-term Knowledge Transfer (30/60/90) (2 min, ⭐ assessment area #4)

**Bullets:**
- **30 days**: streaming-fundamentals study group (2h/wk × 4) + 2 external SME sessions + architecture office hours (1h/wk)
- **60 days**: each engineer builds a small Flink toy project (windowing + late events) + the team writes the v2 RFC + read a real Flink job from another team
- **90 days**: each engineer teaches one streaming concept (windows/watermark/exactly-once/state/backpressure) + name one team streaming SME + pair with an experienced team for ongoing reviews
- **Key principle: don't let them learn in isolation.** If the org has a team running production streaming, broker the connection — **cross-team transfer beats in-team self-study**

**Speaker notes:**
- One line: "This is what **prevents the next 3-day crisis**. Without it, I'm back in this room in two months."
- Stress "teaching is the highest form of learning" — at 90 days, having them *teach it* means they truly own it.

## Slide 15 — Working with TM / Principals / Leadership (3 min, ⭐ assessment area #5)

**Bullets:**
- **With the TM (your peer)**: daily 15-min during the crunch; architecture runs through me, scope is theirs, individual feedback is theirs, review narrative co-written but TM presents, escalate together; **never go around the TM with directives to engineers**
- **With Principals**: pull them in early for an architecture second opinion + pattern-matching ("have you seen a Flink-was-the-wrong-tool situation? how did it resolve?"); **not to do the work for you, not as political backup over the TM**
- **With Leadership (whom the PM is escalating to)**: **get ahead of it, brief jointly with the TM**:
  > "We found the team picked Flink for a workload (at the rate we measured) well below its design point, paying a complexity tax that's slowing delivery. We've descoped the sprint to one pattern; we'll formally evaluate the architecture over the next 30 days and have a recommendation by [date]. We'd like your air cover with the PM meanwhile."
- A good leadership brief: **honest about what went wrong (framed as engineering judgment, not blame) + a concrete timeline + a specific ask ("air cover" is real, "support" isn't) + TM and Staff together**

**Speaker notes:**
- Stress the "the start-over engineer was right" scenario: **praise them publicly, frame the Flink work as not wasted (it surfaced the data-quality/scope/real-event-rate issues), own the lesson.** "The team leaves more capable, not less — that's what Staff guidance produces."

---

# Close (3 min)

## Slide 16 — Closing: Two Postures

**Bullets (two closing lines, one per case):**
- **UC1 (leadership):** *"My job isn't to win the architecture argument — it's to make the team that ships and maintains it a co-author of the decision. I'd advocate C, but I'd rather ship B fully bought in than ship C quietly resentful."*
- **UC2 (guidance):** *"My role is to make the team better at this — not to do the work for them. The 3-day deadline is a constraint to navigate, not a performance to deliver. If I do my job right, this team handles the next streaming project without a Staff parachute."*
- One line that ties it together: **Staff = leverage over time, not heroics in the moment.**
- 🔴 **A final callback to the JD (bookend)**: "I answered both cases to one standard — drive decisions through **influence, not authority**, and be **hands-on: POCs, fail fast**. That's my read on Staff, and what this role calls for."

**Speaker notes:**
- These two lines + the JD callback are the talk's memory hooks — memorize them, say them last. The *influence, not authority* / *fail fast* planted in the opening close the loop here (a bookend).
- Then open Q&A: "I've got deeper detail on both — architecture, migration, component governance, streaming diagnostics, **plus a runnable POC** — happy to go in any direction."

---

## Appendix: likely hard follow-ups & one-line answers

| Probe | One-liner |
|-------|-----------|
| Is 200ms a bottleneck? | Not a throughput bottleneck (556 RPS is light) — a latency-budget one: only ~20ms headroom, hybrid uses ~10ms, and I don't treat it as fact before load-testing. |
| Why not pure A? | A locks presentation logic on the server: no animation/RTL/native interaction, and server rendering at 2M/h eats latency. |
| Why not pure B? | B needs an app release per layout experiment, iOS/Android consistency is hard, and old apps don't understand new fields. |
| What about users who don't upgrade? | Four change-types: add component / add field = safe; change semantics = new component (v2); remove field = keep until min-version drops. Layout carries `min_app_version` + `fallback`; unknown components are skipped silently. See `app-version-compatibility.md`. |
| How is sticky assignment guaranteed? | Deterministic hash(courierId+experimentId)%100 — no cache dependency, eviction never flips a courier. |
| Is Flink right or not? | It depends on volume, which the prompt doesn't give: delivery-only ~20/sec (overkill), with GPS pings maybe thousands/sec (justified); UC1's 2M/hr ≈ 556/sec shows the platform already runs at hundreds/sec. So **measure first, then choose** — my job is to help the team measure and conclude it themselves, not to declare it. |
| It's just a delay — why Kafka+Flink? | That's exactly the diagnostic question: measure the real event rate before tool selection — they did it backwards. |

---

## Related documents (cite when going deep)

| Document | Covers |
|----------|--------|
| `en/courier-offer-system-architecture.md` | UC1 current state + constraints + latency budget |
| `en/hybrid-end-to-end-design.md` | UC1 system design + payload contract + migration + metrics + delivery resilience |
| `study-notes/runtime-dataflow.md` | UC1 client-side runtime data flow: cold start / offer delivery / template update (SSE), Mermaid diagrams |
| `en/approach-evaluation.md` | UC1 A vs B vs C decision + industry references + B-vs-C and A-vs-C Q&A |
| `en/app-version-compatibility.md` | UC1 old-app compatibility playbook |
| `en/technical-leadership.md` / `study-notes/technical-leadership.zh.md` | UC1 technical leadership (mobile team concern) |
| `en/team-guidance-use-case-2.md` / `study-notes/team-guidance-use-case-2.zh.md` | UC2 all 5 assessment areas |
| `adr/ADR-001-hybrid-sdui.md` | UC1 decision record (1-page A/B/C crystallization; for areas #2+#3) |
| `adr/RFC-skeleton-fraud-detection.md` | UC2 RFC skeleton + reviewer questions (demonstrates "guide, don't solve"; for area #2) |
| `demo/` | runnable hybrid POC (hash bucketing + registry + control/treatment + SSE + A-vs-B-vs-C page) |
| `flink-kafka-lab/` , `flink-kafka-docker/` | UC2 learning aids: Flink/Kafka teaching model + real cluster to see the UI |
| `en/job-description.md` | the JD + JD↔prep mapping |
| `en/handOver.md` | open items to verify against the real repo |
