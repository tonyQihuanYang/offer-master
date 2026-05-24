---
marp: true
paginate: true
size: 16:9
title: Staff Engineer Interview — Courier Offer System
author: Tony (Qihuan Yang)
math: false
style: |
  :root {
    --accent: #2f6fed;
    --ink: #1c2330;
    --muted: #6b7686;
    --bg: #ffffff;
    --soft: #f4f6fb;
  }
  section {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
                 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    font-size: 25px;
    color: var(--ink);
    background: var(--bg);
    padding: 56px 64px;
  }
  h1 { color: var(--ink); font-size: 46px; letter-spacing: -0.5px; }
  h2 { color: var(--accent); font-size: 33px; border-bottom: 2px solid #e6ebf5; padding-bottom: 8px; }
  h3 { color: var(--ink); font-size: 25px; }
  strong { color: var(--accent); }
  a { color: var(--accent); }
  table { font-size: 20px; border-collapse: collapse; width: 100%; }
  th { background: var(--soft); color: var(--ink); text-align: left; }
  th, td { border: 1px solid #e6ebf5; padding: 6px 10px; }
  code { background: var(--soft); color: #b3461d; padding: 1px 6px; border-radius: 4px; font-size: 0.85em; }
  pre { background: #0f1626; border-radius: 10px; font-size: 18px; }
  pre code { background: transparent; color: #d7e0f2; }
  blockquote { border-left: 4px solid var(--accent); color: var(--ink); background: var(--soft);
               padding: 12px 18px; border-radius: 0 8px 8px 0; font-style: normal; }
  section.lead { justify-content: center; text-align: left; }
  section.lead h1 { font-size: 54px; }
  .muted { color: var(--muted); }
  footer { color: var(--muted); font-size: 14px; }
  section::after { color: var(--muted); font-size: 14px; }  /* page number */
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Courier Offer System Modernization
## & Real-time Fraud Detection Team Guidance

Staff Engineer — Courier Offer & Rewards
**Tony (Qihuan Yang)**

<!--
开场定调（30秒念这段）：
- 今天约 32 分钟讲 UC1、22 分钟 UC2，留几分钟 Q&A。
- 我对 Staff 的理解：通过【影响力而非权威】驱动决策，【动手做 POC、快速试错】。
- 两个 case 都按这个标准答。我还做了一个可运行的原型来验证 UC1 的方案。
-->

---

## Agenda

**Use Case 1 — Courier Offering System** (~32 min)
1. System Design — end-to-end architecture
2. Technical Decision — Approach A vs B → **C**
3. Technical Leadership — facilitating the mobile team
4. Migration Strategy — metrics & rollback

**Use Case 2 — Fraud Detection Team Guidance** (~22 min)
Diagnose · Guide without solving · 3-day plan · Knowledge transfer · Work with TM

<!--
一句话主线：UC1 证明我能做架构和技术判断；UC2 证明我能放大团队、而不是替团队干活。
让面试官知道我会管理时间——这本身就是 Staff 信号。
-->

---

# Use Case 1

## Courier Offering System Modernization

<!-- _class: lead -->

---

## Problem & Constraints

- 15 countries · 50,000+ couriers · **2M offers/hour** peak (~556 RPS)
- SLA **200 ms p95** — today ~180 ms → only **~20 ms real headroom**
- Needs: A/B presentation · personalized earnings · gradual rollout · multiple earning models

**Today:** one hardcoded `Offer.java`, earnings logic across 3 services, every change = full multi-region deploy, **zero experimentation**

> Already an **event-driven, distributed** system (SQS + Temporal + AppSync on AWS), already pushing structured JSON to mobile → my answer is **evolution, not rewrite**.

<!--
钉住约束，尤其 20ms headroom——后面所有设计都活在这 20ms 里。
痛点是"僵化"，不是性能：改不动、试不动。
最后一句是推荐 C 的伏笔，也撞 JD 的 event-driven / distributed systems。
-->

---

## 1 · System Design — Hybrid (Approach C)

**Server decides _what + order_; mobile decides _how_.**

4 new components inside `courier_offer_service` (after Temporal returns pay+bonus):

| Component | Job | Key design |
|---|---|---|
| Experiment Resolver | assign variant | **sticky hash**, fail-closed |
| Earnings Calculator | flat/distance/surge/tips | compute only (data prefetched) |
| Layout Composer | `layout[]` + `hints` | config-driven, in-memory |
| Payload Builder | assemble payload | version-branched (legacy fallback) |

Mobile renders via a **component registry (~10–15)**; unknown components **skipped** (forward-compat).

<!--
逐组件讲【延迟预算 + 失败模式】：fail-closed、双写、幂等、粘性 hash 不依赖缓存——把这些当"分布式系统设计"卖点讲。
这里亮 demo / 录屏：可运行 POC 验证分界线 + 粘性分桶 + SSE 推送。
-->

---

## 1 · The Payload Contract

```json
{
  "experiment": { "earnings_display": { "variant": "breakdown_v2", "group": "treatment" } },
  "layout": { "components": ["earnings_breakdown", "surge_indicator", "accept_cta"],
              "hints": { "highlight_field": "surge" } },
  "data": { "earnings_breakdown": { "model": "surge", "total": 730, "currency": "CAD" } }
}
```

- Same delivery, **different layout per market** (CH / UK / CA)
- Layout is embedded per offer (cheap; memoized by variant/zone/tier)

<!--
这页把抽象架构落到具体 payload，面试官看到 JSON 更信你想清楚了。
强调 registry 是有界的（10–15 个）——后面领导力部分 bounded complexity 的钩子。
-->

---

## 2 · Technical Decision — A vs B vs C

| | A (DSL) | B (raw+mobile) | **C (Hybrid) ✅** |
|---|---|---|---|
| Experiment speed | fast | slow (app release) | **fast** (layout) |
| 200ms risk | high | low | low |
| Native UX | poor | great | great |
| iOS/Android consistency | guaranteed | hard | shared component spec |

**B vs C — the one real difference:** *"which components & in what order"* is **app logic on mobile in B**, but **data from the server in C**.
→ **C = B + a server-controlled layout descriptor + experiment assignment moved server-side.**

<!--
主动提出 C："题目把团队框在 A 和 B 之间，但答案是两者的混合。"
A 硬伤：服务端渲染吃延迟、锁死原生 UX。B 硬伤：每个 layout 实验都要发版。
诚实讲 C 代价：组件治理、改已有组件 schema 仍要发版/双发。
-->

---

## 3 · Technical Leadership

> *Mobile is worried Approach B/C increases their complexity. How do you facilitate?*

**Principle: validate the concern, then sharpen it.** (not *whether* — *how much, what kind, what's on the other side*)

1. Acknowledge in writing → us-vs-problem
2. Working session, sharpen "complexity" → **bounded mitigations** (locked registry, codegen, forward-compat, co-owned RFC)
3. Propose a **small reversible proof, mobile-led** (1 zone, 1 component, 4 weeks) — *fail fast*; pre-state escalation (→ ADR)

This is **influence, not authority** — verbatim from the JD.

<!--
⚠️ 这是行为题不是技术题。分辨 Staff（推动跨团队决策）vs Senior（推销正确答案）。
反模式：预先写好决定拿去会上"走流程"——移动会看穿，信任崩。
原型由移动主导——去掉"你在强加给我们"的框架。
-->

---

## 3 · The closing posture

> **"My job isn't to win the architecture argument — it's to make the team that ships and maintains this a co-author of the decision.**
> **I'd advocate C, but I'd rather ship B with mobile fully bought in than ship C with mobile compliant but quietly resentful."**

<!-- _class: lead -->

<!--
这句背熟，放领导力段落结尾。它是 Senior 和 Staff 答案的分水岭，也是 influence over authority 的具体体现。
-->

---

## 4 · Migration & Metrics

**4 phases, every step reversible:**
Foundation (no-op) → Dual payload (`data` + `data_v2`) → Flag rollout (1→5→25→50→100% per city) → Experiment live

| Class | Metric | Target |
|---|---|---|
| SLA | p95 / p99 | ≤200 / ≤300 ms |
| Business (per variant) | acceptance / time-to-accept / **dispute** | no regression |
| Experiment | assignment consistency / flag fallback | 100% / <1% |
| Migration | % on v2 / field parity | tracked / 100% |

**Rollback:** feature-flag instant-off + dual-write → mobile always falls back to `data`.

<!--
强调护栏指标：不是只看 acceptance 涨没涨，要看 dispute/crash/延迟有没有回归。
业务指标按 variant 分组看，否则 A/B 没意义。
-->

---

## Use Case 1 — in one line

> *"I recommend the hybrid (C): server controls layout + experiments, mobile renders natively. It buys experiment velocity **and** native UX within 200 ms / 2M-per-hour, evolves the existing event-driven system, and migrates with instant rollback — and the real Staff work is making mobile a **co-author** of the decision."*

<!-- _class: lead -->

---

# Use Case 2

## Real-time Fraud Detection — Team Guidance

<!-- _class: lead -->

---

## The Situation

- 4 engineers (2–3 yrs), Kafka + Flink fraud detection
- **45s latency** vs <5s target · scope crept **3 → 12 patterns**
- Sprint review in **3 days, nothing to demo** · low morale · PM escalating

**Principle: the crisis is the deadline, not the architecture.**
Don't parachute in and rewrite it — buy time, narrow scope, coach, let them ship something they understand.

> Role: guide **without doing the work for them**, working **with** the Tech Manager — not replacing them.

<!--
最常见的 Staff 翻车点：冲进去重写架构"拯救"sprint——解决了 demo，搞坏了团队。
第二原则：那个想"推倒重来用更简单方案"的工程师可能是对的，认真对待。
-->

---

## Staff vs Tech Manager — draw the line first

| Area | TM owns | Staff owns |
|---|---|---|
| Sprint scope · deadlines · PM negotiation | ✓ | technical framing |
| Individual performance · morale | ✓ | surface tech causes |
| Architecture · testing · RFCs · mentorship | | ✓ |
| Sprint-review narrative · escalation | shared | shared |

**First 30 min = a 1:1 with the TM** to draw exactly this line.

<!--
题目明说"你不是 TM，是和 TM 协作"。陷阱：替他和 PM 谈、单方面砍范围、用他的权威而不协调。
-->

---

## 1 · Diagnose — ask, don't lead

- **Architecture:** "Walk the data flow on a whiteboard." "Where are the 45s spent — measured or inferred?" "Sync I/O in operators? parallelism? watermarks?"
- **🔑 The big one:** "Is Flink even right for our event rate?" → 50k couriers × ~30/day ≈ **~20 events/sec avg (~100 peak)** vs Flink's **100k+/sec** design point — a complexity tax for capacity they don't need.
- **Scope:** "Which 3 of the 12 do stakeholders want *this quarter*?"
- **Data quality:** "What % of events miss location — null / stale / missing entirely?"
- **Testing:** "Show me how you test one rule end-to-end."

<!--
分波提问，别一次甩 30 个。关键：先用真流式概念诊断、证明懂行，再下 right-sizing 结论。
别让"Flink 过度设计"成为开场白——否则像是在绕开流式。
-->

---

## 2 · The 3-day plan — ruthlessly descope

**Load-bearing move:** ship **one** pattern that tells the story —
*"marked complete >500m from destination"* (data's already there, just a distance calc, <5s with or without Flink).

- **Day 1:** TM 1:1 (RACI) · team architecture walk-through · **scope-lock with PM in writing** (1 pattern, 11 deferred) · pair (they drive)
- **Day 2:** pair to a working skeleton · first test fixture · draft an honest review narrative
- **Day 3:** dry run (they present) · **pre-brief the Director with the TM** · schedule a post-demo retro

Avoid a half-working live demo that fails. **The team presents and gets the credit.**

<!--
承重句：团队的问题不是做不出 12 个，是想发 12 个而其实 1 个就能讲完故事。
砍范围要 PM 书面确认 + 提前 brief 领导，绝不让团队在 review 现场被敌意升级单独面对。
-->

---

## 3 · Guide without solving

- Pair, don't solve · whiteboard principles, not fixes · code-review **in questions**
- They write the RFC, you comment · bring a Principal for a second opinion (they present)
- But don't withhold facts — if asked "ms or s for checkpoints?", just answer

**Worked example — the 45s latency:**
- ❌ Senior: *"It's backpressure — add async I/O, double parallelism."*
- ✅ Staff: *"What's the latency breakdown? → what does the metric say? → how do we confirm? → run it — what would the result tell us?"*

Same destination — the Staff version teaches the **debugging method**.

<!--
度的把握：既不替他们写，也不死活不给答案。藏事实不是辅导。
-->

---

## 4 · Long-term — knowledge transfer (30/60/90)

| Window | Activity |
|---|---|
| **30 days** | streaming study group (2h/wk) · external SME sessions · architecture office hours |
| **60 days** | each builds a Flink toy project · team writes the v2 RFC · read another team's real job |
| **90 days** | each *teaches* one concept (watermarks, backpressure…) · name a streaming SME · pair with an experienced team |

**Don't let them learn in isolation** — broker a partnership with a team that runs production streaming.

<!--
这是预防下一次 3 天危机的部分。没有它，两个月后我又会站在这个房间里。
teaching is the highest form of learning——90 天让他们讲出来就是真的会了。
-->

---

## 5 · Work with TM / Principals / Leadership

- **TM (peer):** daily 15-min during crunch; architecture runs through me, scope is theirs, individual feedback is theirs — **never go around the TM**
- **Principals:** early second opinions + pattern-matching; a resource, not political backup
- **Leadership:** get ahead of the escalation — **brief jointly with the TM**:

> *"The team picked Flink for a workload ~50–100× below its design point. We've descoped to one pattern; we'll formally evaluate the architecture over 30 days. We'd like your air cover with the PM."*

<!--
"start over"工程师如果对了：公开表扬他、把 Flink 工作框为"没白做"（暴露了数据质量/范围/真实事件率）、自己认领教训。
好的领导汇报：诚实讲哪里错（框为工程判断不甩锅）+ 时间线 + 具体诉求（air cover）+ TM 和 Staff 一起。
-->

---

## Use Case 2 — the posture

> **"My role is to make the team better at this — not to do the work for them. The 3-day deadline is a constraint to navigate, not a performance to deliver.**
> **If I do my job right, this team handles the next streaming project without a Staff parachute."**

<!-- _class: lead -->

<!--
Staff = leverage over time, not heroics in the moment.
-->

---

## Closing — two postures, one standard

- **UC1 (leadership):** make the team that ships it a **co-author** — *"I'd rather ship B fully bought-in than C quietly resentful."*
- **UC2 (guidance):** **leverage over time, not heroics** — *"no Staff parachute next time."*

Both answered the same way:
**influence, not authority · fail fast · hands-on POCs** — exactly what the role calls for.

**Thank you — happy to go deeper on any part (a running POC included).**

<!-- _class: lead -->

<!--
开场埋的 influence / fail-fast 在这里收口，首尾呼应。然后开放 Q&A：
"两个 case 我都准备了更深的细节——架构、迁移、组件治理、流式诊断，还有一份可运行的 POC，欢迎往任何方向追问。"
-->
