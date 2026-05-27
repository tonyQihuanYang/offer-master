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
- [Q4b. Network calls on the offer path — what actually fires?](#q4b-network-calls-on-the-offer-path--what-actually-fires)
- [Q4c. Do you really need the Earnings Calculator? (challenging your own components)](#q4c-do-you-really-need-the-earnings-calculator-challenging-your-own-components)
- [Q5. Sticky bucketing — surviving cache eviction & restart](#q5-sticky-bucketing--surviving-cache-eviction--restart)
- [Q5b. Multi-arm experiments & collisions across experiments](#q5b-multi-arm-experiments--collisions-across-experiments)
- [Q6. Bringing the mobile lead along in the room](#q6-bringing-the-mobile-lead-along-in-the-room)
- [Q6b. POC done, mobile lead still disagrees at the root](#q6b-poc-done-mobile-lead-still-disagrees-at-the-root)
- [Q7. Migration & rollback](#q7-migration--rollback)
- [Q7b. People, timeline, and cost](#q7b-people-timeline-and-cost)
- [Q7c. The full migration timeline — mobile update, install base, cleanup](#q7c-the-full-migration-timeline--mobile-update-install-base-cleanup)
- [Q8. Push failures — does a courier miss an offer?](#q8-push-failures--does-a-courier-miss-an-offer)
- [Q9. Old app versions and new components](#q9-old-app-versions-and-new-components)

**Use Case 2 — Fraud Detection Team Guidance**
- [Q10. Staff vs Tech Manager — how is the role different?](#q10-staff-vs-tech-manager--how-is-the-role-different)
- [Q11. Diagnosing the 45s lag](#q11-diagnosing-the-45s-lag)
- [Q11b. Data quality — handling missing or unreliable GPS](#q11b-data-quality--handling-missing-or-unreliable-gps)
- [Q12. The first 3-day plan](#q12-the-first-3-day-plan)
- [Q12b. What if the 3-day plan doesn't ship? Off-ramps and Day-2 checkpoint](#q12b-what-if-the-3-day-plan-doesnt-ship-off-ramps-and-day-2-checkpoint)
- [Q12c. Handling the engineer who wants to start over](#q12c-handling-the-engineer-who-wants-to-start-over)
- [Q13. Guiding without solving it for them](#q13-guiding-without-solving-it-for-them)
- [Q14. Do they even need Flink? What volume justifies it?](#q14-do-they-even-need-flink-what-volume-justifies-it)
- [Q14b. When *do* you actually need Flink? (concrete decision criteria)](#q14b-when-do-you-actually-need-flink-concrete-decision-criteria)
- [Q14c. Could Flink SQL simplify this? Are we over-complicating it?](#q14c-could-flink-sql-simplify-this-are-we-over-complicating-it)
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

### Q4b. Network calls on the offer path — what actually fires?

> *On a single offer, what REST/HTTP calls happen? Are the four new components making any network requests of their own?*

> "On the request path for a single offer, there's **one synchronous outbound call** — the **Temporal workflow** for pay and bonus, about **150ms**. That's where ~80% of the latency budget goes.
>
> Inside the four components themselves, **zero outbound calls**. Temporal's output is already in hand by the time they run. Configs and flags live in an **in-memory cache**, kept fresh by a **background task** polling every ~30 seconds — that REST call does happen, but it's deliberately **off the request path**, so a slow config service can never hurt a courier's offer.
>
> Outbound to the mobile app, we **push** over AppSync / SSE — fire-and-forget, we don't wait for the client to ACK.
>
> So on the latency path: one Temporal call plus four in-process components. That's it. The 4 components add ~10ms of **pure compute** — no I/O, no network."

**What's on the path vs deliberately off it:**

| Call | Protocol | Sync? | On the 200ms path? |
|---|---|---|---|
| Service → **Temporal** (pay + bonus) | gRPC | yes | **yes — ~150ms (the big one)** |
| 4 components (resolver / earnings / layout / payload) | in-process function calls | yes | yes — ~10ms total, sub-ms real |
| Service → **AppSync push** | WebSocket / SSE | fire-and-forget | <1ms enqueue |
| Service → **config service** | REST | **background, every ~30s** | ❌ **no — off-path by design** |
| Service → **feature flag service** | REST | **background, every ~30s** | ❌ **no — off-path by design** |
| App → `/api/stream` (offer push) | SSE long-lived | n/a (client-initiated, kept open) | not a request-response |
| App → `POST /offers/:id/accept` | REST | yes | separate path, not on offer push |

**Why this design:** "**move every read off the request path**" is the trick that lets the 4 components claim zero hot-path I/O. The 30-second freshness window on configs is a deliberate trade — losing 30s of staleness to gain zero network on the offer push.

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (request path / event flow) · [`en/courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md)

[↑ Back to top](#contents)

---

### Q4c. Do you really need the Earnings Calculator? (challenging your own components)

> *Looking at your four components — do you actually need the Earnings Calculator? Couldn't Temporal just return the final number, or mobile compute it?*

> "Good question — I challenged this myself.
>
> Its job isn't really *'add two numbers'*. It's **'decide which earnings model applies to this market and this variant'**: flat-rate in Switzerland, distance-based in the UK, surge with tips prediction in Canada. That decision lives somewhere — the question is *where*.
>
> If I don't have this component, the model choice leaks into one of three places: **the mobile app** — which violates the C contract (mobile decides *how*, not *what*) and guarantees iOS/Android drift; **the Layout Composer** — which mixes concerns, layout shouldn't compute money; or **the Temporal workflow** — which is orchestration, not the place for evolving business decisions.
>
> Keeping it separate is what makes the mitigation we promised the mobile team — *'adding a new earnings model is backend-only, no app release'* — actually true. It's also the **source of truth for dispute resolution**: when a courier asks why their pay was X, there's one place to look.
>
> Honest caveat: if the business only ever had one earnings model, I'd inline it into the Payload Builder. It earns its keep because earnings logic **changes** — and that's the whole reason we picked C in the first place."

**Meta-signal — say this after:**
> "I think it's healthy to ask that question for every component on the diagram. If I can't defend one, it shouldn't be there."

**Where the logic would leak if you removed it:**

| If you remove the Earnings Calculator… | …the model-selection logic leaks into | Why that's bad |
|---|---|---|
| Mobile app computes total | iOS + Android both | Violates C contract; iOS/Android drift; two versions to debug |
| Layout Composer combines money + layout | one mega-component | Single-responsibility violation; harder to test in isolation |
| Temporal workflow returns the final number | orchestration layer | Business decisions in an orchestrator that's meant to be stable |
| Payload Builder inlines the math | the assembler | OK *if* only one model ever; fragile when a new model is added |

📄 [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) (Mitigations — *"one component reads many earning models"*) · [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (component breakdown)

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

> "Four phases, and you can undo each one in seconds. Phase 1: ship the new pipeline as a no-op that produces today's exact payload. Phase 2: run old and new side by side and compare the output — no user impact. Phase 3: turn it on with a flag, from 1% up to 100%, using the sticky hash. Phase 4: real experiments go live. Rollback at any point is just turning the flag down — no deploy. I watch p95 and p99, accept rate per variant, complaint rate, crash rate, and how often the fallback fires."

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

### Q7c. The full migration timeline — mobile update, install base, cleanup

> *Doesn't the mobile app also need to update? And what's the end state — do you keep `data` and `data_v2` forever?*

> "Absolutely — mobile updating is actually **the first step**, not a side effect. Two parallel tracks:
>
> **Step 0 (precondition).** Mobile ships a new app version with the registry and the code to read `data_v2` based on a `_meta.use_field` hint. We wait a few weeks for the install base to reach **roughly 80%** before the backend flips anything.
>
> **Phase 1–4 (backend).** Once install base is high enough: no-op foundation → dual emit (`data` + `data_v2` + `_meta`) → flag rollout → experiments live.
>
> **Phase 5 — cleanup (months later).** When the install base of the v2-capable app reaches **>99%**, we stop emitting `data` server-side. Optionally we **rename `data_v2` back to `data`** in the next API version, so we end up with **one clean field name again — no `v3, v4` accumulation forever**.
>
> Three things worth knowing:
>
> **One — old apps don't break.** They silently skip `data_v2` if they see it (forward-compat), and keep reading the `data` field we keep emitting during transition. They just don't get the new experiments — they degrade, they don't break.
>
> **Two — install base gates rollout reach.** If only 30% of users updated, the most I can ramp the flag to is **30% of the *fleet*** — the other 70% are still on old apps reading `data`. So 'wait for install base' isn't just engineering hygiene, it's the **business reach** of the experiment.
>
> **Three — it really is `data` again at the end.** The `_v2` suffix is temporary scaffolding. Once cleanup is done, the API is back to one clean payload — the same shape the prototype already shows."

**The full timeline at a glance:**

| Stage | Backend does | Mobile does | What users see |
|---|---|---|---|
| **Step 0** | (idle) | **Ships new app with registry + read-v2 code** | Old UI |
| **Phase 1: no-op** | New pipeline runs but emits nothing | Install base climbs | Old UI |
| **Phase 2: dual emit** | Emits `{data, data_v2, _meta=v1}` | New app can read both; flag=0 → reads old | Old UI |
| **Phase 3: flag rollout** | Same; `_meta` flips per-courier as % ramps | New app reads field per `_meta` | New UI (gradually) |
| **Phase 4: experiments live** | Same | Same | New UI (with experiments running) |
| **Phase 5: cleanup** *(months later)* | **Stops emitting `data`; optionally renames `data_v2` → `data`** | Next app version simplifies the read path | New UI (clean payload) |

> 💡 The demo at <https://offer.gummui.com> shows the **Phase 5 steady state** on purpose — a clean Approach C payload. The dual-emit `_meta.use_field` mechanism is a temporary scaffold that only exists during Phases 2–3.

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (Migration phases) · [`en/app-version-compatibility.md`](./en/app-version-compatibility.md) (old app coexistence)

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

> "I start from the data, not guesses. Six things, in order from most common to most subtle. I'd walk these with the team — the questions are the coaching."

**The 6-step Flink diagnosis order:**

| # | Where to look | What to find | Common cause |
|---|---|---|---|
| **1** | **Backpressure indicator** (Flink UI → Job → operators) | Red bars cascade *upstream* — the first green operator above a red one is the real bottleneck | 90% of cases solve here |
| **2** | **Watermark lag** (UI → Operator → Watermarks) | Difference between event time and current watermark | `BoundedOutOfOrderness` set too high; one empty partition holding watermark back |
| **3** | **Checkpoint duration** (UI → Checkpoints tab) | End-to-end time, alignment time, failure rate | State too big; wrong state backend; slow disk |
| **4** | **SubTask skew** (UI → Operator → SubTasks) | One subtask processing 100× more records than others | One hot courier → all goes to one slot; need salting in keyBy |
| **5** | **Kafka consumer lag** (Flink source metrics or Kafka monitoring) | `records-lag-max` growing over time | Source parallelism < Kafka partitions; or downstream blocking |
| **6** | **Synchronous I/O in operator** (TaskManager logs + read code) | A `MapFunction` calling DB/HTTP synchronously | Should be `AsyncDataStream.unorderedWait` instead |

**Speakable English (60–90 seconds):**

> "Six things, in order.
>
> **One — the backpressure indicator** in the Flink UI. Red bars cascade upstream — the first **green** operator above a red one is the real bottleneck. Solves 90% of cases.
>
> **Two — watermark lag.** If the watermark is 30 seconds behind, that's literally where 30 seconds of latency live. Usually `BoundedOutOfOrderness` set too high, or one empty partition holding the watermark back.
>
> **Three — checkpoint duration.** If checkpoints take seconds, state is too big or the backend is wrong.
>
> **Four — subtask skew.** One hot courier doing 100× the work overloads one slot.
>
> **Five — Kafka consumer lag** at the source. If it's growing, Flink can't keep up with ingest.
>
> **Six — synchronous I/O inside operators.** A `MapFunction` calling a database synchronously blocks the slot. Fix is async I/O.
>
> I walk these with the team **in this order**. The questions are the coaching."

**Memorable one-liner:**
- "**Backpressure → watermark → checkpoint → skew → Kafka lag → sync I/O. Six checks, in that order — UI first, code last.**"

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) (Flink runtime) · [`study-notes/flink-kafka-notes.md`](./study-notes/flink-kafka-notes.md) (UI / watermark / window concepts)

[↑ Back to top](#contents)

---

### Q11b. Data quality — handling missing or unreliable GPS

> *On Slide 19 you mentioned "how many events miss the location field." What causes that? And what do you do when a courier legitimately loses GPS — say, walking into a building to deliver?*

> "Two parts. **First, diagnose what kind of 'missing' I'm seeing.** Then, **for the legitimate cases — never penalize a courier for doing their job indoors.**"

#### Part 1 — Why location goes missing (4 categories)

| Category | Examples |
|---|---|
| **Device / GPS** | Permission denied · indoors / garage / tunnel · iOS background-tracking limits · battery saver killed GPS · old app version bug |
| **Network / pipeline** | Event built before GPS resolved → null · retry inserted stale last-known location · buffer dropped |
| **Backend / schema** | Producer mis-serialized · schema field renamed · corrupt partition |
| **Legitimate** | Event type doesn't need location (`OFFER_RECEIVED`, `APP_OPEN`) · GDPR opt-out · indoor delivery |

→ **The fix depends on the category** — can't treat them the same.

#### Part 2 — How to debug (5 steps)

1. **Quantify per event type** — counting all events together hides the issue:
   ```sql
   SELECT event_type,
          COUNT(*) AS total,
          SUM(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END) AS missing,
          ROUND(100.0 * SUM(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END)
                / COUNT(*), 2) AS pct_missing
   FROM courier_events
   WHERE event_time > NOW() - INTERVAL '1 DAY'
   GROUP BY event_type ORDER BY pct_missing DESC;
   ```
2. **Find the pattern** — slice by region, app version, hour of day. The cause is usually concentrated (one bad version, one rough region).
3. **Distinguish kinds of missing**: `null` · field-absent · `0.0` (default-value bug) · **stale** (same coords for 10+ events).
4. **Source-trace** — read producer code, check schema registry, talk to mobile.
5. **Decide handling**:
   - **< 1%** missing → filter and move on
   - **1–10% concentrated** → fix the source (app or producer)
   - **\> 10%** → block any fraud metric from production until clean

#### Part 3 — Handling LEGITIMATE GPS loss (the indoor-delivery case)

This is the most important nuance. **A courier walking into an apartment building to deliver food is doing exactly what we pay them to do. GPS gap during that moment is expected, not suspicious.**

**Five strategies, simplest to most sophisticated:**

| # | Strategy | What it does |
|---|---|---|
| **1** | **Last-known-good with TTL** | Use the most recent GPS reading from the last ~60s. Older than that → mark as low-precision. Don't use 10-minute-old GPS as the "delivery location." |
| **2** | **Cell-tower / Wi-Fi fallback** | Both iOS and Android can return an approximate location from cell/Wi-Fi when GPS isn't available — 50–500m precision. Tag those events `precision: low`. |
| **3** | **Destination geo-fence pre-arrival** | Use the last GPS reading *before* the courier entered the destination geofence as the delivery location. Then a GPS gap *inside* the building is fine — we already know they got there. |
| **4** | **Two-tier rules: definite vs suspicious** | Location confirmed → run "completed >500m" rule. Location missing → require **another signal** (e.g., delivery completed in under 30 seconds, or customer complaint) before flagging. |
| **5** | **Confidence scores, not binary flags** | Instead of "fraud or not," compute a 0–100 risk score. Missing location lowers confidence in the score — for a rule that needs precision, raise the threshold; for one that doesn't, ignore. |

#### The core principle

> **"Missing GPS is missing data, not evidence of fraud. The fix is to handle the gap — last-known + fallback + geo-fence + relaxed thresholds — not to punish couriers for delivering indoors."**

**False positives on legitimate indoor deliveries are worse than false negatives**: they erode courier trust, generate complaint volume, and hide the real fraud signal behind noise.

#### Speakable English (when asked: "what if GPS legitimately fails?")

> "A courier walking into a building to deliver is doing exactly what we pay them to do — GPS gap there is expected, not suspicious. So I'd handle it on five levels.
>
> **Use the last-known-good GPS within a tight TTL** — say 60 seconds. Older than that, mark the event low-precision.
>
> **Fall back to cell-tower or Wi-Fi location**. Less precise, but it tells us 'this courier is in this building,' which is what we need.
>
> **Use a destination geo-fence**. The last GPS reading before the courier entered the geofence is the delivery location. GPS gap *inside* the geofence is fine — we already know they arrived.
>
> **Two-tier rules.** A definite rule needs confirmed location. A suspicious rule with missing location requires another signal — a customer complaint, a time anomaly — before flagging.
>
> **And ideally, confidence scores instead of binary flags.** Missing location lowers confidence; rules adjust their threshold.
>
> The principle: **missing GPS is missing data, not evidence**. Punishing couriers for legitimate indoor deliveries erodes trust and buries the real fraud signal."

**Memorable line:**
- "**Missing GPS is missing data, not evidence of fraud. Handle the gap; don't punish the gap.**"

📄 [`flink-kafka-docker/sql/fraud.sql`](./flink-kafka-docker/sql/fraud.sql) (the distance-based rule) · [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md)

[↑ Back to top](#contents)

---

### Q12. The first 3-day plan

> *Give me your first 3-day plan.*

> "Day 1: I listen and read — the architecture, the Flink dashboards, recent incidents — and I pair with the engineers. I change nothing. On scope, I don't just ask 'which 3 of 12.' I audit the 12 first with the team — often it's really 4–5 distinct patterns once you find the duplicates, subsets, and ones we don't have the data for. Day 2: with them, I form a hypothesis from the data — probably backpressure or skew — and design the smallest test to confirm it. Day 3: we validate the smallest fix together, and I leave an RFC skeleton with the open questions, so the team carries it forward. I'm handing over skill, not parachuting in a patch."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) · [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md)

[↑ Back to top](#contents)

---

### Q12b. What if the 3-day plan doesn't ship? Off-ramps and Day-2 checkpoint

> *Won't auditing the 12 patterns on Day 1 waste time? And what if pair-coding on Day 2 doesn't actually ship a working version by Day 3?*

> "Two fair concerns — I plan for both."

#### The Day-1 audit isn't a day's work — it's an hour

Auditing the 12 patterns is **30–60 minutes with the team**, in parallel with the Flink telemetry audit. **Not the whole day.** Day 1 looks roughly like:

| Time | Activity |
|---|---|
| Morning | 1:1 with the TM (~30 min) |
| Late morning | Team meeting — audit the 12 patterns (~1 hour) |
| Afternoon | Pair with the tech lead on Flink telemetry (~3–4 hours) |
| End of day | Scope-lock with the PM, in writing |

The audit pays for itself many times over — without it, my scope-lock with the PM is a **fiction** (you can't commit to "ship 1, defer 11" if 6 of the 11 are duplicates and 3 have no data). And it's a **coaching moment** — the team learns the discipline of auditing scope before every sprint. **30 minutes of audit saves three months of confused planning.**

#### Three pre-negotiated off-ramps for Day 2 / Day 3

I **don't wait for things to go wrong**. The off-ramps are agreed with the PM on Day 1, so descope isn't a surprise — it's the plan.

**Off-ramp 1 — Day-2 midday checkpoint**
If we're not on track by noon Day 2, we descope **again**. "The working version" doesn't have to be production-grade — it's the **minimum skeleton that tells the story**: one pattern, one happy path, one fixture. Most of the buffer is here.

**Off-ramp 2 — Drop live demo, show a recording instead**
If by Day-3 dry-run the live demo isn't solid: we **don't fake it**. We show a recorded walkthrough, or screenshots with a clean narrative, or a SQL-output capture from the working test. **Better to show something solid that isn't live than to risk a live demo that fails.** Same fallback principle as Slide 11's POC.

**Off-ramp 3 — Honest work-in-progress, with a plan**
Worst case: we report what was actually done plus a clear next-sprint plan. *"We identified the architecture issue, de-risked scope from 12 to 4, prototyped pattern #1 — next sprint we ship it cleanly."* A review is a **checkpoint, not a performance**. What I won't do is fake a demo or hide the truth from the director.

#### The Staff move: pre-negotiate, don't fire-fight

On Day 1, the PM hears it explicitly:
> *"If we can't ship a live demo by Day 3, the floor is a recorded walkthrough plus the audit findings. That's not failure — that's the plan we agreed on."*

PM agrees on Day 1 → Day-3 descope, if it happens, **runs by the playbook**, not as a surprise.

#### Speakable English (when asked: "what if Day 2 doesn't finish?")

> "I plan three off-ramps before I start.
>
> **One** — Day 2 has a midday checkpoint. If we're not on track by noon, we descope again. 'The working version' is the minimum skeleton that tells the story — one pattern, one happy path.
>
> **Two** — if even that isn't solid by Day 3, **no live demo**. A recorded walkthrough, screenshots, or a clean SQL output. **Better to show something solid that isn't live than to fake a live demo.**
>
> **Three** — worst case, honest work-in-progress with a clear next-sprint plan. **A review is a checkpoint, not a performance.**
>
> The critical move: I pre-negotiate these off-ramps with the PM **on Day 1**, so a Day-3 descope isn't a surprise — it's the plan we already agreed on."

**Memorable lines:**
- "**A review is a checkpoint, not a performance.**"
- "**Better to show something solid that isn't live than to fake a live demo.**"
- "**Pre-negotiate the off-ramps, don't fire-fight at Day 3.**"

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) (the 3-day plan + descope playbook)

[↑ Back to top](#contents)

---

### Q12c. Handling the engineer who wants to start over

> *There's an engineer on the team who wants to throw it out and start over with something simpler. How do you handle them?*

> "**I take them seriously, I bring them in, and I let the data decide — not me.** Three things they are NOT going to hear from me: 'we already invested in Flink,' 'just trust the team's choice,' or 'wait until the sprint is done.' All three would tell a thoughtful engineer that they're not welcome — and they'd be right."

#### How I'd actually handle this through the 3 days

**Day 1 — private 1:1 with them (right after the TM 1:1)**

A 15-30 minute conversation that says, in plain words:

> *"I heard your view that we should start over with something simpler. I take that seriously, and I want to understand it. Here's what I'm doing today — auditing Flink telemetry, measuring real throughput, looking at the patterns we're chasing. **Would you pair with me on it?** If the data supports your view, **you lead the v2 architecture RFC**. If it doesn't, we'll walk the data together so you know I heard you. Either way — you have a seat at the table."*

→ The point: **don't convince them, invite them to verify**. Pair them on the audit. They get the data, not me.

**Day 2 — they're in the scope-cut conversation**

Not informed, **included**. Their take on which one pattern to ship, what to defer, what to merge — heard.

**Day 3 — they present part of the team's findings**

The team presents at the review; this engineer **owns the audit narrative**. Either:
- Data supports them → *"My hypothesis was X. The data shows we should re-evaluate the architecture over the next 30 days."*
- Data doesn't → *"My hypothesis was X. The data suggests Y — so we're focusing there."*

Either way, **they're a contributor on stage, not a dissenter in the back row.**

#### Over the next 30 days

If data supports their view → **they lead the v2 RFC**. They get public credit on Day 30 for spotting it early. The Flink work is framed as *"not wasted — it surfaced the real event rate and data-quality issues."* TM doesn't lose face (decisions get re-evaluated with data — that's the system working). I own the lesson: *"I should have pushed measure-first 30 days earlier."*

If data refutes their view → **they're the most credible voice for the current architecture** — because they're the one who actively tried to disprove it. They don't lose face either: rigorous work, different conclusion.

#### In the leadership brief

Mention them — positive framing:

> *"We have an engineer pushing for architectural change. They're leading our 30-day evaluation — bringing data instead of opinions."*

→ The Director hears: **this Staff turned an internal dissenter into a productive force.**

#### Why this is the Staff move (vs Senior or Junior)

| Role | Typical reaction |
|---|---|
| **Junior** | Ignore them ("we'll deal with it later") → team splits |
| **Senior** | Argue them down ("we already chose Flink") → silent resentment |
| **Staff** | **Invite them to verify with data → either vindicate them or have them disprove themselves** |

A team that handles dissent this way is a team that **doesn't repeat the next bad architectural decision** — because the loudest critic has been heard.

#### Speakable English

> "Three things I won't say to them: 'we already invested in Flink,' 'trust the team,' or 'wait till the sprint is done.' All three tell a thoughtful engineer they're not welcome.
>
> Instead — on Day 1, I'd have a private 1:1. I tell them I take their view seriously. I invite them to **pair on the audit with me**. If the data supports them, they **lead the v2 architecture RFC**. If it doesn't, we walk the data together so they know I heard them.
>
> Day 2, they're in the scope-cut conversation — not informed, included. Day 3 at the review, they present part of the team's findings. They're a contributor on stage, not a dissenter in the back row.
>
> The principle: **don't argue them down, invite them to verify**. A team that handles dissent like that doesn't repeat the next bad architecture decision."

**Memorable lines:**
- "**Don't argue them down — invite them to verify.**"
- "**If the data supports their view, they lead the v2 RFC. Either way, they have a seat at the table.**"
- "**A team that handles dissent well doesn't repeat the next bad decision.**"

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) (team dynamics) · [`en/technical-leadership.md`](./en/technical-leadership.md) (handling disagreement)

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

### Q14b. When *do* you actually need Flink? (concrete decision criteria)

> *OK but concretely — what numbers and characteristics tell you "use Flink" vs "Kafka Streams" vs "just a Kafka consumer"?*

> "It's not just throughput — it's **throughput × state × latency × exactly-once**. Throughput alone is a poor signal.
>
> My rule of thumb:
>
> | Event rate (sustained) | State / windows? | Likely right tool |
> |---|---|---|
> | < 100 / sec | Stateless filter / transform | **Plain Kafka consumer** — one worker, no framework |
> | < 100 / sec | Simple windows or counts | **Kafka Streams** — embedded library, no separate cluster |
> | 100 – 1,000 / sec | Stateful, simple | **Kafka Streams** — still fits |
> | 100 – 1,000 / sec | Stateful + event-time + exactly-once | **Flink** earns its place |
> | > 1,000 / sec sustained | Almost always stateful | **Flink** (or Spark Streaming) |
> | > 10,000 / sec | Real-time + complex DAG | **Flink** is the standard answer |
>
> But the **deciding factors** beyond raw rate:
>
> - **Event-time + late events** matter? Flink's watermarks are first-class; alternatives bolt it on.
> - **Exactly-once across many operators?** Flink does this with checkpoints; harder elsewhere.
> - **Massive keyed state** (gigabytes to terabytes)? Flink + RocksDB scales there; Kafka Streams' local state is fine for smaller.
> - **Operational complexity tolerance?** A Flink cluster needs SRE love. A Kafka consumer is just a deployment.
>
> For **this team's situation**: prompt gives no rate. Delivery events alone are ~20/sec — a plain Kafka consumer handles that with room to spare. With GPS pings, it could be 1,000–3,000/sec — that's where Flink starts to be defensible, *if* we also need event-time windows and exactly-once.
>
> So my actual answer in the diagnose phase is: **measure the real rate, list the actual state requirements, then pick the simplest tool that handles both.** Flink is a great tool for what it's designed for; using it for tens of events per second is paying a complexity tax for nothing."

**If asked "what would the alternatives look like for this team?":**

> "Two reasonable alternatives if measurement says Flink is overkill:
>
> **Kafka Streams** — an embedded library, no separate cluster. Same Kafka source, same JVM as the app. Supports windows, joins, exactly-once. Operationally: just a deploy. Good for ~100–1,000/sec with state.
>
> **Plain Kafka consumer** — even simpler. One worker reads the topic, applies a rule, writes to a sink. Good for sub-100/sec stateless detection — or stateful with a Redis/Postgres sidecar.
>
> I wouldn't switch in the 3-day window — the crisis is the deadline, not the architecture. But over the **30-day evaluation**, if the data supports it, I'd design a Kafka Streams (or consumer) version, run it **shadow** against Flink to verify output parity, then migrate."

**Memorable one-liners (use these in interview):**
- "Throughput alone is a poor signal — Flink earns its place when you also need event-time, exactly-once, or massive state."
- "Tens per second + simple state → Kafka Streams. Thousands per second + event-time + exactly-once → Flink."
- "Using Flink for tens of events per second is paying a complexity tax for nothing."

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) (when to use Flink) · [`study-notes/flink-kafka-notes.md`](./study-notes/flink-kafka-notes.md) (right-sizing)

[↑ Back to top](#contents)

---

### Q14c. Could Flink SQL simplify this? Are we over-complicating it?

> *The team is using the Flink DataStream API. Could Flink SQL solve this with much less code? Did you consider it?*

> "**Yes — and I think for most of these fraud patterns, SQL would be a serious simplification.** A lot of streaming teams default to the DataStream API and end up with hundreds of lines of Java for what's really an aggregation over a window. Flink SQL handles the common patterns declaratively, and the planner builds the same DAG.
>
> Which is **exactly the kind of guidance** a Staff role should bring — not 'rip out Flink,' but **'are we using it at the right altitude?'**
>
> So I prototyped one. **40 lines of SQL**, runs on real Flink in Docker, covers two of the patterns the team is likely chasing:
>
> **One — stateless rule:** 'completed too far from the destination.' A `SELECT ... WHERE distance > 500m`. No state, no window — just a streaming filter. **Three lines of business logic.**
>
> **Two — stateful + windowed rule:** 'too many deliveries in 20 seconds.' A `TUMBLE` window + `COUNT(*) > 3 GROUP BY courierId`. **Five lines of business logic.** Same thing in DataStream API is at least 50 lines of keyed state and timer management.
>
> Source table has a **watermark** for late-arriving events — also one line in SQL.
>
> So the **proposal to the team** would be: 'before we add the next 9 patterns, let's try writing them in SQL. If they all fit, we cut maintenance significantly. If a couple need the DataStream API, we keep those targeted — most won't.'"

**What fits well in Flink SQL (most fraud patterns):**

| Pattern | SQL surface |
|---|---|
| **Threshold / filter** (distance > X, amount > Y) | `WHERE` clause |
| **Windowed aggregation** (count / sum / avg in window) | `TUMBLE` / `HOP` / `SESSION` + `GROUP BY` |
| **Joins** with reference data (courier profile, merchant blocklist) | `LEFT JOIN ... FOR SYSTEM_TIME AS OF` |
| **Pattern matching** (sequence of events) | `MATCH_RECOGNIZE` (CEP) |
| **Deduplication** | `ROW_NUMBER() OVER (PARTITION BY ...)` |

**What still needs the DataStream API:**

- Highly custom state machines (e.g., per-courier evolving fraud score with non-window-based updates)
- Custom serialization formats not supported by Flink's table connectors
- Tight integration with external systems that need fine-grained backpressure control
- Operations Flink hasn't shipped a SQL function for yet (rare for common patterns)

**The Staff framing for the team:**

> *"Start every new fraud rule in SQL. Drop to DataStream API only when you hit a wall — and then write down what wall. After a quarter, look at the list of 'walls' and decide if there's a real pattern or if it was case-by-case."*

→ This is **right-sizing through tooling**, not just throughput. **A team writing 200 lines of Java for a windowed count is paying a complexity tax they don't need to pay.** Same engine, much less code.

**Memorable lines (use these if asked):**
- "**Same Flink engine, much less code.** The planner builds the same DAG, but you maintain 40 lines instead of 400."
- "**Start every new rule in SQL. Drop to DataStream only when you hit a wall, and write down what wall.**"
- "**Maybe we're not over-Flink-ed; we're over-DataStream-API-ed.** A simpler interface to the same engine."

📄 [`flink-kafka-docker/sql/fraud.sql`](./flink-kafka-docker/sql/fraud.sql) (40-line prototype) · [`flink-kafka-docker/README.md`](./flink-kafka-docker/README.md) (how to run it) · [`study-notes/flink-kafka-notes.md`](./study-notes/flink-kafka-notes.md) (concept review)

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

> "Honestly, the mobile complexity and the governance. C asks the mobile team to build and maintain a registry, and it asks us to run a review board to keep it under control. Those are real costs. If the business only ever needed two or three fixed layouts, A would be simpler, and I'd pick A. I chose C because the business wants lots of experiments — but I hold that view loosely, and the POC is there to check it."

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
