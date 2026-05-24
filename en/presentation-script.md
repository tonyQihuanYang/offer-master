# Presentation Script — verbatim talk track (for speaking practice)

> 这是**逐字英文讲稿**——一句句照着念,练英语口语用。
> 配套:幻灯片 `slides/interview.en.md`、大纲 [`presentation-outline.md`](./presentation-outline.md)。
> `[▶ DEMO]` = 切到运行中的 demo;`[pause]` = 停一拍。说话用缩写、放慢、自然就好。

---

## Slide 1 — Title

> "Hi, thanks for having me. We've got the hour for both cases. I'll take roughly **30 minutes** on the courier offering system and about **20** on the fraud-detection one — but please jump in with questions any time; I'd rather this be a conversation than a monologue.
> One framing up front: to me, Staff engineering is two things — driving technical decisions through **influence, not authority**, and being **hands-on: building POCs and failing fast**. I'll answer both cases to that standard, and I actually built a small running prototype for the first one."

## Slide 2 — Agenda

> "For Use Case 1, I'll do it in this order: first the **technical decision** — evaluate the approaches and recommend one with the reasons; then the **system design** of what I picked; then the **leadership** piece — how I'd bring the mobile team along; and finally **migration** — metrics and rollback.
> For Use Case 2, it's diagnose, guide without solving, the three-day plan, knowledge transfer, and working with the Tech Manager.
> Quick note on why decision before design: you can't design the system until you've chosen the approach — so the recommendation is my thesis, and the design is how I back it up."

## Slide 3 — Use Case 1 (title)

> "Okay — Use Case 1, modernizing the courier offering system."

## Slide 4 — Problem & Constraints

> "Here's the situation. We're across 15 countries, 50,000-plus couriers, two million offers an hour at peak — that's roughly 556 requests a second. The SLA is 200 milliseconds at p95, and we're at about 180 today, so realistically there's only around **20 milliseconds of headroom**. I'll come back to that number a lot.
> Today there's one hardcoded offer template, earnings logic spread across three services, and every change is a full multi-region deploy. There's no experimentation at all.
> The key thing to notice: the pain isn't performance — it's **rigidity**. Nothing can change or be tested without a deploy. And one more: the system is **already event-driven and distributed** — SQS, Temporal, AppSync on AWS — and it already pushes structured JSON to mobile. So my answer is going to be an **evolution, not a rewrite**."

## Slide 5 — Technical Decision: A vs B

> "The prompt frames this as two options. Let me put them side by side honestly.
> **Approach A**, the server-side template engine: experiments are fast because it's all server-side, but the server renders everything — so at two million an hour that's compute on the latency path, the native experience is poor, and mobile is just painting boxes.
> **Approach B**, raw data with mobile presentation: the native UX is great and the backend is light — but every layout experiment now needs an app-store release, and keeping iOS and Android consistent is hard.
> So neither one alone wins. A buys you experiment speed but gives up the native feel and risks the SLA; B keeps the native feel but you lose experiment velocity. [pause] That tension is exactly what points to a third option."

## Slide 6 — Approach C (Hybrid)

> "So I'd propose a hybrid — call it Approach C — that takes the best of both.
> **From A**, the server controls *what* components show and *in what order* — so we can run experiments without an app release. **From B**, the mobile app renders those components **natively** — so the UX stays great.
> The one-line version is: **the server decides what and in what order; mobile decides how it looks.** Mobile has a small registry of about 10 to 15 components.
> If someone asks how this differs from B specifically — the one real difference is *who owns the layout*. In B, 'which components and in what order' is application logic living on mobile. In C, it's data the server sends. So C is essentially B plus a server-controlled layout descriptor, with experiment assignment moved server-side.
> And I'll be honest about the cost: C needs an upfront contract and component governance, and changing an existing component's data shape still needs a release or a dual-emit. It's not free — but it's the right trade."

## Slide 7 — System Design (Hybrid)

> "Now that we've picked C, here's how it's built. I add four components inside the existing offer service, right after the Temporal workflow returns pay and bonus.
> An **Experiment Resolver** that assigns the variant — using a deterministic, sticky hash of the courier ID, so the same courier always lands in the same variant, and if the flag service is down it fails closed to control. Budget, about 3 milliseconds.
> An **Earnings Calculator** that unifies flat, distance, surge, and tips into one model — compute only, the data's already fetched.
> A **Layout Composer** that emits the component list and hints from config.
> And a **Payload Builder** that replaces the hardcoded template and branches by app version — old apps get the legacy format.
> Two things I want to emphasize as distributed-systems design: every component has a **latency budget** and a **failure mode** — fail-closed, dual-write, idempotency, a sticky hash that doesn't depend on a cache. The whole thing adds about 10 milliseconds, which fits inside that 20 we have.
> And let me be precise about why that 10 won't tail-spin under peak load — because p95 isn't just addition. Every one of these is **in-process and cached — zero network I/O on the hot path** — so there's no dependency to time out on. If the config or flag service is slow or down, we **fail closed instantly** to the default layout. And if we ever *measure* the real added latency creeping toward the budget, the fallback is to move experiment and layout resolution **off the request path entirely** — precompute it per courier. So a dependency hiccup can't blow the SLA.
> Mobile renders from a registry, and any component it doesn't recognize is silently skipped — so the server can ship ahead of the app."

## Slide 8 — The Payload Contract

> "Here's the contract made concrete. The server sends three things: the **layout** — which components, in order — plus the **raw data**, plus a few **hints**. Mobile renders it through the registry.
> The nice property: the same delivery can go out with a different layout and a different earnings model per market — Switzerland, the UK, Canada — all from config. And unknown components are skipped, so older apps stay safe."

## Slide 9 — Live POC (demo)

> "And this isn't just on paper — I built a running prototype to prove it out. Let me show you.
> [▶ DEMO]
> On the admin side, I change the layout and hit save — and it's live, no deploy. On the client, the offer is **pushed** down a stream — and you can see the same courier always resolves to the same variant by hash. And here's a side-by-side of all three approaches on the wire — you can see A sends finished strings, B sends raw data plus flags, and C sends a layout plus data.
> [back to slides]
> This is the hands-on, fail-fast piece — I'd rather show a small running thing than just describe it."

## Slide 10 — Technical Leadership

> "Now the leadership question — the mobile team is worried this adds complexity for them. And honestly, they're right to be.
> My principle is: **validate the concern, then sharpen it.** The question isn't *whether* it adds complexity — it's *how much, what kind, and what's on the other side*.
> So, concretely: I'd acknowledge it in writing first, to make it us-versus-the-problem, not us-versus-them. Then a real working session — not a presentation — where mobile tells me what 'complexity' actually means, and I bring **bounded** mitigations: a locked registry, code-gen for the schema, forward-compat skipping, a co-owned RFC. Then instead of a vote, I'd propose a **small, reversible proof — mobile-led** — one zone, one component, four weeks. That's the fail-fast move. And I'd pre-state the escalation path so nobody feels trapped.
> This is the part of the JD that says **influence, not authority** — I can't pull rank on mobile; I can only make the trade-offs clear enough that they reach the answer with me."

## Slide 11 — The closing posture (leadership)

> "And the line I'd land it on:
> *My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision. I'd advocate for C, but I'd rather ship B with mobile fully bought in than ship C with mobile compliant but quietly resentful.*"

## Slide 12 — Migration & Metrics

> "On migration — the whole thing is designed to be reversible at every step. Phase one is a no-op foundation, zero behavior change, verified in shadow mode. Phase two, dual payloads — old and new side by side. Phase three, flag rollout, one percent to a hundred, per city. Phase four, experiments go live.
> For metrics, four buckets: SLA — p95 and p99; business metrics **read per variant** — acceptance, time-to-accept, and dispute rate, all watched for **regression**, not just lift; experiment health — assignment consistency and flag fallback; and migration progress.
> The principle that ties it together: any step rolls back in seconds, because dual-write means mobile always has the old field to fall back to."

## Slide 13 — Use Case 1 in one line

> "So in one line: I recommend the hybrid — server controls layout and experiments, mobile renders natively. It buys experiment velocity *and* native UX inside the 200-millisecond, two-million-an-hour budget, it evolves the existing event-driven system, and it migrates with instant rollback. And the real Staff work is making mobile a co-author of that decision."

## Slide 14 — Use Case 2 (title)

> "Okay — Use Case 2. A four-person team building real-time fraud detection, and they're in trouble."

## Slide 15 — The Situation

> "Quick recap of the situation: four engineers, Kafka and Flink, processing latency at 45 seconds against a 5-second target, scope crept from 3 patterns to 12, no clear test strategy, a sprint review in three days with nothing to demo, and morale is low.
> My core principle here: **the crisis is the deadline, not the architecture.** The most common Staff mistake is to charge in, rewrite it, and 'save' the sprint — that solves the demo and breaks the team. The harder, right move is to buy time, narrow scope, coach, and let them ship something they actually understand.
> And one more — the engineer who wants to start over with something simpler might be right. I'd take that seriously, not wave it off with 'we already invested in Flink.'"

## Slide 16 — Staff vs Tech Manager

> "Before anything else, I'd draw the line with the Tech Manager — because the prompt is explicit that I work *with* them, not as them.
> Scope, deadlines, the PM conversation, morale — that's the TM's. Architecture, testing, RFCs, mentorship — that's mine. The sprint-review narrative and any escalation, we shape together.
> So my literal first 30 minutes is a one-on-one with the TM to agree exactly that. The trap I'd avoid is stepping into their job — negotiating scope with the PM myself — because using their authority without coordinating undermines them."

## Slide 17 — Diagnose

> "First, diagnosis — and the goal is to ask questions that turn symptoms into causes, not to lead the witness.
> On the 45 seconds: 'Let's whiteboard the data flow end to end. Where exactly is the time going — is that measured or assumed? Any synchronous I/O inside an operator? What's the parallelism and the watermark strategy?'
> And the big one: 'Is Flink even the right tool for our event rate — have we measured it?' Now, the prompt doesn't give a volume. If you only count delivery events it's roughly 20 a second; but fraud runs on GPS pings, which could push it to a few thousand a second — and we know the platform already does hundreds a second for offers. So the honest answer is: that range straddles 'overkill' and 'justified' — **so measure it first**, don't assume.
> I'd ask these in waves, not fire 30 at once. The questions are the coaching — they teach the team *how* to think."

## Slide 18 — The 3-day plan

> "For the next three days, the load-bearing decision is to **cut scope, hard.** Ship one pattern that tells the whole story — 'courier marked complete more than 500 meters from the destination.' The data's already there, it's a distance calculation, and it runs well under five seconds with or without Flink.
> But I want to be clear I'm not just cutting business scope to dodge the real problem — so on day one I'd also pair with the tech lead to **audit the Flink telemetry**: is that 45 seconds coming from improper watermark generation, or a synchronous database call inside an operator? We narrow the business scope *and* find the infrastructure root cause.
> Day one, then: align with the TM, that architecture-and-telemetry walk-through, and a scope-lock session where the PM agrees in writing — one pattern in, eleven deferred. Day two: pair to a working skeleton and write the first real test fixture. Day three: a dry run where the **team** presents, and the TM and I pre-brief the director together.
> At the review, I'm in the audience — the team presents and gets the credit. The one thing to avoid is a half-working live demo that fails."

## Slide 19 — Guide without solving

> "On *how* I guide without taking over: I pair, but they drive. I whiteboard principles, not fixes. My code-review comments are questions — 'what happens if this is null?' — not instructions.
> Quick example — the 45-second latency. The Senior move is: 'It's backpressure, add async I/O and double the parallelism.' The Staff move is: 'What does the latency breakdown look like? What does the metric say? How would we confirm that? Let's run it — what would the result tell us?' Same destination — but the second one teaches the debugging method.
> The one caveat: I don't withhold facts to be pure about it. If they ask 'is checkpoint duration usually milliseconds or seconds,' I just answer."

## Slide 20 — Long-term knowledge transfer

> "Longer term — this is what prevents the next three-day crisis. Over 30 days, a streaming study group and outside experts. Over 60, each engineer builds a small Flink toy project and the team writes the v2 RFC. Over 90, each of them *teaches* one concept back — watermarks, backpressure — because teaching is when they really own it.
> And the key principle: don't let them learn in isolation. If another team runs production streaming, I broker that connection — cross-team transfer beats in-team self-study every time."

## Slide 21 — Work with TM / Principals / Leadership

> "On working with the others: with the TM, a daily 15-minute check-in during the crunch — architecture runs through me, scope stays theirs, and I never go around them to the engineers.
> With Principals, I pull them in early for a second opinion and pattern-matching — not to do the work, and not as backup over my TM.
> And with leadership — I get ahead of the escalation. Before the PM frames it, the TM and I brief them together: 'The team picked Flink for a workload that, at the rate we measured, is well below its design point — so they're paying a complexity tax. We've descoped to one pattern, we'll evaluate the architecture over 30 days, and we'd like your air cover with the PM meanwhile.'
> And if that 'start over' engineer turns out to be right — I praise them publicly, frame the Flink work as not wasted, and own the lesson. The team comes out more capable."

## Slide 22 — Use Case 2 posture

> "The line I'd land Use Case 2 on:
> *My role is to make the team better at this — not to do the work for them. The three-day deadline is a constraint to navigate, not a performance to deliver. If I do my job right, this team handles the next streaming project without a Staff parachute.*"

## Slide 23 — Closing

> "So, to close — two postures, one standard.
> On the offering system, the Staff work was making the team that ships it a co-author. On the fraud team, it was leverage over time, not heroics in the moment.
> I answered both the same way: **influence, not authority**, and **hands-on — POCs, fail fast**. That's my read on Staff, and I think it's what this role is asking for.
> Thank you — I've got deeper detail on any of it, plus a running prototype, so happy to go wherever's useful."

---

## 练习提示

- **先慢后顺**:第一遍慢读,把每句读顺;第二遍计时(目标 UC1 ~32min、UC2 ~22min)。
- **金句背熟**:Slide 11、22、23 那三段引号里的话,要脱稿说。
- **signpost 词**(转场词)别省:"Here's the situation / The one-line version is / Now that we've picked C / The line I'd land it on" —— 这些让听众跟得上。
- **[▶ DEMO]** 处:**绝不现场改代码/编译**——用**录屏(demo.mp4)或事先已经跑好的 demo**,只点不改,防环境/网络翻车;万一连不上,这页的话配截图照样能讲。
- **金句放慢**:Slide 11 / 22 / 23 那三段引号要**脱稿、放慢、语气坚定**——这是立"Staff 人设"的高光。
