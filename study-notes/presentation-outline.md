# Staff Engineer Interview — Presentation Outline (1 hour)

> English version: [`../en/presentation-outline.md`](../en/presentation-outline.md)
>
> 这是把所有准备材料整合成的「**一小时演讲大纲**」。
> 每张 slide 给出：**标题**（英文，可直接做 PPT）+ **要点**（演讲用）+ **讲解备注（中文）** + **时间**。
> 目标：1 小时讲完两个 Use Case，覆盖 PDF 里全部 9 个考察点（UC1 的 4 个 + UC2 的 5 个）。

---

## 时间预算（先记住这张表）

| 段落 | 内容 | 时长 | 累计 |
|------|------|------|------|
| 开场 | Title + Agenda | 2 min | 2 |
| **UC1** | 问题 + 现状 | 5 min | 7 |
| **UC1** | 技术决策 A vs B vs C（评估+推荐+为什么） | 6 min | 13 |
| **UC1** | 系统设计（C 的目标架构） | 9 min | 22 |
| **UC1** | 延迟 & 规模分析 | 3 min | 25 |
| **UC1** | 技术领导力（移动团队） | 5 min | 30 |
| **UC1** | 迁移策略 + 指标 | 4 min | 34 |
| **UC2** | 问题 + 核心原则 | 3 min | 37 |
| **UC2** | Staff vs TM 边界（RACI） | 3 min | 40 |
| **UC2** | 诊断提问 | 4 min | 44 |
| **UC2** | 3 天行动计划 | 5 min | 49 |
| **UC2** | 指导技巧（不替他们做） | 3 min | 52 |
| **UC2** | 长期知识传递 | 2 min | 54 |
| **UC2** | 与 TM/Principal/Leadership 协作 | 3 min | 57 |
| 收尾 | 两句收尾金句 + Q&A | 3 min | 60 |

> ⏱️ **时间纪律**：题目给的是**整整 1 小时**（别照"45-50 分钟"去压缩——那是另一种 format）。规划 ~30 分钟 UC1 + ~20 分钟 UC2，但**别排成 54 分钟单口相声——全程欢迎提问、当成对话**；下面每段的分钟数是上限，不是死读。
> 如果超时，UC1 优先砍「延迟分析」的细节，UC2 优先砍「长期知识传递」的细节——但每个考察点都要"点到"，不能整块跳过。

---

## 演讲叙事主线（一句话）

> **UC1 我证明我能做架构和技术决策；UC2 我证明我能放大团队、而不是替团队干活。**
> 两个 case 其实在考同一件事的两面：**Staff = 既能拿出正确的技术方案，又能让别人接受并维护它。**

## ⭐ JD 关键词（讲的时候务必"撞上"这些词）

招聘 JD（见 `job-description.md`）逐字写出了面试方在意什么。这两个 case 就是按这些词设计的——所以全程要主动命中：

| JD 关键词 | 在哪里撞上 |
|-----------|-----------|
| **"influence, not authority"**（影响力而非权威） | 🔴 全场主线：开场点题 + UC1 领导力收尾 + UC2 收尾，都**显式说出这个词** |
| **"fail fast" / hands-on POCs / rapid prototypes** | 🔴 亮出可运行 `demo/` 当 POC；UC1「proof not vote」、UC2「3 天发 1 个 pattern」都贴上 fail-fast 标签 |
| **event-driven architecture & distributed systems** | UC1 系统设计页**显式命名**为 event-driven，并把 fail-closed/双写/幂等/粘性 hash 当分布式系统设计卖点 |
| **big data & near real-time data processing** | UC2 **先用真流式概念诊断（watermark/backpressure/并行度/checkpoint）证明懂行，再下 right-sizing 结论** |
| lead / coach / develop（团队 ~55 人） | UC2 知识传递 30/60/90 + force-multiplier 收尾 |
| cloud（AWS） | UC1 点名 AWS：SQS / AppSync / Temporal |
| third party integration planning | UC1 提一句外部服务（Data Science 定价 / Courier Pay / Bonus）的集成 + 超时/重试 |

> 角色在**加拿大** → UC1 例子优先用 CA（Calgary）市场，顺势而为。

---

# 开场（2 min）

## Slide 0 — Title & Agenda

**要点（slide 上写）：**
- Courier Offering System Modernization (Use Case 1)
- Team Guidance: Real-time Fraud Detection (Use Case 2)
- Agenda: Decision → System Design → Leadership → Migration ‖ Diagnose → Guide → Recover → Grow

**讲解备注：**
- 一句话定调："我会用大约 32 分钟讲 UC1、22 分钟讲 UC2，留几分钟 Q&A。"
- 点出主线（上面那句）："这两个 case 在我看来考的是 Staff 的两面：一面是技术判断，一面是组织放大。"
- 🔴 **第一句就埋 JD 关键词**："我对 Staff 的理解是——通过**影响力而非权威（influence, not authority）**驱动技术决策，并且**动手做 POC、快速试错（fail fast）**。今天两个 case 我都会照这个标准来答。" → 让面试官在第一分钟就听到他们写在 JD 里的话。
- 让面试官知道你**会管理时间**——这本身就是 Staff 信号。

---

# Use Case 1：快递员 Offer 系统现代化

## Slide 1 — Problem & Constraints（合并：问题 + 现状，5 min 的前半）

**要点：**
- 15 countries · 50,000+ couriers · 2M offers/hour peak (~556 RPS sustained, ~1500 peak)
- SLA: 200ms p95 (today ~180ms → **only ~20ms real headroom**)
- 4 business needs: A/B test presentation · personalized earnings · gradual rollout · multiple earning models
- Today: **one hardcoded `Offer.java` template** (329 lines), earnings logic scattered across 3 services, every change = full multi-region deploy, **zero experimentation**

**讲解备注：**
- 先把约束钉死，尤其 **20ms headroom** 这个数字——后面所有设计都要"活在这 20ms 里"。这是面试官最容易追问的点。
- 强调痛点是**僵化**："不是性能不行，是改不动、试不动。任何展示改动都要全区域发版。"
- 把 4 个业务需求念一遍，告诉面试官"我后面的架构会逐条对上这 4 个"。

## Slide 2 — Current Architecture（5 min 的后半）

**要点（画/贴现有流程图）：**
- `Courier Management → courier_offer_service → delco_orchestrator (Temporal) → courier_mobile_async_service → AppSync (WebSocket) → Mobile`
- Pay/bonus 由 Temporal workflow 5 步组装（pricing → pay → bonus → publish）
- Mobile 渲染**固定** offer 卡片，无 variant 字段、无 feature flag

**讲解备注：**
- 关键洞察一句话："系统**已经在往移动端推结构化 JSON 了**——所以混合方案不是推倒重来，是自然演进。"这是后面推荐 C 的伏笔。
- 不要在现状上花太久，1.5 分钟带过，重点是引出"哪里需要动"。

---

## Slide 3 — Technical Decision: A vs B（先只比题目给的两个）（~3 min）

**要点（先贴 A vs B 两方对比，凸显各自硬伤）：**

| 维度 | A (Template DSL) | B (Raw + Mobile) |
|------|------------------|------------------|
| 实验速度 | 快（服务端） | **慢（每次改都要发版）** |
| 200ms 风险 @2M/h | **高（服务端渲染）** | 低 |
| 原生 UX | **差** | 极好 |
| iOS/Android 一致性 | 保证 | **难** |
| Mobile 复杂度 | 最低 | **最高** |

- **谁都不完美**：A 换来实验速度，但牺牲原生 UX + 威胁 200ms；B 保住原生 UX，但每个 layout 实验都要发版。

**讲解备注：**
- 🔴 **先只摆 A/B**（题目给的两个），把各自硬伤讲透——别急着给答案，这是为下一页引出 C 铺垫。
- A vs B 的本质：presentation logic 在哪——A 在服务端（发字符串）、B 在 mobile（发原始数据）。
- 讲"$9.76 includes tip"例子：A 改文案要发后端；B mobile 自己格式化，但 layout 变体要发版。

---

## Slide 3b — Introduce Approach C（synthesis + 推荐）（~3 min，⭐ reveal）

**要点（C = 取两者之长）：**

| 维度 | **C (Hybrid) ✅** |
|------|-------------------|
| 实验速度 | 快（layout 不发版）/ 慢（仅新组件） |
| 200ms 风险 | 低 |
| 原生 UX | 极好 |
| 一致性 | 由共享组件契约保证 |

- **从 A 拿**：server 控 what+order → 实验不发版；**从 B 拿**：mobile 原生渲染 → 好 UX
- 一句话：**server 决定 what+order，mobile 决定 how**（component registry）
- **B vs C 的唯一本质区别**（最可能追问）：「显示哪些组件、什么顺序」B 里是 mobile 应用逻辑、C 里是 server 发的数据 → **C = B + server 控的 layout 描述符 + 实验分配上移**
- 诚实讲代价：前期契约 + 组件治理；改已有组件 schema 仍要发版/双发

**讲解备注：**
- 这页是 **reveal**——"题目框在 A/B，但答案是 C"。主动提出 C 是加分项。
- 行业佐证克制用：Airbnb / Uber / Lyft / Grab 都是 hybrid（支持论点，不替代论点）。
- 过渡到下一页："**既然选了 C，我来展示它具体怎么搭。**"
- 🎒 **深度备用弹药（被问再放，别主动全铺开——主线讲完即可）：**
  - 问"A 和 C 到底差在哪" → ① 线上是【字符串】还是【数值】（A 的端只能套样式，做不了数字滚动动画 / locale 重格式化 / 按值条件 / 长按看 base+tip 明细）② 算力：A 在延迟路径上中心化做格式化+i18n，C 推到 5 万台手机（免费/并行/原生）。详见 `approach-evaluation.md` 的 A-vs-Hybrid Q&A；demo 里展开 `/approaches` 的 "What's on the wire" 直接 show。
  - 问"B 和 C 到底差在哪" → 谁拥有 layout：B 在 mobile（flag 驱动应用逻辑）、C 在 server（发 layout 数据）。C = B + server layout 描述符 + 实验上移。详见 B-vs-Hybrid Q&A。
  - 问"老 app 不升级怎么办" → `app-version-compatibility.md`（加组件/加字段=安全；改语义=新组件 v2；删字段留到 min 版本退场；未知组件静默跳过）。

---

## Slide 4 — System Design: Target Architecture (Hybrid)（9 min，⭐ 核心）

**要点（画目标架构图，4 个新组件）：**
1. **Experiment Resolver** — 按 courierId/city/tier/zone 分配 variant；Caffeine 缓存 60s TTL；**确定性粘性** `hash(courierId+experimentId) % 100 vs treatment_pct`；flag 服务挂了 → **fail-closed 回落 control**；预算 ~3ms
2. **Layout Composer** — 输出 `components[]` + `hints{}`；JSON config，30s 轮询刷新，启动失败回落 bundled default；预算 ~2ms
3. **Unified Earnings Calculator** — 统一 flat / distance / surge / tips_prediction 四种模型（数据已由 Temporal 取到，只算不取）；预算 <10ms
4. **Offer Payload Builder** — 取代 `Offer.java`；按 app 版本分支输出（老 app 走 legacy，新 app 走 modular）

**讲解备注：**
- （接上页：既然选了 C，这页讲它怎么落地）这是 UC1 拿分的核心。**先讲"server 决定 what + order，mobile 决定 how"**这条分界线。
- 🔴 **开口先命名 JD 关键词**："现有系统是 **event-driven 的分布式架构**（SQS + Temporal + AppSync over AWS）——我的设计是在这条事件链上做增量，不是推倒重来。" 把它显式贴上 JD 要的 *event-driven architecture & distributed systems* 标签。
- 逐个组件讲，但每个都带上**延迟预算**和**失败模式**——Staff 不只画框，还讲"挂了怎么办"和"放不放得进 20ms"。把这些 failure mode（fail-closed 回落、双写、幂等、粘性 hash 不依赖缓存）**当作"分布式系统设计"的卖点**讲，而不只是实现细节。
- 粘性分配重点讲（面试常追问）："同一个快递员永远进同一组,因为是对 courierId 做确定性 hash，不依赖缓存，缓存淘汰也不会翻组。"
- 🟢 **third-party integration（JD 要点）**：顺一句外部服务集成——Data Science 定价 / Courier Pay / Bonus 的调用边界、超时与重试（Temporal 1.5s 信号 + REST 2s/3 retries），以及"bonus 失败可降级"这种容错策略。
- 🔴🔴 **现在就亮 Demo 当 POC（不要等到最后、不要说"如果允许"）**：JD 两次强调 *hands-on POCs / rapid prototypes / fail fast* ——主动说："我做了一个**可运行的 POC** 来验证这套方案。" 本地 `demo/` 实现了 Experiment Resolver（FNV-1a hash 分桶）+ component registry + control/treatment + 管理后台实时预览。这是你命中 JD "fail fast / 动手做原型" 的**最直接证据**，要当作加分项主动展示，而不是旁白。

## Slide 5 — The Payload Contract（夹在 Slide 4 里，~1.5 min）

**要点（贴一段精简 JSON）：**
```json
{
  "experiment": { "earnings_display": { "variant": "breakdown_v2", "group": "treatment" } },
  "layout": { "components": ["offer_header","earnings_breakdown","distance_summary","surge_indicator","accept_cta"],
              "hints": { "highlight_field": "surge", "theme": "urgent" } },
  "data":   { "earnings_breakdown": { "model":"surge","base_pay":450,"surge_amount":120,"tip_estimate":80,"total":730,"currency":"CAD" } }
}
```
- Server 发：**layout（顺序）+ raw data + hints**；Mobile 用 **component registry**（~10–15 个组件）渲染
- 同一份 delivery，CH/UK/CA 三个市场发**不同 layout + 不同 earning model**（per-zone 配置）
- 未知组件 → mobile **静默跳过**（forward-compat，老 app 安全）

**讲解备注：**
- 这页是"把抽象架构落到一个具体 payload"。面试官看到 JSON 会更信你想清楚了。
- 强调 registry 是**有界的**(10-15 个)——这是后面领导力部分"bounded complexity"的钩子。

---

## Slide 6 — Latency & Scale（3 min）

**要点：**
- 2M/hour = ~556 RPS sustained, ~1500 RPS peak
- 200ms 是 **p95 SLA**，不是平均；今天 ~180ms → **~20ms 真实 headroom**
- Hybrid 新增 on-path 工作：experiment ~3ms + earnings ~3ms + layout ~2ms + payload ~2ms ≈ **+10ms** → p95 ~190ms，**仍在 SLA 内，剩 ~10ms buffer**
- ⚠️ 不要"双重计算"：20ms 的新工作 + 20ms 的安全边际 是错的——只有一桶 20ms
- 兜底：若实测 Δ > 15ms → 把 experiment/layout **预计算下线**（离开请求路径），或从现有 30ms 组装路径里抠时间

**讲解备注：**
- 这页直接回应面试官最可能的追问："200ms 会不会是瓶颈？" 答案：**不是吞吐瓶颈，是延迟预算瓶颈。**
- 算一下 RPS 让面试官知道你会做数量级估算。556 RPS 对现代服务"很轻"——瓶颈从来不是 QPS，是那 20ms。
- 强调"这些是 target 不是 measurement，Phase 3 上线前要在真集群压测实测"——Staff 不把估算当事实。

---

## Slide 7 — Technical Leadership（5 min，⭐ 第 3 考察点）

> 题目：移动团队担心方案 B 增加他们的复杂度，你怎么推动这个决策？

**要点：**
- 原则：**Validate the concern, then sharpen it.**（先承认，再具象化）移动团队是对的——问题不是"是否增加"，而是"增加多少、什么类型、对面换来什么"
- 7 步推动法（slide 上列标题即可）：
  1. 书面承认顾虑（把 us-vs-mobile 变成 us-vs-problem）
  2. 开**工作会**不是宣讲会（两边 lead + 真正干活的人，**不带 PM/经理/听众**）
  3. 把"复杂度"具象化（是 LOC？iOS/Android 分叉？协作成本？还是 headcount？）
  4. 用**4 个权衡维度**重构讨论（让移动看到纯 A/纯 B 对他们其实更糟）
  5. 给**有界化**缓解措施（锁定 registry、codegen、forward-compat skip、组件复用、快照测试、co-owned RFC）
  6. 提议**小范围可逆原型**而不是投票（1 个 zone + 1 个组件 + 4 周 + 移动团队主导）
  7. 预先讲清**升级路径**（各写一页 → Principal/Director 定夺 → ADR 记录）

**讲解备注：**
- ⚠️ **这不是技术题，是行为题**。它在分辨你是 Staff（推动跨团队决策）还是 Senior（推销"正确答案"）。
- 🔴 **显式撞 JD 关键词**：开口就说"这正是 JD 里说的 **influence, not authority**——我不能用职级压移动团队，只能靠把权衡讲清楚、让他们自己看到答案。" 这一句直接命中招聘核心要求。
- 🟢 **把"proof not vote"贴上 fail-fast 标签**：第 6 步的"小范围可逆原型"就是 JD 要的 *fail fast / rapid prototype*——明说："与其开会投票，不如花 4 周在一个 zone 上做个可逆的小实验，用数据说话，错了就回滚。这就是 fail-fast。"
- 关键反模式要主动点名："最容易翻车的做法是预先写好决定、拿去会上'走个流程'——移动团队会立刻看穿，信任崩塌。"
- **原型由移动团队主导**这点要强调——这去掉了"你在把方案强加给我们"的框架。
- 落地金句（背下来，结尾说）：
  > *"我的工作不是赢得架构辩论,而是让真正要交付和维护它的团队成为这个决定的共同作者。我推荐 C,但我宁可让移动团队完全认同地做 B,也不要他们表面服从、心里抵触地做 C。"*
- 这句话是 Senior 和 Staff 答案的分水岭——它正是 *influence over authority* 的具体体现。

---

## Slide 8 — Migration Strategy & Metrics（4 min，⭐ 第 4 考察点）

> 题目：你会追踪哪些指标确保迁移成功？

**要点（4 个阶段，强调可回滚）：**
- **Phase 1（W1-3）Foundation**：加 3 个新组件的 no-op 版本（resolver 永远返 control、calculator 包旧逻辑、composer 返默认 layout）→ **行为零变化**，shadow mode 对比验证
- **Phase 2（W4-6）Dual Payload**：`data`(legacy) + `data_v2`(modular) 双发；移动团队开始实现 registry；对比字段 parity
- **Phase 3（W7-10）Flag Rollout**：移动发版（registry + fallback）；接**真实** flag 服务；1%→5%→25%→50%→100% 按城市灰度
- **Phase 4（W11-14）Experiment Live**：跑第一个**内容** A/B（区别于 rollout flag）；加 surge/tips 模型；逐步下线 legacy
- **Rollback**：feature flag 秒级关闭 + 双写 → mobile 永远能回落 `data` 字段，零数据丢失

**追踪指标（分 4 类）：**
| 类 | 指标 | 目标 |
|----|------|------|
| SLA | p95 / p99 延迟 | ≤200ms / ≤300ms |
| 业务 | acceptance rate / time-to-accept / complaint rate（按 variant） | 不回归 |
| 实验 | 分配一致性 / flag fallback rate / idea→live 时间 | 100% / <1% / <1 week |
| 迁移 | % offers on v2 / legacy vs v2 字段 parity | 追踪 / 100% |

**讲解备注：**
- 强调**护栏指标 (guardrail)**："不是只看 acceptance rate 涨没涨,要看 complaint rate / crash rate / 延迟有没有**回归**——A/B 实验里护栏比北极星更重要。"
- 强调"业务指标按 **variant** 分组看"——否则 A/B 没意义。
- 一句话收尾 UC1："整个迁移的设计原则是**任何一步都能秒级回滚**,双写让 mobile 永远有退路。"

---

# Use Case 2：团队指导 — 实时欺诈检测

## Slide 9 — The Situation & The Principle（3 min）

**要点：**
- 4 人团队(各 2-3 年)、Kafka+Flink、延迟 45s（目标 <5s）、scope 3→12、数据质量未知、无测试策略、**3 天后 sprint review 没东西可演示**、士气低、有人想推倒重来、PM 在向上升级
- **核心原则：The crisis is the deadline, not the architecture.**（危机是 deadline,不是架构）
- 最常见的 Staff 翻车点：冲进去重写架构、写关键路径代码、"拯救" sprint → **解决了 demo,搞坏了团队**
- 正确的、更难的做法：**买时间、砍范围、诊断式辅导、让团队交付他们自己理解的东西**
- 第二原则：**那个想"推倒重来用更简单方案"的工程师可能是对的**——认真对待,别用"我们已经投入 Flink 了"打发

**讲解备注：**
- 开场就定调："我不会去当救火队员。我的角色是放大这个团队,不是替他们交付。"
- 这页就是在回答 PDF 反复在测的 meta 问题:**你能不能不接管地做 force-multiplier?**

## Slide 10 — Staff vs Tech Manager Boundary (RACI)（3 min）

**要点（贴边界表）：**
| 事项 | TM 负责 | Staff 负责 | 共担 |
|------|---------|-----------|------|
| Sprint 范围/deadline | ✓ | | 帮 TM 做技术论证 |
| 与 PM/leadership 谈判 | ✓ | | 提供技术框架 |
| 个人绩效/职业 | ✓ | | 提供技术信号 |
| 团队士气 | ✓ | | 指出技术性挫败来源 |
| 架构 / 测试策略 / RFC | | ✓ | |
| 知识传递 / mentorship | | ✓ | TM 提供资源 |
| Sprint review 叙事 / 升级处理 | | | ✓ 共同塑造 |

- 第一个 30 分钟:**和 TM 做 1:1 把这条线画清楚**
- 两个陷阱:① 踩进 TM 的活(替他和 PM 谈、单方面砍范围)② 让 TM 在你缺席时拍技术板

**讲解备注：**
- 题目明确写了"你不是 TM,而是和 TM 协作"——这页直接回应,**必讲**。
- 一句话:"用 TM 的权威而不和他协调,会架空他、也让团队困惑。"

## Slide 11 — Diagnostic Questions（4 min，⭐ 第 1 考察点）

**要点（5 个桶,每桶挑 1-2 个问题讲,别念全部 30 个）：**
- **架构(45s 问题)**："端到端在白板上走一遍数据流"/"45 秒花在哪——ingest/处理/sink?是测出来的还是猜的?"/"每分区峰值事件率?并行度?"/"算子里有没有同步 I/O?"
- **🔑 最关键的一问**："Flink 真的适合我们的事件率吗?测过吗?" → 50K 快递员 × ~30 单/天 ≈ **150 万事件/天 ≈ 平均 20 事件/秒、峰值 ~100/秒**;**Flink 是为 100k+ 事件/秒设计的——团队在为用不到的容量交复杂度税** ⚠️ **注:UC2 没给体量。~20/秒只数了送达事件;算上 GPS ping 可能到几千/秒(UC1 的 2M/hr≈556/秒 也佐证平台已在几百/秒)。区间横跨"过度"与"合理"——所以别断言过度,先测真实事件率,这才是 Staff 说法。**
- **范围(3→12)**："12 个里 stakeholder 这季度最想要哪 3 个?"/"只发原始 3 个,headline 业务结果还成立吗?"(通常成立)
- **数据质量**："多少 % 事件缺位置数据?按城市分布?"/"'不完整'是 null/默认值/过期/完全缺失?"/"缺失时正确行为是丢弃/标可疑/进死信/等晚到?"
- **测试**："现在怎么端到端测一条欺诈规则?演示给我看"/"有没有 known-fraud / known-clean 的标注语料?"

**讲解备注：**
- 🔴🔴 **叙事顺序很关键（针对 JD 的 "near real-time data processing" 要求）**：**先用真流式概念诊断、展示你懂行，再下"可能过度设计"的结论。** 顺序是 ① watermark / event-time、② backpressure、③ 并行度 / 热 key、④ checkpoint / 同步 I/O ——把这些点完，面试官已经认定"这人懂流式"；**然后**才抛出 20 events/sec 的 right-sizing 结论。
- ⚠️ **不要让"Flink 是过度设计"成为开场白**——对着一份明确要 streaming 经验的 JD，那会被读成"他在绕开流式"。要让它是**深度之后的判断**，不是回避。一句话定调："我能诊断到 Flink 层面，也正因为懂它，才看得出这个量级未必需要它——这是 right-sizing，不是 avoidance。"
- 强调技巧:**分波提问,不要一次甩 30 个**。Wave 1 听他们讲、Wave 2 针对性追问、Wave 3 单独 1:1。
- "这些问题是诊断工具——用对了,是教团队**怎么想**,而不只是告诉他们**想什么**。"
- 那套 **"数量级估算 + 取决于是否算 GPS + 所以先测"** 的推导是 UC2 最亮的技术点,务必讲清楚——但放在**展示完流式深度之后**。别把 ~20/秒 当成定论。

## Slide 12 — The 3-Day Action Plan（5 min，⭐ 第 3 考察点）

**要点：**
- **承重决策:狠心砍范围。** 选**最简单但能讲清架构**的 1 个欺诈模式做 demo:"快递员在离目的地 >500m 处标记送达"——数据都已有,就一个距离计算,有没有 Flink 都能 <5s 跑通
- **Day 1**:① 和 TM 1:1 对齐 RACI + 谁去跟 PM ② 60 分钟全员架构走查(产出**他们的**瓶颈清单)③ 范围锁定会(TM+团队+PM,**1 个模式入选、11 个延后、PM 书面同意**)④ 下午结对(工程师敲键盘,你提问)
- **Day 2**:继续结对 + 写**第一个测试 fixture**(5-10 条正负样本)+ 和 TM 起草 sprint review 叙事 + 单独听"推倒重来"工程师
- **Day 3**:团队彩排(他们讲你看)+ 和 TM 一起**预先 brief Director** + 安排 demo 后的架构 retro
- **Sprint review 当天**:你坐观众席,**团队讲、拿功劳**;TM 主导砍范围叙事;只在架构问题需要时你和 TM 一起出面
- demo 三种可接受结果(降序):① 真流式 demo 1 个模式 sub-5s ② 批处理 demo + 诚实说明差距 ③ 架构 review(高风险,仅当 1/2 都不可能)。**避免:半成品流式 demo 现场挂掉**

**讲解备注：**
- 承重句:"团队的问题不是做不出 12 个,是想发 12 个而其实 1 个就能讲完故事。"
- 强调**砍范围要 PM 书面确认 + 提前 brief 领导**——"绝不让团队在 review 现场被敌意升级单独面对。"

## Slide 13 — Guidance Technique: guide, don't solve（3 min，⭐ 第 2 考察点）

**要点：**
- **Pair, don't solve** / **白板画原理,不给方案** / **code review 用提问**("这个 map 为 null 会怎样?"而非"加个 null 检查") / **帮他们写 RFC,你只批注** / **拉 Principal 做第二意见,让团队来讲** / **给阅读清单**(DDIA ch.11、Streaming Systems ch.1-3、Flink Concepts)
- worked example(45s 延迟):
  - ❌ Senior:"应该是 backpressure,加 async I/O、并行度翻倍"
  - ✅ Staff:"延迟分解长啥样?哪步最慢?" → "指标说那步在发生什么?" → "怎么验证这个假设?" → "跑这个实验,结果能告诉我们什么?"
- 但**别走另一个极端**:如果他问"checkpoint 一般按 ms 还是 s 算?"——直接答"通常 ms"。藏事实不是辅导

**讲解备注：**
- 一句话:"同一个终点,不同的路。Staff 版教的是**调试方法**,Senior 版教的是**症状→修法**的映射。"
- 强调度的把握:既不替他们写,也不死活不给答案。

## Slide 14 — Long-term Knowledge Transfer (30/60/90)（2 min，⭐ 第 4 考察点）

**要点：**
- **30 天**:流式基础读书会(2h/周×4)+ 外部流式工程师 2 场 + 架构 office hours(1h/周)
- **60 天**:每人做一个 Flink toy project(窗口+晚到事件)+ 团队写 v2 RFC + 读另一个团队的真实 Flink job
- **90 天**:每人给其他人讲 1 个流式概念(窗口/watermark/exactly-once/state/backpressure)+ 指定 1 人当团队 streaming expert + 与有经验团队结对持续 review
- **关键原则:别让他们孤立地学。** 如果组织内有跑生产流式系统的团队,去搭桥——**跨团队知识传递比团队内自学快**

**讲解备注：**
- 一句话:"这是**预防下一次 3 天危机**的部分。没有它,两个月后我又会站在这个房间里。"
- 强调"teaching is the highest form of learning"——90 天让他们**讲出来**就是真的会了。

## Slide 15 — Working with TM / Principals / Leadership（3 min，⭐ 第 5 考察点）

**要点：**
- **与 TM(你的 peer)**:crunch 期每天 15 分钟同步;架构走我、范围归他、个人反馈归他、review 叙事共写 TM 讲、升级一起进门;**不绕过 TM 直接给工程师下指令**
- **与 Principal**:早期拉来做架构第二意见 + pattern-matching("你见过 Flink 选错工具的情况吗?怎么收场的?");**不是让他们替你干活,也不是越过 TM 的政治后台**
- **与 Leadership(PM 正在升级到的人)**:**抢在 PM 之前,和 TM 一起 brief**:
  > "我们发现团队为一个(按测得量级)远低于 Flink 设计点的负载选了 Flink,正在交复杂度税、拖慢交付。我们已把 sprint 砍到 1 个模式,用接下来 30 天正式评估架构是否要换,[日期]前给建议。希望你在这期间给我们对 PM 的 air cover。"
- 好的领导汇报:**诚实讲哪里错了(但框为工程判断不是甩锅)+ 具体时间线 + 具体诉求("air cover"是真诉求,"support"不是)+ TM 和 Staff 一起**

**讲解备注：**
- 强调"start over 工程师是对的"那个场景的处理:**公开表扬他、把 Flink 的工作框为"没白做"(它暴露了数据质量/范围/真实事件率问题)、自己认领教训**。"团队会比之前更强,而不是更弱——这就是 Staff 指导的产物。"

---

# 收尾（3 min）

## Slide 16 — Closing: Two Postures

**要点(两句收尾金句,各对一个 case)：**
- **UC1（领导力）：** *"我的工作不是赢得架构辩论,而是让真正交付和维护它的团队成为决定的共同作者。我推荐 C,但宁可让移动团队完全认同地做 B,也不要他们表面服从、心里抵触地做 C。"*
- **UC2（团队指导）：** *"我的角色是让这个团队更擅长这件事——而不是替他们做。3 天 deadline 是要导航的约束,不是要表演的演出。如果我做对了,这个团队下次做流式项目不再需要 Staff 空降救援。"*
- 一句话合题：**Staff = leverage over time, not heroics in the moment.**
- 🔴 **最后一句回扣 JD（首尾呼应）**："这两个 case 我都是用同一套标准答的——**通过影响力而非权威驱动决策（influence, not authority），动手做 POC、快速试错（fail fast）**。这正是我理解的 Staff，也正是这个角色需要的。"

**讲解备注：**
- 这两句金句 + 最后那句 JD 回扣，是整场的"记忆点",一定背熟、放在最后讲。开场埋的 *influence, not authority* / *fail fast* 在这里收口，形成首尾呼应。
- 然后开放 Q&A:"这两个 case 我都准备了更深的细节——架构、迁移、组件治理、流式诊断,**还有一份可运行的 POC**,欢迎往任何方向追问。"

---

## 附:可能被追问的硬问题 & 一句话答案

| 追问 | 一句话答 |
|------|---------|
| 200ms 会是瓶颈吗? | 不是吞吐瓶颈(556 RPS 很轻),是延迟预算瓶颈——只有 ~20ms headroom,hybrid 占 ~10ms,实测前不当事实。 |
| 为什么不选纯 A? | A 把 presentation logic 锁在服务端:加动画/RTL/原生交互做不到,且 2M/h 服务端渲染吃延迟。 |
| 为什么不选纯 B? | B 每个 layout 实验都要发版,且 iOS/Android 一致性难保证、老 app 不认新字段。 |
| 老 app 用户不升级怎么办? | 4 类改动分类处理:加组件/加字段=安全;改语义=当新组件(v2);删字段=留到 min 版本退场。layout 配 `min_app_version` + `fallback`,未知组件静默跳过。详见 `app-version-compatibility.md`。 |
| 粘性分配怎么保证? | 确定性 hash(courierId+experimentId)%100,不依赖缓存,缓存淘汰也不翻组。 |
| Flink 到底对不对? | 取决于体量,而题目没给:只数送达事件 ~20/秒(过度),算上 GPS ping 可能几千/秒(就合理了),UC1 的 2M/hr≈556/秒 佐证平台已在几百/秒。所以**先测、再选型**——我的工作是帮团队自己量出来、自己得结论,不是替他们宣判。 |
| 这就是个延迟?为什么要 Kafka+Flink? | 这正是诊断要问的:先测真实事件率再选工具,顺序反了。 |

---

## 相关文档索引(深挖时引用)

| 文档 | 对应 |
|------|------|
| `courier-offer-system-architecture.md` | UC1 现状 + 约束 + 延迟预算 |
| `hybrid-end-to-end-design.md` | UC1 系统设计 + payload 契约 + 迁移 + 指标 |
| `runtime-dataflow.md` | UC1 端上运行时数据流：冷启动 / offer 投递 / 模板更新(SSE) 的 Mermaid 图 |
| `approach-evaluation.md` | UC1 A vs B vs C 技术决策 + 行业佐证 |
| `app-version-compatibility.md` | UC1 老 app 兼容 playbook |
| `technical-leadership.md` / `.zh.md` | UC1 技术领导力(移动团队顾虑) |
| `team-guidance-use-case-2.md` / `.zh.md` | UC2 全部 5 个考察点 |
| `adr/ADR-001-hybrid-sdui.md` | UC1 决策记录(1 页,A/B/C 决策结晶,讲 #2+#3 用) |
| `adr/RFC-skeleton-fraud-detection.md` | UC2 RFC 骨架 + reviewer 提问(演示"教而不替",讲 #2 用) |
| `demo/` | 可现场跑的混合方案 POC(hash 分桶 + registry + control/treatment) |
| `job-description.md` | 招聘 JD + JD↔准备映射 |
| `handOver.md` | 需向真实 repo 核实的开放项 |
