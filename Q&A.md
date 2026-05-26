# Q&A — Anticipated Questions & Prepared Answers

> A set of questions I expected during this interview, with concise answers and pointers to the supporting documents in this repo. Feel free to jump straight to whichever interests you.
>
> Full design context lives in [`en/`](./en/) (architecture, decisions, leadership) and [`adr/`](./adr/) (ADR-001, RFC skeleton). The runnable prototype is in [`demo/`](./demo/).

---

## Contents

**Use Case 1 — Courier Offering System Modernization**
- [Q1. Why not just go with B?](#q1-why-not-just-go-with-b)
- [Q2. Precise boundary — what needs a release in C?](#q2-precise-boundary--what-needs-a-release-in-c)
- [Q3. A vs C — the real difference](#q3-a-vs-c--the-real-difference)
- [Q4. Latency at 2M/h — p99 and a slow dependency](#q4-latency-at-2mh--p99-and-a-slow-dependency)
- [Q5. Sticky bucketing — surviving cache eviction & restart](#q5-sticky-bucketing--surviving-cache-eviction--restart)
- [Q5b. Multi-arm experiments & collisions across experiments](#q5b-multi-arm-experiments--collisions-across-experiments)
- [Q6. Bringing the mobile lead along in the room](#q6-bringing-the-mobile-lead-along-in-the-room)
- [Q6b. POC done, mobile lead still disagrees at the root](#q6b-poc-done-mobile-lead-still-disagrees-at-the-root)
- [Q7. Migration & rollback](#q7-migration--rollback)
- [Q7b. People, timeline, and cost](#q7b-people-timeline-and-cost)
- [Q8. Push failures — does a courier miss an offer?](#q8-push-failures--does-a-courier-miss-an-offer)
- [Q9. Old app versions and new components](#q9-old-app-versions-and-new-components)

**Use Case 2 — Fraud Detection Team Guidance**
- [Q10. Staff vs Tech Manager — how is the role different?](#q10-staff-vs-tech-manager--how-is-the-role-different)
- [Q11. Diagnosing the 45s lag](#q11-diagnosing-the-45s-lag)
- [Q12. The first 3-day plan](#q12-the-first-3-day-plan)
- [Q13. Guiding without solving it for them](#q13-guiding-without-solving-it-for-them)
- [Q14. Do they even need Flink? What volume justifies it?](#q14-do-they-even-need-flink-what-volume-justifies-it)
- [Q15. Knowledge transfer — 30/60/90](#q15-knowledge-transfer--306090)
- [Q16. Working with TM, Principals, and Leadership](#q16-working-with-tm-principals-and-leadership)

**General**
- [Q17. The decision I'm least sure about](#q17-the-decision-im-least-sure-about)
- [Document Index](#document-index)

---

## Use Case 1 — Courier Offering System Modernization

### Q1. Why not just go with B?

> *Why not just go with B (raw data + mobile owns presentation)? What does the hybrid actually buy?*

> "With B, the app owns the layout. So any new layout needs a new app release. People will say 'but we have feature flags.' Feature flags only switch between layouts we already shipped — they can't build a new one. With C, the server picks the components and the order. So I can ship a new layout with **no app release**. I also get the same look on iOS and Android. And I can roll back an experiment from the server in one click. B can't do any of those three."

📄 [`en/approach-evaluation.md`](./en/approach-evaluation.md) · [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)

[↑ Back to top](#contents)

---

### Q2. Precise boundary — what needs a release in C?

> *Draw the precise line — what can C change from the server with no release, and what still needs one?*

> "From the server, no release: which components show, their order, show or hide, hints, which experiment, and which earnings model. Still needs a release: a brand-new component, restyling a component — that's the 'how', and mobile owns that — or changing a component's data shape, which I'd ship as a v2 component. I'm honest about it: C does **not** let me restyle from the server. It changes *what* and the *order*, not *how*."

📄 [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) (Consequences section)

[↑ Back to top](#contents)

---

### Q3. A vs C — the real difference

> *A and C look similar — both send structured data. What's the real difference?*

> "A sends the finished text — '$11.76'. So the app just paints it. C sends the value — 1176, in CAD. So the app can do more: animate the number counting up, re-format it if the language changes, highlight it, or show a breakdown on long-press. A can't do those. It's also about cost. A renders on the server, on the hot path, two million times an hour. C renders on the phones — fifty thousand of them, for free, in parallel, and native. And A keeps growing richer until it basically becomes C anyway."

📄 [`en/approach-evaluation.md`](./en/approach-evaluation.md) (A vs C section)

[↑ Back to top](#contents)

---

### Q4. Latency at 2M/h — p99 and a slow dependency

> *You're adding 4 components on the hot path at 2M/h with ~20ms headroom. Convince me you don't blow the 200ms p95 — including p99 and a slow dependency.*

> "Three things. **One:** my four components are tiny. The real cost is the Temporal pay-and-bonus calls — about 150ms, roughly 80% of the budget. My parts are well under a millisecond. And that 10ms is a *budget*, not a real measurement — I'd load-test first. **Two:** flags and templates are cached. On a cache miss we use the last good value and refresh in the background. So the courier never waits on the flag service. **Three:** the resolver fails closed. If it can't decide in time, the courier just gets the default layout — never an error, never a hang. A slow dependency hurts the *experiment*, not the *offer*. And I'd set an alarm if the fallback fires more than about 1%."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) · [`en/courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md)

[↑ Back to top](#contents)

---

### Q5. Sticky bucketing — surviving cache eviction & restart

> *A courier sees treatment, reopens 5 min later and sees control. How do you guarantee no flip — and does it survive cache eviction / server restart?*

> "The bucket is computed, not stored. We take hash of courierId plus experimentId, mod 100. That gives each courier a fixed number, 0 to 99, and we compare it to the rollout percent. Same courier, same experiment, always the same bucket — it's just math on a stable ID. So a cache wipe or a restart can't flip anyone — there's nothing stored to lose, and no database lookup. Ramping is safe too: going from 10% to 50% only *adds* couriers, it never kicks anyone out. I add the experimentId so different experiments don't land on the same people. Region only decides *who's allowed in* — the bucket is always on courierId, so moving region never flips them. And if anything fails, we default to control."

📄 [`en/sticky-bucketing-explained.md`](./en/sticky-bucketing-explained.md) · [`demo/server/lib/hash.js`](./demo/server/lib/hash.js)

[↑ Back to top](#contents)

---

### Q5b. Multi-arm experiments & collisions across experiments

> *Suppose you have `earnings_v1` and `earnings_v2`. Can the same courier end up in **both** buckets?*

> "It depends — is it one experiment or two? If v1 and v2 are two arms of *one* experiment, each courier gets one number, and that number lands in one band — control, v1, or v2. They can't be in two. That's by design. If they're *two separate* experiments, then yes — a courier could be in treatment for both, because I add the experimentId on purpose so experiments don't line up. That's good when they're unrelated. But if both change the *same screen*, that's a collision. I'd fix it by making them one experiment with multiple arms, or by putting them in a mutual-exclusion group."

📄 [`en/sticky-bucketing-explained.md`](./en/sticky-bucketing-explained.md) (multi-arm + collision section)

[↑ Back to top](#contents)

---

### Q6. Bringing the mobile lead along in the room

> *The mobile lead pushes back: "Hybrid dumps complexity on us. Just send finished strings (A)." They're senior and don't report to you. How do you win this in the room?*

> "I don't win it on the whiteboard. I win it by making the mobile lead a **co-author** of the contract, not just someone I hand it to. Their real fear is endless complexity — so I deal with that head-on. The registry is locked, around 10 to 15 components, and we add to it together. We generate the iOS and Android code from one shared schema — no hand-parsing, no drift. And the app skips components it doesn't know, so they're never blocked by the server. Then I don't argue — I build a small POC on one screen and let the data decide. The message isn't 'backend won.' It's 'they keep native UX, we get fast experiments, and their complexity is capped.'"

📄 [`en/technical-leadership.md`](./en/technical-leadership.md) · [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) (Mitigations)

[↑ Back to top](#contents)

---

### Q6b. POC done, mobile lead still disagrees at the root

> *The POC is done, the data is good — but the mobile lead **still** disagrees, at the root. Your influence is spent. Now what?*

> "If he still says no, this is too big for just us two. So I bring it to the TM and the Principals — **with him, not behind him**. We show both sides, and I help him make his case too. And I'm honest — **maybe I'm wrong**. If they pick B, I fully support B. I'd rather ship the option **the team believes in** than one they resent. I'm escalating to get a fair decision, not to win."

📄 [`en/technical-leadership.md`](./en/technical-leadership.md) (disagree & commit / when to escalate)

[↑ Back to top](#contents)

---

### Q7. Migration & rollback

> *How do you migrate off the hardcoded `Offer.java` safely? What's the rollback story?*

> "Four phases, and you can undo each one in seconds. Phase 1: ship the new pipeline as a no-op that produces today's exact payload. Phase 2: run old and new side by side and compare the output — no user impact. Phase 3: turn it on with a flag, from 1% up to 100%, using the sticky hash. Phase 4: real experiments go live. Rollback at any point is just turning the flag down — no deploy. I watch p95 and p99, accept rate per variant, dispute rate, crash rate, and how often the fallback fires."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (Migration Strategy + Metrics)

[↑ Back to top](#contents)

---

### Q7b. People, timeline, and cost

> *How many people and how long? What does this cost to build?*

> "I wouldn't throw out a number cold. I'd break it into the phases we have and size each one with the team that does it. Roughly:
>
> | Phase | Who | Rough effort |
> |---|---|---|
> | 0. Contract + RFC (component schema, registry v1 scope) | BE + mobile leads + me | ~2–3 weeks |
> | 1. No-op foundation (new pipeline reproduces today's payload) | Backend | ~1 sprint |
> | 2. Dual-emit + registry v1 (~4–5 core components) + shared-schema codegen | Backend + iOS + Android **in parallel** | ~2–3 sprints (the bulk) |
> | 3. Flag rollout 1%→100% + bake | Backend + data | ~1 sprint + bake |
> | 4. First real experiment live | full | ~1 sprint |
>
> So about a quarter to the first experiment, with a small team — say two backend, two mobile (one iOS, one Android), and part-time data and QA. The biggest cost is the mobile side — the registry, the codegen, and the contract. That's a one-time cost, and every later experiment rides on it for free. The ongoing cost is governance — the review board that keeps the registry from growing out of control. And I'd gate the whole thing on a one-to-two week POC: one screen, three components, real codegen. If the contract is painful, we find that out cheaply. These are estimates I'd refine with the teams — the final headcount and timeline call is the TM's."

**Common follow-ups:**
- *"What's the cost of NOT doing it?"* → "Every change stays stuck behind backend and an app release. We can't personalize earnings or run A/B tests — the questions that started this never get answered."
- *"Why not just buy an SDUI framework?"* → "We already push structured JSON on an event-driven stack — C is just the next step, not a rebuild. A vendor tool adds a dependency and still needs our contract and our registry. Most of the work doesn't go away."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (Migration phases) · [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) (Consequences)

[↑ Back to top](#contents)

---

### Q8. Push failures — does a courier miss an offer?

> *Offers are pushed (SSE/AppSync). What happens when the push fails — does a courier miss an offer?*

> "Push is a speed optimization, not the source of truth. When the app reconnects, it *pulls* the current offer and syncs up. Every offer has an ID for dedup and a TTL, so we can safely resend it. And the real safety net is the business rule: if an offer isn't accepted before it expires, it goes to the next courier, and the first accept wins with an atomic claim. So a dropped push never loses an offer, and never assigns it twice."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (Offer Delivery Resilience) · [`en/runtime-dataflow.md`](./en/runtime-dataflow.md)

[↑ Back to top](#contents)

---

### Q9. Old app versions and new components

> *Old app versions don't know your new components. How do you not break them?*

> "It's built into the contract. The app skips components it doesn't know, so the server can ship ahead of the app. If an old app really can't render a payload, the server checks its minimum version and sends a fallback layout — built only from components that version has. So old apps degrade nicely instead of crashing."

📄 [`en/app-version-compatibility.md`](./en/app-version-compatibility.md)

[↑ Back to top](#contents)

---

## Use Case 2 — Fraud Detection Team Guidance

### Q10. Staff vs Tech Manager — how is the role different?

> *As a Staff Engineer, how is your role here different from the Technology Manager's?*

> "The TM owns people, priorities, and deadlines. I own the technical direction and the team's skill. Here, I diagnose the system, I *guide* the engineers to the fix instead of handing them a patch, and I leave them more capable than I found them. I work *with* the TM — I surface the risk and the options; they make the staffing and timeline calls."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

[↑ Back to top](#contents)

---

### Q11. Diagnosing the 45s lag

> *The pipeline lags ~45s behind real-time. How do you diagnose it?*

> "I start from the data, not from guesses. In the Flink UI I look for backpressure — which operator is the bottleneck slowing everything upstream. Then checkpoint time and failures. Then watermark lag — how far behind event time we are. Then key skew — one hot key overloading one slot. And consumer lag at the Kafka source. A steady 45-second lag is usually a backpressured operator or too little parallelism — not a code bug. So I measure before anyone touches the code."

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) · [`study-notes/flink-kafka-notes.md`](./study-notes/flink-kafka-notes.md)

[↑ Back to top](#contents)

---

### Q12. The first 3-day plan

> *Give me your first 3-day plan.*

> "Day 1: I listen and read — the architecture, the Flink dashboards, recent incidents — and I pair with the engineers. I change nothing. On scope, I don't just ask 'which 3 of 12.' I audit the 12 first with the team — often it's really 4–5 distinct patterns once you find the duplicates, subsets, and ones we don't have the data for. Day 2: with them, I form a hypothesis from the data — probably backpressure or skew — and design the smallest test to confirm it. Day 3: we validate the smallest fix together, and I leave an RFC skeleton with the open questions, so the team carries it forward. I'm handing over skill, not parachuting in a patch."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) · [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md)

[↑ Back to top](#contents)

---

### Q13. Guiding without solving it for them

> *How do you guide without just solving it for them?*

> "I ask the questions a senior reviewer would ask, and let them find the answer. Instead of 'set parallelism to 8,' I ask 'which operator is backpressured, and what does the watermark tell you?' I give them an RFC skeleton — the structure and the open questions — and I review their reasoning, not just their patch. They own the fix; I make sure the thinking is solid."

📄 [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md) · [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

[↑ Back to top](#contents)

---

### Q14. Do they even need Flink? What volume justifies it?

> *Do they even need Flink? What data volume justifies it?*

> "Honestly, it depends on the volume — and the prompt doesn't give it. If it's just delivery events, that's maybe tens per second from fifty thousand couriers — a plain Kafka consumer or Kafka Streams handles that. Flink earns its place when you add GPS pings, which can be thousands per second and need real event-time windows, keyed state, and backpressure handling. So I wouldn't say 'rip out Flink' or 'keep Flink.' I'd say 'let's measure the real throughput and what state we need, then right-size.'"

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) (when do you actually need Flink + right-sizing)

[↑ Back to top](#contents)

---

### Q15. Knowledge transfer — 30/60/90

> *How do you transfer knowledge so the team doesn't regress after you leave?*

> "Over 30 days, a streaming study group and outside experts. Over 60, each engineer builds a small Flink toy project, and the team writes the v2 RFC. Over 90, each engineer **teaches one concept back** — watermarks, backpressure — because teaching is when they really own it. Key principle: don't let them learn alone. If another team runs production streaming, I set up that connection. **Cross-team learning beats self-study.** The real test: can they handle the *next* incident without me?"

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) (KT 30/60/90)

[↑ Back to top](#contents)

---

### Q16. Working with TM, Principals, and Leadership

> *How do you work with the TM and the Principal engineers without stepping on toes?*

> "Clear lanes. I bring the TM the risk and the options, so they can make the priority and staffing calls. With the Principals, I align on the bigger architecture — I'm not overriding them, I'm keeping this pipeline consistent with the wider platform. I work through written RFCs and shared diagnosis, so the right people own the decisions. That's influence, not authority."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

[↑ Back to top](#contents)

---

## General

### Q17. The decision I'm least sure about

> *What's the one decision you're least sure about?*

> "Honestly, the mobile complexity and the governance. C asks the mobile team to build and maintain a registry, and it asks us to run a review board so it doesn't sprawl. Those are real costs. If the business only ever needed two or three fixed layouts, A would be simpler, and I'd pick A. I chose C because the business wants lots of experiments — but I hold that view loosely, and the POC is there to check it."

📄 [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) (Consequences) · [`en/approach-evaluation.md`](./en/approach-evaluation.md)

[↑ Back to top](#contents)

---

## Document Index

| Topic | Where to look |
|---|---|
| Current architecture + latency budget | [`en/courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md) |
| A vs B vs C comparison + A-vs-C / B-vs-C breakdowns | [`en/approach-evaluation.md`](./en/approach-evaluation.md) |
| End-to-end design for C / migration / metrics / delivery resilience | [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) |
| Sticky bucketing — how the hash actually works | [`en/sticky-bucketing-explained.md`](./en/sticky-bucketing-explained.md) |
| Old app compatibility | [`en/app-version-compatibility.md`](./en/app-version-compatibility.md) |
| Technical leadership (UC1) | [`en/technical-leadership.md`](./en/technical-leadership.md) |
| Team guidance (UC2) — all 5 assessment points | [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) |
| Flink / Kafka background + right-sizing | [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) |
| Decision record + RFC skeleton | [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) · [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md) |
| Live POC (server + client + admin) | [`demo/`](./demo/) — see [`demo/README.md`](./demo/README.md) to run it |

[↑ Back to top](#contents)
