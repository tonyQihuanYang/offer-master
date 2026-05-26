# Presentation — Slides + Script, page by page

> 每页两块:**🖥️ On screen**(幻灯片上显示什么)+ **🗣️ Say**(逐字照念)。
> 放映用 `slides/interview.en.html`;这份是"对着 slide 念什么"。
> `[▶ DEMO]` = 切运行中的 demo;**加粗引号**的三句要背熟(放慢、坚定)。
> 节奏:UC1 ~30min · UC2 ~20min · 全程欢迎提问。
>
> 📣 **英文是短句口语版** —— 一句一个意思,好记好说。卡住就慢下来、看 slide 一眼、再继续。

---

## Slide 1 / 24 — Title

**🖥️ On screen:** *Courier Offer System Modernization & Real-time Fraud Detection Team Guidance* — Staff Engineer.

**🗣️ Say:**
> "Hi everyone, thanks for having me. We have the hour for both cases. I'll spend about **30 minutes** on the courier offering system, and **20** on the fraud detection one. Please jump in with questions any time — I'd rather make this a conversation than a one-way talk.
> One thing up front. My read on Staff is two things. **First, driving decisions through influence, not authority.** **Second, being hands-on — building POCs and failing fast.** I'll answer both cases that way. And for the first one, I actually built a small running prototype."

---

## Slide 2 / 24 — Agenda

**🖥️ On screen:** UC1 (~30 min): Decision → System Design → Leadership → Migration. UC2 (~20 min): Diagnose · Guide · 3-day · KT · Work with TM.

**🗣️ Say:**
> "For Use Case 1, in this order. First, the **technical decision** — I'll evaluate the approaches and recommend one. Then the **system design** of what I picked. Then **leadership** — how I'd bring the mobile team along. And finally **migration** — metrics and rollback. For Use Case 2: diagnose, guide without solving, the three-day plan, knowledge transfer, and working with the Tech Manager.
> Quick note — why decision before design? Because you can't design a system you haven't decided on. So the recommendation comes first, and the design backs it up."

---

## Slide 3 / 24 — Use Case 1 (section title)

**🖥️ On screen:** *Use Case 1 — Courier Offering System Modernization.*

**🗣️ Say:**
> "Okay — Use Case 1. Modernizing the courier offering system."

---

## Slide 4 / 24 — Problem & Constraints

**🖥️ On screen:** 15 countries · 50k couriers · 2M/h (~556 RPS) · 200ms p95 (today ~180 → ~20ms headroom) · today = one hardcoded template, zero experimentation.

**🗣️ Say:**
> "Here's the situation. 15 countries. Over 50,000 couriers. Two million offers an hour at peak — about 556 a second. The SLA is **200 milliseconds at p95**, and we're already at ~180 today. So realistically, we only have about **20 milliseconds of headroom**. I'll come back to that number a lot.
> Today, there's one hardcoded offer template. Earnings logic is spread across three services. Every change is a full multi-region deploy. And there's **no experimentation at all**.
> The key thing: the pain isn't performance — it's **rigidity**. Nothing can change. Nothing can be tested.
> One more thing. The system is **already event-driven and distributed** — SQS, Temporal, AppSync on AWS. It already pushes structured JSON to mobile. So my answer is going to be an **evolution, not a rewrite**."

---

## Slide 5 / 24 — Technical Decision: A vs B

**🖥️ On screen:** A vs B table (experiment speed / 200ms risk / native UX / consistency / mobile complexity). "Neither alone wins."

**🗣️ Say:**
> "The prompt gives me two options. Let me evaluate them fairly.
> **Approach A** is a server-side template engine. The server pre-renders the finished text. The mobile app just paints it. The good: experiments are fast — no app release needed. The bad: at two million an hour, the server is rendering on the hot path — that's a real **200ms risk**. And the native experience is poor.
> So **A trades native UX and latency for experiment speed**.
> **Approach B** is the opposite. The server sends raw data. Mobile owns all the layout. The good: native UX is great, the backend stays light. The bad: every layout experiment needs an app-store release. iOS and Android drift. Mobile complexity grows without limit.
> So **B trades experiment speed and consistency for native UX**.
> *[pause]* Neither alone wins. A gives up UX and latency. B gives up experiments and consistency.
> Which forces the question — **is there a third way?**"

---

## Slide 6 / 24 — Approach C (Hybrid) ✅ *the reveal*

**🖥️ On screen:** From A: server controls what+order (no release). From B: native render. One line: server decides what+order, mobile decides how. B-vs-C diff. Honest cost.

**🗣️ Say:**
> "There is — **Approach C, a hybrid**. It takes the best of both.
> **From A**, the server controls **what** components show and **in what order**. So we experiment without an app release. **From B**, the mobile app renders them **natively**. So the UX stays great.
> One line, this is my north star: **the server decides what and in what order. Mobile decides how it looks.** Through a small registry of 10 to 15 components.
> If you ask how this is different from B — the one real difference is *who owns the layout*. In B, it's app logic. In C, it's data the server sends. So C is B plus a server-controlled layout, with the experiment moved to the server.
> Honest cost. C needs an upfront contract and component governance. And changing an existing component still needs a release or dual-emit. Not free — but the right trade."

---

## Slide 7 / 24 — System Design (Hybrid) — *flow diagram*

**🖥️ On screen:** flow: event → Experiment Resolver → Earnings → Layout Composer → Payload Builder → SQS/AppSync/SSE → mobile registry. + "won't tail-spin" bullet.

**🗣️ Say:**
> "Now that we've picked C, here's how it's built. Four new components inside the existing offer service, right after the Temporal step that returns pay and bonus.
> First, an **Experiment Resolver**. It picks the variant using a deterministic sticky hash on the courier ID. Same courier, same variant, every time. If the flag service is slow or down, it fails closed to control.
> Second, an **Earnings Calculator**. It unifies flat, distance, surge, and tips. Just compute — the data is already fetched.
> Third, a **Layout Composer**. It picks the components and hints from config.
> Fourth, a **Payload Builder**. It replaces the hardcoded template — and branches by app version, so old apps get the legacy format.
> Two things I want to call out. **One: every component has a latency budget and a failure mode** — fail-closed, dual-write, idempotency, a sticky hash that doesn't depend on a cache. **Two: on latency**, this adds about 10 milliseconds, inside our 20. And it **won't tail-spin** under load — everything's in-process and cached, no network calls on the hot path. A flag-service outage fails closed. **No new dependency can blow the SLA.**"

---

## Slide 8 / 24 — Latency Budget — estimate, then measure

**🖥️ On screen:** per-component table (sub-ms real vs ~3/3/2/2ms budget; total ~1–3ms real / ~10ms budget). "Budgets, not measurements." Temporal ~150ms dominates.

**🗣️ Say:**
> "A quick word on those numbers, because someone usually asks. **They're budgets, not measurements.** I took the ~20ms of headroom and split it into a ceiling per component. The real hot path is well under a millisecond — a hash and a cached lookup. The budget just leaves room for cache misses, GC, and serialization.
> For scale: the Temporal pay-and-bonus step is about 150 milliseconds. So these four are tiny next to it.
> Before rollout, I'd load-test on a real cluster and replace these with measured p95. If it ever creeps toward the budget, I'd move the resolution off the request path and precompute. **I wouldn't present an estimate as a fact.**"

*(主线讲 ~20 秒带过;被追问"3ms 怎么来的"再展开。)*

---

## Slide 9 / 24 — The Payload Contract

**🖥️ On screen:** trimmed JSON (experiment / layout.components+hints / data). Same delivery, different layout per market. Layout embedded per offer.

**🗣️ Say:**
> "Here's the contract, concrete. The server sends three things. The **layout** — which components, in what order. The **raw data**. And a few **hints**. Mobile renders it through the registry.
> One nice property: the same delivery can go out with a different layout and a different earnings model per market — Switzerland, the UK, Canada — all from config. And unknown components are skipped, so older apps stay safe."

---

## Slide 10 / 24 — ▶ Live POC

**🖥️ On screen:** screenshot of the client offer + payload inspector. ▶ LIVE: /admin · /client · /approaches.

**🗣️ Say:**
> "This isn't just on paper — **I built a running prototype**. Let me show you.
> [▶ DEMO]
> On the admin page, I change the layout and hit save — live, no deploy. On the client, the offer is **pushed** down a stream. The same courier always resolves to the same variant by hash. And here's all three approaches side by side — A sends finished strings, B sends raw data plus flags, C sends a layout plus data.
> [back to slides]
> This is the **hands-on, fail-fast piece**. I'd rather show a small running thing than just describe it."

---

## Slide 11 / 24 — Technical Leadership

**🖥️ On screen:** *Mobile worried C adds complexity — how do you facilitate?* Principle: validate, then sharpen. 3 steps (acknowledge / working session + bounded mitigations / mobile-led reversible proof). "influence, not authority."

**🗣️ Say:**
> "Now the leadership question. Mobile is worried that C adds complexity for them. Honestly, they're right to worry.
> My principle is: **first, I agree the concern is real. Then I make it specific.** It's not *whether* it adds complexity — it's *how much, what kind, and what's on the other side*.
> So three steps. **First**, I acknowledge it in writing — to frame it as **us vs the problem**, not me vs them. **Second**, a real working session — not a presentation — where mobile tells me what 'complexity' actually means. And I bring **concrete fixes that cap the cost**: a locked registry of 10–15 components, code-gen for the schema, the app skipping components it doesn't know, a shared RFC we co-write. **Third**, instead of a vote — a **small POC the mobile team leads**. One zone, one component, four weeks. Easy to undo. That's the fail-fast move. And I say upfront how we'd escalate if we still disagree — so nobody feels trapped.
> This is the JD's **influence, not authority**. I can't pull rank. I make the trade-offs clear, so they reach the answer with me."

---

## Slide 12 / 24 — The closing posture *(memorize)*

**🖥️ On screen:** the leadership quote (large).

**🗣️ Say (slow, firm, ~脱稿):**
> **"My job isn't to win the architecture argument — it's to make the team that builds and runs this a co-author of the decision. I'd push for C, but I'd rather ship B with mobile fully bought in than ship C with mobile going along but quietly resentful."**

---

## Slide 13 / 24 — Migration & Metrics

**🖥️ On screen:** 4 phases (no-op → dual payload → flag rollout → experiment live). Metrics table (SLA / business per-variant / experiment / migration). Rollback.

**🗣️ Say:**
> "Migration is reversible at every step. Four phases. **Phase one**: a no-op foundation — zero behavior change, verified in shadow mode. **Phase two**: dual payloads — old and new in parallel. **Phase three**: flag rollout, from 1% to 100% per city. **Phase four**: experiments go live.
> Metrics in four buckets. **SLA** — p95 and p99. **Business metrics, read per variant** — acceptance rate, time to accept, dispute rate. We watch for **regression**, not just lift. **Experiment health**. And **migration progress**.
> The principle: **any step rolls back in seconds**. Dual-write means mobile always has the old field to fall back to."

---

## Slide 14 / 24 — Use Case 1 in one line

**🖥️ On screen:** the UC1 one-liner quote.

**🗣️ Say:**
> "In one line: I recommend the hybrid. **Server controls layout and experiments. Mobile renders natively.** It gives us experiment speed *and* native UX, inside the 200ms / 2M-an-hour budget. It evolves the existing event-driven system. It migrates with instant rollback. And the real Staff work is making mobile a **co-author** of that decision."

---

## Slide 15 / 24 — Use Case 2 (section title)

**🖥️ On screen:** *Use Case 2 — Real-time Fraud Detection, Team Guidance.*

**🗣️ Say:**
> "Okay — Use Case 2. A four-person team building real-time fraud detection. And they're in trouble."

---

## Slide 16 / 24 — The Situation

**🖥️ On screen:** 4 eng · Kafka+Flink · 45s vs <5s · scope 3→12 · review in 3 days, nothing to demo. Principle: the crisis is the deadline, not the architecture.

**🗣️ Say:**
> "Quick recap. Four engineers. Kafka and Flink. 45-second latency, against a 5-second target. Scope crept from 3 patterns to 12. Nothing to demo in three days. Low morale.
> My core principle: **the crisis is the deadline, not the architecture.** The common Staff mistake is to charge in, rewrite it, and 'save' the sprint. That solves the demo and breaks the team. The harder, right move is to buy time, narrow scope, coach, and let them ship something they understand.
> And the engineer who wants to start over with something simpler — they might be right. I'd take that seriously."

---

## Slide 17 / 24 — Staff vs Tech Manager

**🖥️ On screen:** RACI table (TM owns scope/PM/morale; Staff owns architecture/testing/RFC; shared narrative/escalation). First 30 min = 1:1 with TM.

**🗣️ Say:**
> "First, I'd draw the line with the Tech Manager. The prompt says clearly I work *with* them, not as them.
> **Scope, deadlines, the PM conversation, morale — that's theirs.** **Architecture, testing, RFCs, mentorship — that's mine.** The review story and escalation — together.
> So my literal first 30 minutes is a one-on-one with the TM, to agree on exactly that. The trap is stepping into their job. Using their authority without coordinating undermines them."

---

## Slide 18 / 24 — Diagnose — ask, don't lead

**🖥️ On screen:** buckets: architecture (45s — measured?), the big one (Flink right for our rate? no number given → measure), scope, data quality, testing.

**🗣️ Say:**
> "Diagnosis — and the goal is to **ask questions that turn symptoms into causes**. I don't feed them the answer.
> On the 45 seconds: *'Walk me through the data flow end to end. Where's the time going — measured, or assumed? Any synchronous I/O in an operator? What's the parallelism and the watermark strategy?'*
> And the big question: *'Is Flink even right for our event rate — have we measured it?'* The prompt gives no number. Delivery events are maybe 20 a second. But GPS pings could push it to a few thousand. And the platform already handles hundreds a second for offers. So the range goes from overkill to justified — **measure first, don't assume.**
> I'd ask these in waves, not 30 at once. The questions are the coaching."

---

## Slide 19 / 24 — The 3-day plan — ruthlessly descope

**🖥️ On screen:** ship 1 pattern (">500m from destination"). Day 1 TM 1:1 + audit Flink telemetry + scope-lock in writing. Day 2 skeleton + fixture. Day 3 dry run + pre-brief director. Team presents.

**🗣️ Say:**
> "For three days, the big call is: **cut scope, hard.** Ship one pattern that tells the story — 'marked complete more than 500 meters from destination.' The data's there. It's a distance calculation. Runs well under five seconds.
> But I'm not just cutting business scope to dodge the real problem. So day one, I'd also pair with the tech lead to **audit the Flink telemetry**. Is the 45 seconds bad watermark generation? Or a synchronous DB call inside an operator? We narrow scope *and* find the root cause.
> **Day 1**: align with the TM, do the walk-through, and lock the scope in writing with the PM. **Day 2**: pair to a working skeleton and the first test fixture. **Day 3**: a dry run where the **team** presents, and the TM and I pre-brief the director.
> At the review, **I sit in the audience**. The team gets the credit. Avoid a half-working live demo that fails."

---

## Slide 20 / 24 — Guide without solving

**🖥️ On screen:** pair not solve · whiteboard principles · review in questions · they write RFC. Worked example: 45s latency (Senior verdict vs Staff questions).

**🗣️ Say:**
> "How I guide without taking over. **I pair, but they drive the keyboard.** I whiteboard principles, not fixes. My code review comments are questions — *'what happens if this is null?'* — not instructions.
> Example — the 45-second latency. **The Senior move:** *'It's backpressure. Add async I/O and double the parallelism.'* **The Staff move:** *'What's the latency breakdown? What does the metric say? How would we confirm? Let's run it — what would the result tell us?'* Same destination — but the second one teaches the debugging method.
> One caveat: I don't withhold facts just to be pure. If they ask 'milliseconds or seconds for checkpoints?' — I just answer."

---

## Slide 21 / 24 — Long-term knowledge transfer (30/60/90)

**🖥️ On screen:** 30d study group + SMEs; 60d toy project + v2 RFC; 90d each teaches one concept + name an SME. Don't let them learn in isolation.

**🗣️ Say:**
> "Longer term — this is what prevents the next three-day crisis. Over **30 days**, a streaming study group and outside experts. Over **60**, each engineer builds a small Flink toy project, and the team writes the v2 RFC. Over **90**, each engineer **teaches one concept back** — watermarks, backpressure — because **teaching is when they really own it**.
> Key principle: don't let them learn alone. If another team runs production streaming, I set up that connection. **Cross-team learning beats self-study.**"

---

## Slide 22 / 24 — Working with TM / Principals / Leadership

**🖥️ On screen:** TM (daily 15-min, never go around). Principals (early second opinion). Leadership (get ahead, brief jointly — the air-cover quote).

**🗣️ Say:**
> "With the TM, a **daily 15-minute check-in** during the crunch. Architecture runs through me. Scope stays with them. And I **never go around them** to the engineers.
> With Principals, I pull them in early for a second opinion. Not to do the work for me. Not as backup over my TM.
> With leadership, **I get ahead of the escalation**. Before the PM frames it, the TM and I brief them together: *'The team picked Flink for a workload that, at the rate we measured, is well below its design point. They're paying a complexity tax. We've descoped to one pattern. We'll evaluate the architecture over 30 days. We'd like your air cover with the PM.'*
> And if the 'start over' engineer turns out to be right — I praise them publicly. I frame the Flink work as not wasted. And I own the lesson."

---

## Slide 23 / 24 — Use Case 2 posture *(memorize)*

**🖥️ On screen:** the UC2 posture quote (large).

**🗣️ Say (slow, firm, ~脱稿):**
> **"My role is to make the team better at this — not to do the work for them. The three-day deadline is a constraint to navigate, not a performance to deliver. If I do my job right, this team handles the next streaming project without a Staff parachute."**

---

## Slide 24 / 24 — Closing *(memorize the last line)*

**🖥️ On screen:** two postures; "influence, not authority · fail fast · hands-on POCs." Thank you + Q&A.

**🗣️ Say:**
> "To close — two postures, one standard. On the offering system, the Staff work was making the team a **co-author**. On the fraud team, it was **leverage over time, not heroics**.
> **I answered both the same way — influence not authority, fail fast, hands-on POCs. That's my read on Staff, and what this role calls for.**
> Thank you. I've got deeper detail on any of it, plus a running prototype — happy to go wherever's useful."

---

## 练习提示

- 一手开 `slides/interview.en.html`(F 全屏)、一手开这份 —— 翻一页念一页。
- 第一遍**读顺**;第二遍**计时**(UC1 ~30 / UC2 ~20);第三遍**脱稿**(只死背 Slide 12 / 23 / 24 的金句)。
- **转场词别省:** *"Here's the situation / One line is / Now that we've picked C / In one line / To close"* —— 这些短词组帮你从一页过到下一页。
- `[▶ DEMO]`:只点不改,起不来就讲截图。
- **卡住别慌:慢下来、看 slide 一眼、用自己的话继续。** 中间停顿 1–2 秒是稳,不是错。
- **金句**(Slide 12 / 23 / 24)放慢、坚定 —— 这三句要让面试官**听完记住一句**。
