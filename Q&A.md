# 面试 Q&A —— 追问 + 模型答案 + 文档出处

> 把模拟面试里被追问的问题、以及高频硬题,收成一份。每条:**问题 → 可直接说的英文答案 → 详见哪份文档**。
> 临场看 [`INTERVIEW-CHECKLIST.md`](./INTERVIEW-CHECKLIST.md);系统讲稿看 [`en/presentation-combined.md`](./en/presentation-combined.md)。
>
> 记法:答案先给**一句话 takeaway**(背这句),再给展开。

---

## UC1 — Courier Offer System Modernization

### Q1. Why not just go with B (raw data + mobile owns presentation)? What does the hybrid actually buy?

**一句话:** B 的 feature flag 只能切**已经发版的变体**;C 能用**服务端配置组合任意"已有组件 + 顺序"而不发版**。

> "With B, the mobile app owns layout, so every new arrangement ships through an app-store release. The team will say 'we have feature flags' — but flags only toggle **variants you already shipped**. They can't compose a *new* layout that wasn't pre-coded. With C, the server sends `which components + order + hints`, so I can launch a brand-new arrangement of **existing** registry components **without a release**. I also get **iOS/Android consistency** (one server contract instead of two codebases drifting) and **centralized, instant rollback** of an experiment. B loses all three."

📄 [`en/approach-evaluation.md`](./en/approach-evaluation.md)（B vs C 辨析）· [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)

---

### Q2. Draw the precise line — what can C change from the server with no release, and what still needs one?

**一句话:** Server config 免发版:**哪些组件 / 顺序 / 显隐 / hints / 实验路由 / 用哪个 earning model**。仍需发版:**新组件类型 / 给已有组件改样式(那是 "how",归 mobile)/ 改组件数据语义(走 v2 组件)**。

> "No release — server config: which components, their order, show/hide, presentation hints, experiment routing, which earnings model. Needs a release: a brand-new component *type*, restyling an existing component — that's the 'how', which mobile owns — or changing a component's data semantics, which I'd ship as a v2 component. I'm honest that C doesn't let me restyle from the server; it lets me change *what* and *order*, not *how*."

📄 [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Consequences / 负面）

---

### Q3. A and C look similar — both send structured data. What's the real difference?

**一句话:** **string-on-wire vs value-on-wire**;A 把算力(渲染)放在**延迟热路径**上集中算,C 把它**推到边缘**(5 万台手机,免费、并行、原生)。

> "A sends the *finished display string* — '$11.76' — so the client is a painter. C sends the *value* — `1176, currency CAD` — so the client can do value-driven things A can't: count-up animation, re-format on locale change, conditional highlight, long-press to expand a breakdown. And it's a latency/cost argument: A renders centrally on the 200ms hot path at 2M/h; C pushes rendering to 50k phones — free, parallel, native. A is really a spectrum that, as you make it richer, converges toward C anyway."

📄 [`en/approach-evaluation.md`](./en/approach-evaluation.md)（A vs C 辨析）

---

### Q4. You're adding 4 components on the hot path at 2M/h with ~20ms headroom. Convince me you don't blow the 200ms p95 — including p99 and a slow dependency.

**一句话:** 这 4 个加起来 **~10ms 预算(不是实测)**,p99 大头是 **Temporal pay+bonus ~150ms**;新依赖**不挂同步阻塞调用** —— miss 读 last-good、慢/挂 fail-closed 到 control,所以"+10ms 不会 tail-spin"。

> "Three points. **One:** those four are a rounding error — the p99 tail is dominated by the Temporal pay+bonus calls at ~150ms, ~80% of the budget; my components are sub-millisecond in-memory work, and the ~10ms is a *budget*, not a measurement — I'd load-test before rollout. **Two:** flags and templates are cached with a short TTL; a cache **miss reads last-good** and refreshes in the background, so the courier never waits on the flag service. **Three:** the resolver **fails closed** — can't resolve in time, the courier gets the control layout, never an error or a hang. A slow dependency degrades the *experiment*, not the *offer*. I'd alarm if fallback fires above ~1%."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Latency Budget / how to create headroom）· [`en/courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md)

---

### Q5. A courier sees treatment, reopens 5 min later and sees control. How do you guarantee no flip — and does it survive cache eviction / server restart?

**一句话:** 分桶是**算出来的不是存出来的**:`hash(courierId+experimentId) % 100 < treatment_pct`,确定性纯函数 → 同输入永远同桶 → 没有状态可丢,eviction/重启都不翻。

> "Assignment is deterministic, not stored. `hash(courierId + experimentId) % 100` gives each courier a stable number 0–99, compared to `treatment_pct`. Same courier, same experiment, always the same bucket — it's a pure function of a stable ID, so a cache eviction or restart can't flip anyone; there's no per-courier state to lose, and it's sub-ms with no DB lookup. Ramping is monotonic: 10%→50% only *adds* couriers, never removes existing ones. I hash on courierId **+** experimentId so experiments de-correlate. Region only gates *eligibility*; the bucket is always keyed on courierId, so changing region never flips a variant. And it fails closed to control."

📄 [`zh/sticky-bucketing-explained.md`](./zh/sticky-bucketing-explained.md)（逐段讲透）· [`demo/server/lib/hash.js`](./demo/server/lib/hash.js)（真实代码）

---

### Q5b. You have `earnings_v1` and `earnings_v2`. Can the same courier end up in *both* buckets?

**一句话:** 看是"一个实验的两个臂"还是"两个独立实验"。**一个实验多臂 → 不可能**(单号落单带,结构性互斥);**两个独立实验 → 数学上会**(`+experimentId` 故意去相关),同屏即 **collision**,要么建模成一个多臂实验,要么用 **mutual-exclusion group**。

> "Depends on whether they're one experiment or two. If v1 and v2 are **two arms of one experiment**, the single hash gives each courier one number that falls in exactly one band — control / v1 / v2 — so overlap is impossible by construction. If they're **two separate experiments**, then yes, mathematically a courier can be treatment in both, because we deliberately hash on `courierId + experimentId` to **de-correlate** experiments. That's a feature when the experiments are independent, but a **collision** if both render the same surface. I'd prevent it by modeling competing variants as **one multi-arm experiment**, or with a **mutual-exclusion group / layer** for experiments that share a surface."

📄 [`zh/sticky-bucketing-explained.md`](./zh/sticky-bucketing-explained.md)（multi-arm 三阈值 + 碰撞 + 互斥组）

---

### Q6. The mobile lead pushes back: "Hybrid dumps complexity on us. Just send finished strings (A)." They're senior and don't report to you. How do you win this in the room?

**一句话:** 不靠权威靠影响力:把移动团队变成 **co-author(共写 RFC)而非下游**,正面回应他们的核心顾虑——用 **bounded registry(~10–15)+ 共享 schema codegen** 把复杂度**有界化**,并用一个 POC 让事实说话。

> "I don't win it on the whiteboard, I win it by making the mobile lead a **co-author** of the contract, not a downstream consumer. Their real fear is unbounded complexity, so I address *that* directly: a **locked registry** of ~10–15 components, a **shared schema that codegens** Kotlin and Swift from one source — no hand-parsing, no drift — and forward-compat skip so they're never blocked by the server. Then I de-risk with a **small POC** on one offer screen and let the data settle it. The framing isn't 'backend won' — it's 'we shipped a contract that gives them native UX *and* gives us experiment velocity, with their complexity bounded by design.'"

📄 [`en/technical-leadership.md`](./en/technical-leadership.md)（7 步推动法）· [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Mitigations）

---

### Q7. How do you migrate off the hardcoded `Offer.java` safely? What's the rollback story?

**一句话:** 4 阶段、每步秒级可回滚:**no-op foundation → dual payload(新旧并发,影子比对)→ flag 1%→100% → 实验上线**;回滚就是把 flag 调回 0。

> "Four phases, each reversible in seconds. Phase 1: ship the new pipeline as a **no-op** that reproduces today's payload byte-for-byte. Phase 2: **dual-emit** — old and new in parallel, shadow-compare, no user impact. Phase 3: flag rollout 1%→100% with the sticky hash. Phase 4: experiments go live. Rollback at any phase is just turning the flag down — no deploy. I watch p95/p99, acceptance rate per variant, dispute rate, crash rate, and flag-fallback rate."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Migration Strategy + Metrics）

---

### Q7b. How many people and how long? What does this cost to build?

**一句话:** 不冷报数字 —— 我**按阶段拆、按谁做各自估、用一个 1–2 周 POC 当 gate**;粗估 **~1 个 quarter 到第一个实验上线**,小常备团队(~2 后端 + 2 移动 iOS/Android + 兼职 data/QA),**最大单项成本是移动端 registry + 共享 schema codegen + 契约设计**(C 已知的前期税),**持续成本是组件治理**。人/时间线最终是 **TM 拍板**,我给技术拆解和风险。

> "I wouldn't quote a number cold — I'd break it into the phases we already have and size each with the team that'll do it. Roughly:
>
> | Phase | Who | Rough effort |
> |---|---|---|
> | 0. Contract + RFC (component schema, registry v1 scope) | BE + mobile leads + me | ~2–3 weeks |
> | 1. No-op foundation (new pipeline reproduces today's payload) | Backend | ~1 sprint |
> | 2. Dual-emit + registry v1 (~4–5 core components) + shared-schema codegen | Backend + iOS + Android **in parallel** | ~2–3 sprints (the bulk) |
> | 3. Flag rollout 1%→100% + bake | Backend + data | ~1 sprint + bake |
> | 4. First real experiment live | full | ~1 sprint |
>
> So **about a quarter to the first experiment**, with a small standing team — say two backend, two mobile split across iOS and Android, and part-time data and QA. The **biggest single cost is the mobile side** — the component registry, the codegen pipeline, and the upfront contract — that's C's known tax, and it's a *one-time* investment that every later experiment amortizes against. The **recurring cost is governance** — the review board that keeps the registry from sprawling.
>
> Critically, I'd **gate the whole thing on a 1–2 week POC**: one screen, three components, real codegen end-to-end. If the contract is painful, we learn it cheaply before committing the team — that's the fail-fast posture. And these are *estimates* I'd refine with the teams; the final staffing and timeline call is the TM's — I'm giving them the technical breakdown and the risk."

**深水追问 & 一行回:**
- *"What's the cost of NOT doing it?"* → "Every experiment stays a backend bottleneck + an app release; we can't personalize earnings or A/B test — the business asks that started this don't get answered."
- *"Why not just buy a SDUI framework?"* → "We already push structured JSON on an event-driven stack; C is an *evolution* of that, not a greenfield buy. A vendor framework adds a dependency and still needs our contract + registry work — most of the cost doesn't go away."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Migration phases）· [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md)（Consequences / 前期成本）· [`en/handOver.md`](./en/handOver.md)（数字需向真实 repo 核实）

---

### Q8. Offers are pushed (SSE/AppSync). What happens when the push fails — does a courier miss an offer?

**一句话:** **push 是延迟优化,不是 source of truth**;靠 reconnect 时 **pull 对账 + offer_id 去重 + TTL 感知重投**兜底;业务安全网=**过期→重派给下一个 courier + 首个 ACK 原子 claim**。

> "Push is a latency optimization, never the source of truth. On reconnect the client **pulls** the current offer state and reconciles; every offer has an **offer_id for dedup** and a TTL so we can safely redeliver. The business safety net is the real guarantee: if an offer isn't accepted before it expires, it's **re-offered to the next courier**, and the first ACK wins via an **atomic claim** — so a dropped push never loses an offer or double-assigns one."

📄 [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md)（Offer Delivery Resilience）· [`zh/runtime-dataflow.md`](./zh/runtime-dataflow.md)

---

### Q9. Old app versions don't know your new components. How do you not break them?

**一句话:** **forward-compat skip(未知组件静默跳过)+ `min_app_version` 协商 + fallback layout**,所以 server 可领先 app 发布。

> "Forward-compat is built into the contract: mobile **silently skips unknown components**, so the server can ship ahead of the app. For payloads an old app genuinely can't render, the server checks `min_app_version` and sends a **fallback layout** built from components that version *does* have. So old apps degrade gracefully instead of crashing."

📄 [`en/app-version-compatibility.md`](./en/app-version-compatibility.md)

---

## UC2 — Guiding a Real-Time Fraud-Detection Team (Kafka + Flink)

### Q10. As a Staff Engineer, how is your role here different from the Technology Manager's?

**一句话:** TM 管**人和优先级**;Staff 管**技术方向和能力建设** —— 我**诊断、引导、留下能力**,不替他们写完。

> "The TM owns people, priorities, and delivery commitments. I own technical direction and capability. On this team I diagnose the system, *guide* the engineers to the fix rather than handing them a patch, and leave the team more capable than I found it. I work *with* the TM — I surface technical risk and options; they make the staffing and timeline calls."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)（5 个考察点）

---

### Q11. The pipeline lags ~45s behind real-time. How do you diagnose it?

**一句话:** 先看**遥测不猜**:Flink **backpressure**(最可能的元凶)、checkpoint 时长/失败、**watermark 落后**、**数据倾斜(热 key)**、source consumer lag。

> "I start from telemetry, not guesses. In the Flink UI I look for **backpressure** — which operator is the bottleneck pushing lag upstream; **checkpoint** duration and failures; **watermark lag** versus event time; **key skew** — a hot key overloading one slot; and Kafka **consumer lag** at the source. Forty-five seconds of steady lag usually means a backpressured operator or undersized parallelism, not a code bug — so I measure before anyone changes code."

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md) · [`zh/flink-kafka-notes.md`](./zh/flink-kafka-notes.md)（背压/watermark/窗口 Q&A）

---

### Q12. Give me your first 3-day plan.

**一句话:** **Day1** 听+读+看遥测(不动代码);**Day2** 和工程师一起定位瓶颈、形成假设;**Day3** 一起验证最小修复 + 留下 RFC 骨架让团队自己推进。

> "Day 1: listen and read — architecture, the Flink dashboards, recent incidents — and pair with engineers; I change nothing. Day 2: form a hypothesis *with* them from the telemetry (likely backpressure or skew) and design the smallest experiment to confirm it. Day 3: validate the minimal fix together and leave behind an **RFC skeleton with the open questions**, so the team drives it forward — I'm transferring capability, not parachuting a patch."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) · [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md)

---

### Q13. How do you guide without just solving it for them?

**一句话:** 给**框架和问题,不给答案**:用 RFC 骨架 + reviewer 提问,让工程师自己填,我把关推理过程。

> "I ask the questions a senior reviewer would and let them find the answer. Instead of 'change parallelism to 8,' I ask 'which operator is backpressured, and what does the watermark tell us?' I hand them an **RFC skeleton** — structure plus the open questions — and review their reasoning, not just their patch. They own the fix; I ensure the *thinking* is sound and durable."

📄 [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md)（刻意留白 + reviewer 提问）· [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

---

### Q14. Do they even need Flink? What data volume justifies it?

**一句话:** **先量再说** —— UC2 没给量,~20 events/s(只算派单)用 Kafka consumer / KStreams 就够;但 GPS ping 会把量推到**每秒数千**,那才需要 Flink 的**event-time 窗口 + keyed state + 背压处理**。诚实地说"取决于实际吞吐,我会先测"。

> "Honestly, it depends on volume the prompt doesn't give. If it's delivery events only — roughly tens per second derived from 50k couriers — a plain Kafka consumer or Kafka Streams handles it. Flink earns its keep when you add **GPS pings**, which can push it to thousands per second and need real **event-time windowing, keyed state, and backpressure handling**. So my answer to the team isn't 'rip out Flink' or 'keep Flink' — it's 'let's measure actual throughput and the stateful-window requirements first, then right-size.'"

📄 [`en/fraud-detection-explained.md`](./en/fraud-detection-explained.md)（when do you actually need Flink + 右-sizing 说明）

---

### Q15. How do you transfer knowledge so the team doesn't regress after you leave?

**一句话:** 30/60/90 —— **30** 跟我 pair / 我做 reviewer;**60** 他们主导我旁观;**90** 团队自治,我只在升级时介入。沉淀成 runbook + RFC,不进我脑子。

> "A 30/60/90 ramp. First 30 days we pair and I'm the reviewer on their RFCs. By 60 they lead the diagnosis and I just observe. By 90 the team is autonomous and I'm only pulled in for escalations. The knowledge lands in **runbooks and RFCs**, not in my head — the test is whether they handle the *next* incident without me."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)（KT 30/60/90）

---

### Q16. How do you work with the TM and the Principal engineers without stepping on toes?

**一句话:** 分工清楚:**TM 管人/优先级,Principal 管跨域架构,我管这条流的技术方向**;我把选项和风险摆出来,决策权留给对的人。

> "Clear lanes. I bring the TM technical risk and options so they can make priority and staffing calls. With the Principals I align on cross-cutting architecture — I'm not overriding them, I'm making this pipeline's direction consistent with the broader platform. I influence through written RFCs and shared diagnosis, so decisions are owned by the right people and survive scrutiny — that's influence, not authority."

📄 [`en/team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md)

---

## 通用 / 行为题(若被问到)

### Q17. What's the one decision you're least sure about?

**一句话:** 诚实地说 C 的**移动端复杂度**和**组件治理**是真实代价 —— 我用 bounded registry + co-owned RFC 缓解,但如果业务只需要极少数固定布局,A 可能更省。展示**会权衡、不教条**。

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
