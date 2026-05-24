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

<!--
（样例到此。UC2 的幻灯片可同样风格继续。）
-->
