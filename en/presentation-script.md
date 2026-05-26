# Presentation Script — verbatim talk track (for speaking practice)

> 这是**逐字英文讲稿** —— 一句句照着念,练英语口语用。
> 配套:幻灯片 `slides/interview.en.md`、大纲 [`presentation-outline.md`](./presentation-outline.md)。
> 📑 **逐页对照版(每页:屏幕显示什么 + 你说什么)**:[`presentation-combined.md`](./presentation-combined.md) ← 练的时候用这个最直观
> `[▶ DEMO]` = 切到运行中的 demo;`[pause]` = 停一拍。说话用缩写、放慢、自然就好。
>
> 📣 **英文已改成短句口语版** —— 一句一个意思,卡住就慢下来、看 slide 一眼、用自己的话继续。

---

## 🖥️ 开场前准备 — 开好这些标签页 + 什么时候切到哪

**面试前就启动 demo(别现场启动)**:
```bash
cd demo && npm run dev      # 让它先跑着(端口看终端,通常 5173/5174)
```

**浏览器开成这几个标签页(按用到的顺序):**

| # | 标签页 | 什么时候切过去 |
|---|--------|---------------|
| 1 | **幻灯片** `slides/interview.en.html`(F 全屏) | 全程主屏 |
| 2 | demo **`/client`** | 讲到 **Slide 10 ▶ Live POC**:点 ⚡ Dispatch → offer 被推进手机 |
| 3 | demo **`/admin`** | 同上:改 layout → Save → 绿 toast(展示"不发版改 UI")|
| 4 | demo **`/approaches`** | 同上:展开 "What's on the wire" 看 A/B/C 三种 payload |
| 5 | **ADR-001 (English)** — `adr/ADR-001-hybrid-sdui.en.md`(GitHub)| UC1 讲完决策/领导力时**闪一下**:"我写成了 ADR" |
| 6 | **RFC skeleton (English)** — `adr/RFC-skeleton-fraud-detection.en.md`(GitHub)| UC2 讲 **Slide 20 Guide without solving** 时展示:"给团队骨架 + 提问,他们填我批注" |
| 7 |(备用)`approach-evaluation.md` | 被追问 A-vs-C / B-vs-C 内部时切过去 |

**切换原则**:幻灯片是主屏;只在 ▶ 处切 demo、被问/到点才闪 ADR/RFC,**看完立刻切回幻灯片**。
**兜底**:demo 起不来 → Slide 10 有截图,照着讲;ADR/RFC 切不过去 → 提一句"我写了 ADR / 给了 RFC 骨架"也拿分。

---

## Slide 1 — Title

> "Hi everyone, thanks for having me. We have the hour for both cases. I'll spend about **30 minutes** on the courier offering system, and **20** on the fraud detection one. Please jump in with questions any time — I'd rather make this a conversation than a one-way talk.
> One thing up front. My read on Staff is two things. **First, driving decisions through influence, not authority.** **Second, being hands-on — building POCs and failing fast.** I'll answer both cases that way. And for the first one, I actually built a small running prototype."

## Slide 2 — Agenda

> "For Use Case 1, in this order. First, the **technical decision** — I'll evaluate the approaches and recommend one. Then the **system design** of what I picked. Then **leadership** — how I'd bring the mobile team along. And finally **migration** — metrics and rollback. For Use Case 2: diagnose, guide without solving, the three-day plan, knowledge transfer, and working with the Tech Manager.
> Quick note — why decision before design? Because you can't design a system you haven't decided on. So the recommendation comes first, and the design backs it up."

## Slide 3 — Use Case 1 (title)

> "Okay — Use Case 1. Modernizing the courier offering system."

## Slide 4 — Problem & Constraints

> "Here's the situation. 15 countries. Over 50,000 couriers. Two million offers an hour at peak — about 556 a second. The SLA is **200 milliseconds at p95**, and we're already at ~180 today. So realistically, we only have about **20 milliseconds of headroom**. I'll come back to that number a lot.
> Today, there's one hardcoded offer template. Earnings logic is spread across three services. Every change is a full multi-region deploy. And there's **no A/B testing**.
> The key thing: the pain isn't performance — it's **rigidity**. Nothing can change. Nothing can be tested.
> One more thing. The system is **already event-driven and distributed** — SQS, Temporal, AppSync on AWS. It already pushes structured JSON to mobile. So my answer is going to be an **evolution, not a rewrite**."

## Slide 5 — Technical Decision: A vs B

> "The prompt gives me two options. Let me evaluate them fairly.
> **Approach A** is a server-side template engine. The server pre-renders the finished text. The mobile app just paints it. The good: experiments are fast — no app release needed. The bad: at two million an hour, the server is rendering on the hot path — that's a real **200ms risk**. And the native experience is poor.
> So **A trades native UX and latency for experiment speed**.
> **Approach B** is the opposite. The server sends raw data. Mobile owns all the layout. The good: native UX is great, the backend stays light. The bad: every layout experiment needs an app-store release. iOS and Android drift. Mobile complexity grows without limit.
> So **B trades experiment speed and consistency for native UX**.
> [pause] Neither alone wins. A gives up UX and latency. B gives up experiments and consistency.
> Which forces the question — **is there a third way?**"

## Slide 6 — Approach C (Hybrid)

> "There is — **Approach C, a hybrid**. It takes the best of both.
> **From A**, the server controls **what** components show and **in what order**. So we experiment without an app release. **From B**, the mobile app renders them **natively**. So the UX stays great.
> One line, this is my north star: **the server decides what and in what order. Mobile decides how it looks.** Through a small registry of 10 to 15 components.
> If you ask how this is different from B — the one real difference is *who owns the layout*. In B, it's app logic. In C, it's data the server sends. So C is B plus a server-controlled layout, with the experiment moved to the server.
> Honest cost. C needs an upfront contract and component governance. And changing an existing component still needs a release or dual-emit. Not free — but the right trade."

## Slide 7 — System Design (Hybrid)

> "Now that we've picked C, here's how it's built. Four new components inside the existing offer service, right after the Temporal step that returns pay and bonus.
> First, an **Experiment Resolver**. It picks the variant using a deterministic sticky hash on the courier ID. Same courier, same variant, every time. If the flag service is slow or down, it fails closed to control.
> Second, an **Earnings Calculator**. It unifies flat, distance, surge, and tips. Just compute — the data is already fetched.
> Third, a **Layout Composer**. It picks the components and hints from config.
> Fourth, a **Payload Builder**. It replaces the hardcoded template — and branches by app version, so old apps get the legacy format.
> Two things I want to call out. **One: every component has a latency budget and a failure mode** — fail-closed, dual-write, idempotency, a sticky hash that doesn't depend on a cache. **Two: on latency**, this adds about 10 milliseconds, inside our 20. And it **won't tail-spin** under load — everything's in-process and cached, no network calls on the hot path. A flag-service outage fails closed. **No new dependency can blow the SLA.**"

## Slide 8 — Latency Budget — estimate, then measure

> "A quick word on those numbers, because someone usually asks. **They're budgets, not measurements.** I took the ~20ms of headroom and split it into a ceiling per component. The real hot path is well under a millisecond — a hash and a cached lookup. The budget just leaves room for cache misses, GC, and serialization.
> For scale: the Temporal pay-and-bonus step is about 150 milliseconds. So these four are tiny next to it.
> Before rollout, I'd load-test on a real cluster and replace these with measured p95. If it ever creeps toward the budget, I'd move the resolution off the request path and precompute. **I wouldn't present an estimate as a fact.**"

*(主线讲 ~20 秒带过;被追问"3ms 怎么来的"再展开。)*

## Slide 9 — The Payload Contract

> "Here's the contract, concrete. The server sends three things. The **layout** — which components, in what order. The **raw data**. And a few **hints**. Mobile renders it through the registry.
> One nice property: the same delivery can go out with a different layout and a different earnings model per market — Switzerland, the UK, Canada — all from config. And unknown components are skipped, so older apps stay safe."

## Slide 10 — Live POC (demo)

> "This isn't just on paper — **I built a running prototype**. Let me show you.
> [▶ DEMO]
> On the admin page, I change the layout and hit save — live, no deploy. On the client, the offer is **pushed** down a stream. The same courier always resolves to the same variant by hash. And here's all three approaches side by side — A sends finished strings, B sends raw data plus flags, C sends a layout plus data.
> [back to slides]
> This is the **hands-on, fail-fast piece**. I'd rather show a small running thing than just describe it."

## Slide 11 — Technical Leadership

> "Now the leadership question. Mobile is worried that C adds complexity for them. Honestly, they're right to worry.
> My principle is: **first, I agree the concern is real. Then I make it specific.** It's not *whether* it adds complexity — it's *how much, what kind, and what's on the other side*.
> So three steps. **First**, I acknowledge it in writing — to frame it as **us vs the problem**, not me vs them. **Second**, a real working session — not a presentation — where mobile tells me what 'complexity' actually means. And I bring **concrete fixes that cap the cost**: a locked registry of 10–15 components, code-gen for the schema, the app skipping components it doesn't know, a shared RFC we co-write. **Third**, instead of a vote — a **small POC the mobile team leads**. One zone, one component, four weeks. Easy to undo. That's the fail-fast move. And I say upfront how we'd escalate if we still disagree — so nobody feels trapped.
> This is the JD's **influence, not authority**. I can't pull rank. I make the trade-offs clear, so they reach the answer with me."

## Slide 12 — The closing posture (leadership)

> "And the line I'd land it on:
> *My job isn't to win the architecture argument — it's to make the team that builds and runs this a co-author of the decision. I'd push for C, but I'd rather ship B with mobile fully bought in than ship C with mobile going along but quietly resentful.*"

## Slide 13 — Migration & Metrics

> "Migration is reversible at every step. Four phases. **Phase one**: a no-op foundation — zero behavior change, verified in shadow mode. **Phase two**: dual payloads — old and new in parallel. **Phase three**: flag rollout, from 1% to 100% per city. **Phase four**: experiments go live.
> Metrics in four buckets. **SLA** — p95 and p99. **Business metrics, read per variant** — acceptance rate, time to accept, dispute rate. We watch for **regression**, not just lift. **Experiment health**. And **migration progress**.
> The principle: **any step rolls back in seconds**. Dual-write means mobile always has the old field to fall back to."

## Slide 14 — Use Case 1 in one line

> "In one line: I recommend the hybrid. **Server controls layout and experiments. Mobile renders natively.** It gives us experiment speed *and* native UX, inside the 200ms / 2M-an-hour budget. It evolves the existing event-driven system. It migrates with instant rollback. And the real Staff work is making mobile a **co-author** of that decision."

## Slide 15 — Use Case 2 (title)

> "Okay — Use Case 2. A four-person team building real-time fraud detection. And they're in trouble."

## Slide 16 — The Situation

> "Quick recap. Four engineers. Kafka and Flink. 45-second latency, against a 5-second target. Scope crept from 3 patterns to 12. Nothing to demo in three days. Low morale.
> My core principle: **the crisis is the deadline, not the architecture.** The common Staff mistake is to charge in, rewrite it, and 'save' the sprint. That solves the demo and breaks the team. The harder, right move is to buy time, narrow scope, coach, and let them ship something they understand.
> And the engineer who wants to start over with something simpler — they might be right. I'd take that seriously."

## Slide 17 — Staff vs Tech Manager

> "First, I'd draw the line with the Tech Manager. The prompt says clearly I work *with* them, not as them.
> **Scope, deadlines, the PM conversation, morale — that's theirs.** **Architecture, testing, RFCs, mentorship — that's mine.** The review story and escalation — together.
> So my literal first 30 minutes is a one-on-one with the TM, to agree on exactly that. The trap is stepping into their job. Using their authority without coordinating undermines them."

## Slide 18 — Diagnose

> "Diagnosis — and the goal is to **ask questions that turn symptoms into causes**. I don't feed them the answer.
> On the 45 seconds: *'Walk me through the data flow end to end. Where's the time going — measured, or assumed? Any synchronous I/O in an operator? What's the parallelism and the watermark strategy?'*
> And the big question: *'Is Flink even right for our event rate — have we measured it?'* The prompt gives no number. Delivery events are maybe 20 a second. But GPS pings could push it to a few thousand. And the platform already handles hundreds a second for offers. So the range goes from overkill to justified — **measure first, don't assume.**
> On scope, I don't just ask *'which 3 of 12.'* I **audit the 12 first** with the team — often it's really 4–5 distinct patterns once you find the duplicates, subsets, and ones we don't have the data for. That's engineering the scope **down**, not just picking from a list.
> I'd ask these in waves, not 30 at once. The questions are the coaching."

## Slide 19 — The 3-day plan

> "For three days, the big call is: **cut scope, hard.** Ship one pattern that tells the story — 'marked complete more than 500 meters from destination.' The data's there. It's a distance calculation. Runs well under five seconds.
> But I'm not just cutting business scope to dodge the real problem. So **Day 1, two audits in parallel**:
> ① **The Flink telemetry** — is the 45 seconds bad watermark generation, or a synchronous DB call inside an operator?
> ② **The 12 patterns themselves** — duplicates? subsets of each other? need data we don't have? Often '12' collapses to 4–5 real ones.
> Then **scope-lock with the PM in writing** — 1 shipped, the rest grouped as deferred, merged, or dropped. Not just '11 deferred.'
> **Day 2**: pair to a working skeleton and the first test fixture. **Day 3**: a dry run where the **team** presents, and the TM and I pre-brief the director.
> At the review, **I sit in the audience**. The team gets the credit. Avoid a half-working live demo that fails."

## Slide 20 — Guide without solving

> "How I guide without taking over. **I pair, but they drive the keyboard.** I whiteboard principles, not fixes. My code review comments are questions — *'what happens if this is null?'* — not instructions.
> Example — the 45-second latency. **The Senior move:** *'It's backpressure. Add async I/O and double the parallelism.'* **The Staff move:** *'What's the latency breakdown? What does the metric say? How would we confirm? Let's run it — what would the result tell us?'* Same destination — but the second one teaches the debugging method.
> One caveat: I don't withhold facts just to be pure. If they ask 'milliseconds or seconds for checkpoints?' — I just answer."

## Slide 21 — Long-term knowledge transfer

> "Longer term — this is what prevents the next three-day crisis. Over **30 days**, a streaming study group and outside experts. Over **60**, each engineer builds a small Flink toy project, and the team writes the v2 RFC. Over **90**, each engineer **teaches one concept back** — watermarks, backpressure — because **teaching is when they really own it**.
> Key principle: don't let them learn alone. If another team runs production streaming, I set up that connection. **Cross-team learning beats self-study.**"

## Slide 22 — Work with TM / Principals / Leadership

> "With the TM, a **daily 15-minute check-in** during the crunch. Architecture runs through me. Scope stays with them. And I **never go around them** to the engineers.
> With Principals, I pull them in early for a second opinion. Not to do the work for me. Not as backup over my TM.
> With leadership, **I get ahead of the escalation**. Before the PM frames it, the TM and I brief them together: *'The team picked Flink for a workload that, at the rate we measured, is well below its design point. They're paying a complexity tax. We've descoped to one pattern. We'll evaluate the architecture over 30 days. We'd like your air cover with the PM.'*
> And if the 'start over' engineer turns out to be right — I praise them publicly. I frame the Flink work as not wasted. And I own the lesson."

## Slide 23 — Use Case 2 posture

> "The line I'd land Use Case 2 on:
> *My role is to make the team better at this — not to do the work for them. The three-day deadline is a constraint to navigate, not a performance to deliver. If I do my job right, this team handles the next streaming project without a Staff parachute.*"

## Slide 24 — Closing

> "To close — two postures, one standard. On the offering system, the Staff work was making the team a **co-author**. On the fraud team, it was **leverage over time, not heroics**.
> **I answered both the same way — influence not authority, fail fast, hands-on POCs. That's my read on Staff, and what this role calls for.**
> Thank you. I've got deeper detail on any of it, plus a running prototype — happy to go wherever's useful."

---

## 练习提示

- **先慢后顺**:第一遍慢读,把每句读顺;第二遍计时(目标 UC1 ~30 / UC2 ~20)。
- **金句背熟**:Slide 12 / 23 / 24 那三段引号里的话,要脱稿说。
- **signpost 词**(转场词)别省:*"Here's the situation / One line is / Now that we've picked C / In one line / To close"* —— 这些让听众跟得上、也帮你从一页过到下一页。
- **[▶ DEMO]** 处:**绝不现场改代码/编译** —— 用**录屏(demo.mp4)或事先已经跑好的 demo**,只点不改,防环境/网络翻车;万一连不上,这页的话配截图照样能讲。
- **金句放慢**:Slide 12 / 23 / 24 那三段引号要**脱稿、放慢、语气坚定** —— 这是立"Staff 人设"的高光。
- **卡住别慌**:慢下来、看 slide 一眼、用自己的话继续。中间停顿 1–2 秒是稳,不是错。
