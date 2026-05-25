# 面试 Q&A —— 追问 + 模型答案 + 文档出处

> 把模拟面试里被追问的问题、以及高频硬题,收成一份。每条:**问题 → 可直接说的英文答案 → 详见哪份文档**。
> 临场看 [`INTERVIEW-CHECKLIST.md`](./INTERVIEW-CHECKLIST.md);系统讲稿看 [`en/presentation-combined.md`](./en/presentation-combined.md)。
>
> 📣 英文答案都是**短句口语版** —— 一句一个意思,好记好说。卡住就慢下来,没关系。
> 记法:先记**中文一句话**(想通逻辑),英文自然能拼出来。

---

## UC1 — Courier Offer System Modernization

### Q1. Why not just go with B (raw data + mobile owns presentation)? What does the hybrid actually buy?

**一句话:** B 的 feature flag 只能切**已经发版的变体**;C 能用**服务端配置组合任意"已有组件 + 顺序"而不发版**。

> "With B, the app owns the layout. So any new layout needs a new app release. People will say 'but we have feature flags.' Feature flags only switch between layouts we already shipped. They can't build a new one. With C, the server picks the components and the order. So I can ship a new layout with **no app release**. I also get the same look on iOS and Android. And I can roll back an experiment from the server in one click. B can't do any of those three."

📄 [`en/approach-evaluation.md`](./en/approach-evaluation.md)（B vs C 辨析）· [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)

---

### Q2. Draw the precise line — what can C change from the server with no release, and what still needs one?

**一句话:** Server config 免发版:**哪些组件 / 顺序 / 显隐 / hints / 实验路由 / 用哪个 earning model**。仍需发版:**新组件类型 / 给已有组件改样式(那是 "how",归 mobile)/ 改组件数据语义(走 v2 组件)**。

> "From the server, no release: which components show, their order, show or hide, hints, which experiment, and which earnings model. Still needs a release: a brand-new component, restyling a component — that's the 'how', and mobile owns that — or changing a component's data shape, which I'd ship as a v2 component. I'm honest about it: C does **not** let me restyle from the server. It changes *what* and the *order*, not *how*."

📄 [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Consequences / 负面）

---

### Q3. A and C look similar — both send structured data. What's the real difference?

**一句话:** **string-on-wire vs value-on-wire**;A 把算力(渲染)放在**延迟热路径**上集中算,C 把它**推到边缘**(5 万台手机,免费、并行、原生)。

> "A sends the finished text — '$11.76'. So the app just paints it. C sends the value — 1176, in CAD. So the app can do more: animate the number counting up, re-format it if the language changes, highlight it, or show a breakdown on long-press. A can't do those. It's also about cost. A renders on the server, on the hot path, two million times an hour. C renders on the phones — fifty thousand of them, for free, in parallel, and native. And A keeps growing richer until it basically becomes C anyway."

📄 [`en/approach-evaluation.md`](./en/approach-evaluation.md)（A vs C 辨析）

---

### Q4. You're adding 4 components on the hot path at 2M/h with ~20ms headroom. Convince me you don't blow the 200ms p95 — including p99 and a slow dependency.

**一句话:** 这 4 个加起来 **~10ms 预算(不是实测)**,p99 大头是 **Temporal pay+bonus ~150ms**;新依赖**不挂同步阻塞调用** —— miss 读 last-good、慢/挂 fail-closed 到 control,所以"+10ms 不会 tail-spin"。

> "Three things. **One:** my four components are tiny. The real cost is the Temporal pay-and-bonus calls — about 150ms, roughly 80% of the budget. My parts are well under a millisecond. And that 10ms is a *budget*, not a real measurement — I'd load-test first. **Two:** flags and templates are cached. On a cache miss we use the last good value and refresh in the background. So the courier never waits on the flag service. **Three:** the resolver fails closed. If it can't decide in time, the courier just gets the default layout — never an error, never a hang. A slow dependency hurts the *experiment*, not the *offer*. And I'd set an alarm if the fallback fires more than about 1%."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Latency Budget / how to create headroom）· [`en/courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md)

---

### Q5. A courier sees treatment, reopens 5 min later and sees control. How do you guarantee no flip — and does it survive cache eviction / server restart?

**一句话:** 分桶是**算出来的不是存出来的**:`hash(courierId+experimentId) % 100 < treatment_pct`,确定性纯函数 → 同输入永远同桶 → 没有状态可丢,eviction/重启都不翻。

> "The bucket is computed, not stored. We take hash of courierId plus experimentId, mod 100. That gives each courier a fixed number, 0 to 99, and we compare it to the rollout percent. Same courier, same experiment, always the same bucket — it's just math on a stable ID. So a cache wipe or a restart can't flip anyone — there's nothing stored to lose, and no database lookup. Ramping is safe too: going from 10% to 50% only *adds* couriers, it never kicks anyone out. I add the experimentId so different experiments don't land on the same people. Region only decides *who's allowed in* — the bucket is always on courierId, so moving region never flips them. And if anything fails, we default to control."

📄 [`zh/sticky-bucketing-explained.md`](./zh/sticky-bucketing-explained.md)（逐段讲透）· [`demo/server/lib/hash.js`](./demo/server/lib/hash.js)（真实代码）

---

### Q5b. You have `earnings_v1` and `earnings_v2`. Can the same courier end up in *both* buckets?

**一句话:** 看是"一个实验的两个臂"还是"两个独立实验"。**一个实验多臂 → 不可能**(单号落单带,结构性互斥);**两个独立实验 → 数学上会**(`+experimentId` 故意去相关),同屏即 **collision**,要么建模成一个多臂实验,要么用 **mutual-exclusion group**。

> "It depends — is it one experiment or two? If v1 and v2 are two arms of *one* experiment, each courier gets one number, and that number lands in one band — control, v1, or v2. They can't be in two. That's by design. If they're *two separate* experiments, then yes — a courier could be in treatment for both, because I add the experimentId on purpose so experiments don't line up. That's good when they're unrelated. But if both change the *same screen*, that's a collision. I'd fix it by making them one experiment with multiple arms, or by putting them in a mutual-exclusion group."

📄 [`zh/sticky-bucketing-explained.md`](./zh/sticky-bucketing-explained.md)（multi-arm 三阈值 + 碰撞 + 互斥组）

---

### Q6. The mobile lead pushes back: "Hybrid dumps complexity on us. Just send finished strings (A)." They're senior and don't report to you. How do you win this in the room?

**一句话:** 不靠权威靠影响力:把移动团队变成 **co-author(共写 RFC)而非下游**,正面回应他们的核心顾虑——用 **bounded registry(~10–15)+ 共享 schema codegen** 把复杂度**有界化**,并用一个 POC 让事实说话。

> "I don't win it on the whiteboard. I win it by making the mobile lead a **co-author** of the contract, not just someone I hand it to. Their real fear is endless complexity — so I deal with that head-on. The registry is locked, around 10 to 15 components, and we add to it together. We generate the iOS and Android code from one shared schema — no hand-parsing, no drift. And the app skips components it doesn't know, so they're never blocked by the server. Then I don't argue — I build a small POC on one screen and let the data decide. The message isn't 'backend won.' It's 'they keep native UX, we get fast experiments, and their complexity is capped.'"

📄 [`en/technical-leadership.md`](./en/technical-leadership.md)（7 步推动法）· [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Mitigations）

---

### Q6b. The POC is done, the data is good — but the mobile lead *still* disagrees, at the root. Your influence is spent. Now what?

**一句话:** 升级,但**跟他一起升级,不背着他**;真心准备好自己是错的;选了 B 就公开 commit。**"宁可 B 全员买账,也不要 C 全员怨气"** —— 我升级是为了拿一个合法裁决,不是为了赢。

> "If he still says no, this is too big for just us two. So I bring it to the TM and the Principals — **with him, not behind him**. We show both sides, and I help him make his case too. And I'm honest — **maybe I'm wrong**. If they pick B, I fully support B. I'd rather ship the option **the team believes in** than one they resent. I'm escalating to get a fair decision, not to win."

> 💡 3 个记忆短词组:**"with him, not behind him" · "maybe I'm wrong" · "the team believes in it"**

📄 [`en/technical-leadership.md`](./en/technical-leadership.md)（disagree & commit / 何时升级）

---

### Q7. How do you migrate off the hardcoded `Offer.java` safely? What's the rollback story?

**一句话:** 4 阶段、每步秒级可回滚:**no-op foundation → dual payload(新旧并发,影子比对)→ flag 1%→100% → 实验上线**;回滚就是把 flag 调回 0。

> "Four phases, and you can undo each one in seconds. Phase 1: ship the new pipeline as a no-op that produces today's exact payload. Phase 2: run old and new side by side and compare the output — no user impact. Phase 3: turn it on with a flag, from 1% up to 100%, using the sticky hash. Phase 4: real experiments go live. Rollback at any point is just turning the flag down — no deploy. I watch p95 and p99, accept rate per variant, dispute rate, crash rate, and how often the fallback fires."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Migration Strategy + Metrics）

---

### Q7b. How many people and how long? What does this cost to build?

**一句话:** 不冷报数字 —— 我**按阶段拆、按谁做各自估、用一个 1–2 周 POC 当 gate**;粗估 **~1 个 quarter 到第一个实验上线**,小常备团队(~2 后端 + 2 移动 iOS/Android + 兼职 data/QA),**最大单项成本是移动端 registry + 共享 schema codegen + 契约设计**(C 已知的前期税),**持续成本是组件治理**。人/时间线最终是 **TM 拍板**,我给技术拆解和风险。

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

**深水追问 & 一行回:**
- *"What's the cost of NOT doing it?"* → "Every change stays stuck behind backend and an app release. We can't personalize earnings or run A/B tests — the questions that started this never get answered."
- *"Why not just buy an SDUI framework?"* → "We already push structured JSON on an event-driven stack — C is just the next step, not a rebuild. A vendor tool adds a dependency and still needs our contract and our registry. Most of the work doesn't go away."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Migration phases）· [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Consequences / 前期成本）· [`en/handOver.md`](./en/handOver.md)（数字需向真实 repo 核实）

---

### Q8. Offers are pushed (SSE/AppSync). What happens when the push fails — does a courier miss an offer?

**一句话:** **push 是延迟优化,不是 source of truth**;靠 reconnect 时 **pull 对账 + offer_id 去重 + TTL 感知重投**兜底;业务安全网=**过期→重派给下一个 courier + 首个 ACK 原子 claim**。

> "Push is a speed optimization, not the source of truth. When the app reconnects, it *pulls* the current offer and syncs up. Every offer has an ID for dedup and a TTL, so we can safely resend it. And the real safety net is the business rule: if an offer isn't accepted before it expires, it goes to the next courier, and the first accept wins with an atomic claim. So a dropped push never loses an offer, and never assigns it twice."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Offer Delivery Resilience）· [`zh/runtime-dataflow.md`](./zh/runtime-dataflow.md)

---

### Q9. Old app versions don't know your new components. How do you not break them?

**一句话:** **forward-compat skip(未知组件静默跳过)+ `min_app_version` 协商 + fallback layout**,所以 server 可领先 app 发布。

> "It's built into the contract. The app skips components it doesn't know, so the server can ship ahead of the app. If an old app really can't render a payload, the server checks its minimum version and sends a fallback layout — built only from components that version has. So old apps degrade nicely instead of crashing."

📄 [`en/app-version-compatibility.md`](./en/app-version-compatibility.md)

---

## UC2 — Guiding a Real-Time Fraud-Detection Team (Kafka + Flink)

### Q10. As a Staff Engineer, how is your role here different from the Technology Manager's?

**一句话:** TM 管**人和优先级**;Staff 管**技术方向和能力建设** —— 我**诊断、引导、留下能力**,不替他们写完。

> "The TM owns people, priorities, and deadlines. I own the technical direction and the team's skill. Here, I diagnose the system, I *guide* the engineers to the fix instead of handing them a patch, and I leave them more capable than I found them. I work *with* the TM — I surface the risk and the options; they make the staffing and timeline calls."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)（5 个考察点）

---

### Q11. The pipeline lags ~45s behind real-time. How do you diagnose it?

**一句话:** 先看**遥测不猜**:Flink **backpressure**(最可能的元凶)、checkpoint 时长/失败、**watermark 落后**、**数据倾斜(热 key)**、source consumer lag。

> "I start from the data, not from guesses. In the Flink UI I look for backpressure — which operator is the bottleneck slowing everything upstream. Then checkpoint time and failures. Then watermark lag — how far behind event time we are. Then key skew — one hot key overloading one slot. And consumer lag at the Kafka source. A steady 45-second lag is usually a backpressured operator or too little parallelism — not a code bug. So I measure before anyone touches the code."

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) · [`zh/flink-kafka-notes.md`](./zh/flink-kafka-notes.md)（背压/watermark/窗口 Q&A）

---

### Q12. Give me your first 3-day plan.

**一句话:** **Day1** 听+读+看遥测(不动代码);**Day2** 和工程师一起定位瓶颈、形成假设;**Day3** 一起验证最小修复 + 留下 RFC 骨架让团队自己推进。

> "Day 1: I listen and read — the architecture, the Flink dashboards, recent incidents — and I pair with the engineers. I change nothing. Day 2: with them, I form a hypothesis from the data — probably backpressure or skew — and design the smallest test to confirm it. Day 3: we validate the smallest fix together, and I leave an RFC skeleton with the open questions, so the team carries it forward. I'm handing over skill, not parachuting in a patch."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) · [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md)

---

### Q13. How do you guide without just solving it for them?

**一句话:** 给**框架和问题,不给答案**:用 RFC 骨架 + reviewer 提问,让工程师自己填,我把关推理过程。

> "I ask the questions a senior reviewer would ask, and let them find the answer. Instead of 'set parallelism to 8,' I ask 'which operator is backpressured, and what does the watermark tell you?' I give them an RFC skeleton — the structure and the open questions — and I review their reasoning, not just their patch. They own the fix; I make sure the thinking is solid."

📄 [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md)（刻意留白 + reviewer 提问）· [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

---

### Q14. Do they even need Flink? What data volume justifies it?

**一句话:** **先量再说** —— UC2 没给量,~20 events/s(只算派单)用 Kafka consumer / KStreams 就够;但 GPS ping 会把量推到**每秒数千**,那才需要 Flink 的**event-time 窗口 + keyed state + 背压处理**。诚实地说"取决于实际吞吐,我会先测"。

> "Honestly, it depends on the volume — and the prompt doesn't give it. If it's just delivery events, that's maybe tens per second from fifty thousand couriers — a plain Kafka consumer or Kafka Streams handles that. Flink earns its place when you add GPS pings, which can be thousands per second and need real event-time windows, keyed state, and backpressure handling. So I wouldn't say 'rip out Flink' or 'keep Flink.' I'd say 'let's measure the real throughput and what state we need, then right-size.'"

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md)（when do you actually need Flink + 右-sizing 说明）

---

### Q15. How do you transfer knowledge so the team doesn't regress after you leave?

**一句话:** 30/60/90 —— **30** 跟我 pair / 我做 reviewer;**60** 他们主导我旁观;**90** 团队自治,我只在升级时介入。沉淀成 runbook + RFC,不进我脑子。

> "A 30-60-90 plan. First 30 days, we pair and I review their RFCs. By 60, they lead the diagnosis and I just watch. By 90, the team runs on its own and I only come in for escalations. The knowledge lives in runbooks and RFCs, not in my head. The real test: can they handle the *next* incident without me?"

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)（KT 30/60/90）

---

### Q16. How do you work with the TM and the Principal engineers without stepping on toes?

**一句话:** 分工清楚:**TM 管人/优先级,Principal 管跨域架构,我管这条流的技术方向**;我把选项和风险摆出来,决策权留给对的人。

> "Clear lanes. I bring the TM the risk and the options, so they can make the priority and staffing calls. With the Principals, I align on the bigger architecture — I'm not overriding them, I'm keeping this pipeline consistent with the wider platform. I work through written RFCs and shared diagnosis, so the right people own the decisions. That's influence, not authority."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

---

## 通用 / 行为题(若被问到)

### Q17. What's the one decision you're least sure about?

**一句话:** 诚实地说 C 的**移动端复杂度**和**组件治理**是真实代价 —— 我用 bounded registry + co-owned RFC 缓解,但如果业务只需要极少数固定布局,A 可能更省。展示**会权衡、不教条**。

> "Honestly, the mobile complexity and the governance. C asks the mobile team to build and maintain a registry, and it asks us to run a review board so it doesn't sprawl. Those are real costs. If the business only ever needed two or three fixed layouts, A would be simpler, and I'd pick A. I chose C because the business wants lots of experiments — but I hold that view loosely, and the POC is there to check it."

📄 [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Consequences）· [`en/approach-evaluation.md`](./en/approach-evaluation.md)

---

## 文档总索引

| 想深挖什么 | 看哪里 |
|---|---|
| 现状架构 + 延迟预算 | [`en/courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md) |
| A/B/C 三方对比 + B/A vs C 辨析 | [`en/approach-evaluation.md`](./en/approach-evaluation.md) |
| C 端到端设计 / 迁移 / 指标 / 投递韧性 | [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) |
| 分桶 sticky 原理 | [`zh/sticky-bucketing-explained.md`](./zh/sticky-bucketing-explained.md) |
| 老 app 兼容 | [`en/app-version-compatibility.md`](./en/app-version-compatibility.md) |
| UC1 技术领导力 | [`en/technical-leadership.md`](./en/technical-leadership.md) |
| UC2 团队指导(5 点) | [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) |
| Flink/Kafka 原理 | [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) · [`zh/flink-kafka-notes.md`](./zh/flink-kafka-notes.md) |
| 决策记录 / RFC 骨架 | [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) · [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md) |
| 临场一页纸 / 逐页讲稿 | [`INTERVIEW-CHECKLIST.md`](./INTERVIEW-CHECKLIST.md) · [`en/presentation-combined.md`](./en/presentation-combined.md) |
