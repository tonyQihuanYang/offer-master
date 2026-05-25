# Presentation — Slides + Script, page by page

> 每页两块:**🖥️ On screen**(幻灯片上显示什么)+ **🗣️ Say**(逐字照念)。
> 放映用 `slides/interview.en.html`;这份是"对着 slide 念什么"。
> `[▶ DEMO]` = 切运行中的 demo;**加粗引号**的三句要背熟(放慢、坚定)。
> 节奏:UC1 ~30min · UC2 ~20min · 全程欢迎提问。

---

## Slide 1 / 24 — Title

**🖥️ On screen:** *Courier Offer System Modernization & Real-time Fraud Detection Team Guidance* — Staff Engineer.

**🗣️ Say:**
> "Hi, thanks for having me. We've got the hour for both cases. I'll take roughly **30 minutes** on the courier offering system and about **20** on the fraud-detection one — but please jump in with questions any time; I'd rather this be a conversation than a monologue.
> One framing up front: to me, Staff engineering is two things — driving technical decisions through **influence, not authority**, and being **hands-on: building POCs and failing fast**. I'll answer both cases to that standard, and I actually built a small running prototype for the first one."

---

## Slide 2 / 24 — Agenda

**🖥️ On screen:** UC1 (~30 min): Decision → System Design → Leadership → Migration. UC2 (~20 min): Diagnose · Guide · 3-day · KT · Work with TM.

**🗣️ Say:**
> "For Use Case 1, in this order: first the **technical decision** — evaluate the approaches and recommend one with the reasons; then the **system design** of what I picked; then **leadership** — how I'd bring the mobile team along; and finally **migration** — metrics and rollback. For Use Case 2: diagnose, guide without solving, the three-day plan, knowledge transfer, and working with the Tech Manager.
> One note on why decision before design: you can't design the system until you've chosen the approach — so the recommendation is my thesis, and the design backs it up."

---

## Slide 3 / 24 — Use Case 1 (section title)

**🖥️ On screen:** *Use Case 1 — Courier Offering System Modernization.*

**🗣️ Say:**
> "Okay — Use Case 1, modernizing the courier offering system."

---

## Slide 4 / 24 — Problem & Constraints

**🖥️ On screen:** 15 countries · 50k couriers · 2M/h (~556 RPS) · 200ms p95 (today ~180 → ~20ms headroom) · today = one hardcoded template, zero experimentation.

**🗣️ Say:**
> "Here's the situation. 15 countries, 50,000-plus couriers, two million offers an hour at peak — about 556 requests a second. The SLA is 200 milliseconds at p95, and we're at ~180 today, so realistically there's only about **20 milliseconds of headroom** — I'll come back to that a lot.
> Today there's one hardcoded offer template, earnings logic across three services, and every change is a full multi-region deploy. No experimentation at all.
> The key thing: the pain isn't performance — it's **rigidity**. And the system is **already event-driven and distributed** — SQS, Temporal, AppSync — and already pushes structured JSON to mobile. So my answer is an **evolution, not a rewrite**."

---

## Slide 5 / 24 — Technical Decision: A vs B

**🖥️ On screen:** A vs B table (experiment speed / 200ms risk / native UX / consistency / mobile complexity). "Neither alone wins."

**🗣️ Say:**
> "The prompt frames this as two options. Side by side, honestly:
> **Approach A**, the server-side template engine: experiments are fast, but the server renders everything — so at two million an hour that's compute on the latency path, the native experience is poor, and mobile just paints boxes.
> **Approach B**, raw data with mobile presentation: native UX is great and the backend is light — but every layout experiment needs an app-store release, and iOS/Android consistency is hard.
> So neither alone wins. A buys experiment speed but gives up the native feel and risks the SLA; B keeps the feel but loses experiment velocity. [pause] That tension points to a third option."

---

## Slide 6 / 24 — Approach C (Hybrid) ✅ *the reveal*

**🖥️ On screen:** From A: server controls what+order (no release). From B: native render. One line: server decides what+order, mobile decides how. B-vs-C diff. Honest cost.

**🗣️ Say:**
> "So I'd propose a hybrid — Approach C — that takes the best of both.
> **From A**, the server controls *what* components show and *in what order* — so we experiment without an app release. **From B**, the mobile app renders them **natively** — so the UX stays great.
> One line: **the server decides what and in what order; mobile decides how it looks** — via a small registry of 10–15 components.
> If asked how this differs from B specifically: the one real difference is *who owns the layout*. In B that's app logic on mobile; in C it's data the server sends. So C is B plus a server-controlled layout descriptor, with experiment assignment moved server-side.
> And the honest cost: C needs an upfront contract and component governance, and changing an existing component still needs a release or dual-emit. Not free — but the right trade."

---

## Slide 7 / 24 — System Design (Hybrid) — *flow diagram*

**🖥️ On screen:** flow: event → Experiment Resolver → Earnings → Layout Composer → Payload Builder → SQS/AppSync/SSE → mobile registry. + "won't tail-spin" bullet.

**🗣️ Say:**
> "Now that we've picked C, here's how it's built. Four components inside the existing offer service, right after the Temporal workflow returns pay and bonus.
> An **Experiment Resolver** — assigns the variant via a deterministic sticky hash of the courier ID, so the same courier always lands in the same variant, and if the flag service is down it fails closed to control.
> An **Earnings Calculator** — unifies flat, distance, surge, and tips; compute only, the data's already fetched.
> A **Layout Composer** — emits the component list and hints from config.
> And a **Payload Builder** — replaces the hardcoded template, version-branched so old apps get the legacy format.
> Two things I'd emphasize as distributed-systems design: every component has a **latency budget and a failure mode** — fail-closed, dual-write, idempotency, a sticky hash that doesn't depend on a cache.
> And on latency — it adds about 10 milliseconds, inside our 20. It **won't tail-spin** under load, because it's all in-process and cached — zero network I/O on the hot path — and a flag-service outage fails closed, so no dependency can blow the SLA."

---

## Slide 8 / 24 — Latency Budget — estimate, then measure

**🖥️ On screen:** per-component table (sub-ms real vs ~3/3/2/2ms budget; total ~1–3ms real / ~10ms budget). "Budgets, not measurements." Temporal ~150ms dominates.

**🗣️ Say:**
> "A quick word on those millisecond numbers, because someone usually asks how I got them. **They're budgets, not measurements** — I carved the ~20ms of headroom into a ceiling per component. The real hot path is sub-millisecond — a hash and a cached lookup — and the budget just absorbs cache misses, GC, and serialization.
> For scale: the Temporal pay-and-bonus step is about 150 milliseconds, so these four are a rounding error.
> Before rollout I'd load-test on a real cluster and replace these with measured p95 — and if it ever creeps toward the budget, I move the resolution off the request path and precompute. I wouldn't present an estimate as a fact."

*(主线讲 ~20 秒带过;被追问"3ms 怎么来的"再展开。)*

---

## Slide 9 / 24 — The Payload Contract

**🖥️ On screen:** trimmed JSON (experiment / layout.components+hints / data). Same delivery, different layout per market. Layout embedded per offer.

**🗣️ Say:**
> "Here's the contract made concrete. The server sends three things: the **layout** — which components, in order — plus the **raw data**, plus a few **hints**. Mobile renders it through the registry.
> The nice property: the same delivery can go out with a different layout and a different earnings model per market — Switzerland, the UK, Canada — all from config. And unknown components are skipped, so older apps stay safe."

---

## Slide 10 / 24 — ▶ Live POC

**🖥️ On screen:** screenshot of the client offer + payload inspector. ▶ LIVE: /admin · /client · /approaches.

**🗣️ Say:**
> "And this isn't just on paper — I built a running prototype. Let me show you.
> [▶ DEMO]
> On admin, I change the layout and hit save — live, no deploy. On the client, the offer is **pushed** down a stream, and the same courier always resolves to the same variant by hash. And here's all three approaches side by side — you can see A sends finished strings, B sends raw data plus flags, C sends a layout plus data.
> [back to slides]
> This is the hands-on, fail-fast piece — I'd rather show a small running thing than just describe it."

---

## Slide 11 / 24 — Technical Leadership

**🖥️ On screen:** *Mobile worried C adds complexity — how do you facilitate?* Principle: validate, then sharpen. 3 steps (acknowledge / working session + bounded mitigations / mobile-led reversible proof). "influence, not authority."

**🗣️ Say:**
> "Now the leadership question — mobile is worried this adds complexity for them. And honestly, they're right to be.
> My principle is: **validate the concern, then sharpen it.** It's not *whether* it adds complexity — it's *how much, what kind, and what's on the other side*.
> So: I'd acknowledge it in writing first, to make it us-versus-the-problem. Then a real working session — not a presentation — where mobile tells me what 'complexity' actually means, and I bring **bounded** mitigations: a locked registry, code-gen for the schema, forward-compat skipping, a co-owned RFC. Then instead of a vote, a **small, reversible, mobile-led proof** — one zone, one component, four weeks. That's the fail-fast move. And I pre-state the escalation path so nobody feels trapped.
> This is the JD's **influence, not authority** — I can't pull rank; I make the trade-offs clear so they reach the answer with me."

---

## Slide 12 / 24 — The closing posture *(memorize)*

**🖥️ On screen:** the leadership quote (large).

**🗣️ Say (slow, firm, ~脱稿):**
> **"My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision. I'd advocate C, but I'd rather ship B with mobile fully bought in than ship C with mobile compliant but quietly resentful."**

---

## Slide 13 / 24 — Migration & Metrics

**🖥️ On screen:** 4 phases (no-op → dual payload → flag rollout → experiment live). Metrics table (SLA / business per-variant / experiment / migration). Rollback.

**🗣️ Say:**
> "Migration is reversible at every step. Phase one, a no-op foundation — zero behavior change, verified in shadow mode. Phase two, dual payloads. Phase three, flag rollout, one percent to a hundred per city. Phase four, experiments live.
> Metrics, four buckets: SLA — p95 and p99; business metrics **read per variant** — acceptance, time-to-accept, dispute rate, watched for **regression**, not just lift; experiment health; and migration progress.
> The principle: any step rolls back in seconds, because dual-write means mobile always has the old field to fall back to."

---

## Slide 14 / 24 — Use Case 1 in one line

**🖥️ On screen:** the UC1 one-liner quote.

**🗣️ Say:**
> "So in one line: I recommend the hybrid — server controls layout and experiments, mobile renders natively. It buys experiment velocity *and* native UX inside the 200ms / 2M-an-hour budget, evolves the existing event-driven system, and migrates with instant rollback. And the real Staff work is making mobile a co-author of that decision."

---

## Slide 15 / 24 — Use Case 2 (section title)

**🖥️ On screen:** *Use Case 2 — Real-time Fraud Detection, Team Guidance.*

**🗣️ Say:**
> "Okay — Use Case 2. A four-person team building real-time fraud detection, and they're in trouble."

---

## Slide 16 / 24 — The Situation

**🖥️ On screen:** 4 eng · Kafka+Flink · 45s vs <5s · scope 3→12 · review in 3 days, nothing to demo. Principle: the crisis is the deadline, not the architecture.

**🗣️ Say:**
> "Quick recap: four engineers, Kafka and Flink, 45-second latency against a 5-second target, scope crept from 3 patterns to 12, nothing to demo in three days, low morale.
> My core principle: **the crisis is the deadline, not the architecture.** The common Staff mistake is to charge in, rewrite it, and 'save' the sprint — that solves the demo and breaks the team. The harder, right move is to buy time, narrow scope, coach, and let them ship something they understand.
> And the engineer who wants to start over with something simpler might be right — I'd take that seriously."

---

## Slide 17 / 24 — Staff vs Tech Manager

**🖥️ On screen:** RACI table (TM owns scope/PM/morale; Staff owns architecture/testing/RFC; shared narrative/escalation). First 30 min = 1:1 with TM.

**🗣️ Say:**
> "First, I'd draw the line with the Tech Manager — the prompt is explicit that I work *with* them, not as them.
> Scope, deadlines, the PM conversation, morale — that's theirs. Architecture, testing, RFCs, mentorship — mine. The review narrative and escalation, together.
> So my literal first 30 minutes is a one-on-one with the TM to agree exactly that. The trap is stepping into their job — because using their authority without coordinating undermines them."

---

## Slide 18 / 24 — Diagnose — ask, don't lead

**🖥️ On screen:** buckets: architecture (45s — measured?), the big one (Flink right for our rate? no number given → measure), scope, data quality, testing.

**🗣️ Say:**
> "Diagnosis — and the goal is questions that turn symptoms into causes, not leading the witness.
> On the 45 seconds: 'Whiteboard the data flow end to end. Where's the time going — measured or assumed? Any synchronous I/O in an operator? What's the parallelism and watermark strategy?'
> And the big one: 'Is Flink even right for our event rate — have we measured it?' The prompt gives no number. Delivery events are ~20 a second, but GPS pings could push it to a few thousand — and the platform already does hundreds a second for offers. So the range straddles 'overkill' and 'justified' — **measure first, don't assume.**
> I'd ask these in waves, not 30 at once — the questions are the coaching."

---

## Slide 19 / 24 — The 3-day plan — ruthlessly descope

**🖥️ On screen:** ship 1 pattern (">500m from destination"). Day 1 TM 1:1 + audit Flink telemetry + scope-lock in writing. Day 2 skeleton + fixture. Day 3 dry run + pre-brief director. Team presents.

**🗣️ Say:**
> "For three days, the load-bearing decision is to **cut scope, hard.** Ship one pattern that tells the story — 'marked complete more than 500 meters from destination.' Data's there, it's a distance calc, runs well under five seconds.
> But I'm not just cutting business scope to dodge the real problem — so day one I'd also pair with the tech lead to **audit the Flink telemetry**: is the 45 seconds bad watermark generation, or a synchronous DB call inside an operator? We narrow scope *and* find the root cause.
> Day one: align with the TM, that walk-through, and a scope-lock the PM agrees to in writing. Day two: pair to a working skeleton and the first test fixture. Day three: a dry run where the **team** presents, and the TM and I pre-brief the director.
> At the review, I'm in the audience — the team gets the credit. Avoid a half-working live demo that fails."

---

## Slide 20 / 24 — Guide without solving

**🖥️ On screen:** pair not solve · whiteboard principles · review in questions · they write RFC. Worked example: 45s latency (Senior verdict vs Staff questions).

**🗣️ Say:**
> "How I guide without taking over: I pair, but they drive. I whiteboard principles, not fixes. My review comments are questions — 'what happens if this is null?' — not instructions.
> Example — the 45-second latency. The Senior move: 'It's backpressure, add async I/O and double parallelism.' The Staff move: 'What's the latency breakdown? What does the metric say? How would we confirm? Let's run it — what would the result tell us?' Same destination — but the second teaches the debugging method.
> One caveat: I don't withhold facts to be pure. If they ask 'ms or seconds for checkpoints,' I just answer."

---

## Slide 21 / 24 — Long-term knowledge transfer (30/60/90)

**🖥️ On screen:** 30d study group + SMEs; 60d toy project + v2 RFC; 90d each teaches one concept + name an SME. Don't let them learn in isolation.

**🗣️ Say:**
> "Longer term — this prevents the next three-day crisis. Over 30 days, a streaming study group and outside experts. Over 60, each engineer builds a small Flink toy project and the team writes the v2 RFC. Over 90, each *teaches* one concept back — that's when they own it.
> Key principle: don't let them learn in isolation. If another team runs production streaming, I broker that connection — cross-team transfer beats self-study."

---

## Slide 22 / 24 — Working with TM / Principals / Leadership

**🖥️ On screen:** TM (daily 15-min, never go around). Principals (early second opinion). Leadership (get ahead, brief jointly — the air-cover quote).

**🗣️ Say:**
> "With the TM, a daily 15-minute check-in during the crunch — architecture runs through me, scope stays theirs, and I never go around them to the engineers.
> With Principals, I pull them in early for a second opinion and pattern-matching — not to do the work, not as backup over my TM.
> With leadership, I get ahead of the escalation. Before the PM frames it, the TM and I brief them together: 'The team picked Flink for a workload that, at the rate we measured, is well below its design point — they're paying a complexity tax. We've descoped to one pattern, we'll evaluate the architecture over 30 days, and we'd like your air cover with the PM.'
> And if the 'start over' engineer was right — I praise them publicly, frame the Flink work as not wasted, and own the lesson."

---

## Slide 23 / 24 — Use Case 2 posture *(memorize)*

**🖥️ On screen:** the UC2 posture quote (large).

**🗣️ Say (slow, firm, ~脱稿):**
> **"My role is to make the team better at this — not to do the work for them. The three-day deadline is a constraint to navigate, not a performance to deliver. If I do my job right, this team handles the next streaming project without a Staff parachute."**

---

## Slide 24 / 24 — Closing *(memorize the last line)*

**🖥️ On screen:** two postures; "influence, not authority · fail fast · hands-on POCs." Thank you + Q&A.

**🗣️ Say:**
> "To close — two postures, one standard. On the offering system, the Staff work was making the team a co-author. On the fraud team, it was leverage over time, not heroics.
> **I answered both the same way — influence not authority, fail fast, hands-on POCs. That's my read on Staff, and what this role calls for.**
> Thank you — I've got deeper detail on any of it, plus a running prototype, so happy to go wherever's useful."

---

## 练习提示
- 一手开 `slides/interview.en.html`(F 全屏)、一手开这份 —— 翻一页念一页。
- 第一遍读顺;第二遍计时(UC1 ~30 / UC2 ~20);第三遍**脱稿**(只死背 Slide 12 / 23 / 24 的金句)。
- 转场词别省:"Here's the situation / One line is / Now that we've picked C / The line I'd land it on"。
- `[▶ DEMO]`:只点不改,起不来就讲截图。
