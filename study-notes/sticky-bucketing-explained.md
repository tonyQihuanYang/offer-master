# Sticky A/B 分桶 —— `hash(courierId + experimentId) % 100 < treatment_pct` 讲透

> UC1 的 Experiment Resolver 怎么决定一个快递员看 treatment 还是 control。
> 面试高频追问:**"怎么保证同一个快递员不翻桶?cache 清了 / 服务器重启了还稳吗?"**
> 一句话答案:**分桶是"算"出来的,不是"存"出来的;确定性 hash → 同输入永远同输出 → 无状态也 sticky。**
>
> 对应代码:[`demo/server/lib/hash.js`](../demo/server/lib/hash.js)
> 对应设计:[`en/hybrid-end-to-end-design.md`](../en/hybrid-end-to-end-design.md)（Stickiness 一节）

---

## 1. 要解决的问题

A/B 实验要求:**同一个快递员,每次打开都落在同一个桶**(要么一直 treatment,要么一直 control)。否则:

- 用户体验割裂(这次有 breakdown,下次没有)
- 实验数据被污染(同一个人既算进 treatment 又算进 control)

最朴素的做法是**存一张表**:`courier_id → variant`。但这要维护状态、要查库(在 200ms / 2M-per-hour 热路径上多一次 I/O)、缓存一旦失效就可能翻桶。

**更好的做法:不存,直接算。**

---

## 2. 逐段拆解

```
hash( courierId + experimentId ) % 100 < treatment_pct
└──────────┬──────────┘  └─┬─┘  └────┬────┘
       ① 确定性哈希      ② 压到0-99   ③ 阈值比较
```

以 `courier_8423`、实验 `earnings_v2`、`treatment_pct = 10`(10% 放量)为例:

| 步 | 运算 | 结果 | 说明 |
|---|---|---|---|
| ① 拼串 | `"courier_8423::earnings_v2"` | 一个字符串 | courierId + experimentId |
| ② hash | `fnv1a32(...)` | `2891749223` | **确定性**:同输入永远同输出;改一字符结果天翻地覆(雪崩效应) |
| ③ `% 100` | `2891749223 % 100` | `23` | 把大整数近似均匀地压进 **0–99**(每人一个稳定"抽签号") |
| ④ `< 10` | `23 < 10` | `false` | 抽签号 0–9 才进 treatment → 这人是 **control** |

> **抽签号(0–99)是关键中间产物**:它对一个快递员永远固定,
> `treatment_pct` 只是一道"几号以下算 treatment"的横线。

---

## 3. 为什么"无状态"也能 sticky

桶**不是记住的,是每次从 `courierId` 重新算的**。

```
请求1 → hash("courier_8423::earnings_v2") % 100 = 23 → control
请求2 → hash("courier_8423::earnings_v2") % 100 = 23 → control   ← 必然一样
请求N → hash("courier_8423::earnings_v2") % 100 = 23 → control
```

因为 hash 是**纯函数(确定性)**,所以:

- ✅ **cache eviction 不翻桶** —— 桶不在缓存里,缓存只缓存 flag 配置(`treatment_pct` 的值),不缓存"谁在哪桶"
- ✅ **服务器重启 / 换机器不翻桶** —— 任何一台机器算 `courier_8423` 都得 23
- ✅ **不查库、不加 I/O** —— 热路径上就是一次 in-memory 计算,亚毫秒

这正是面试官想听的:**"Cache eviction does not flip a courier, because the bucket is recomputed from a stable hash, not stored."**

---

## 4. 为什么 ramp(放量)不会"踢人"

放量 = 改 `treatment_pct`,从 10 → 50:

```
treatment_pct = 10:  桶 0──9  treatment │ 10────────99 control
treatment_pct = 50:  桶 0───────────49  treatment │ 50──99 control
                     └ 0-9 原本就在,继续留着 ┘ └ 新加 10-49 ┘
```

用 `<`(或 `<=`)+ **同一个 hash**,放量**只会"加人",绝不"踢人"**(单调性)。
- 抽签号 0–9 的人:`<10` 真,`<50` 也真 → 一直在 treatment,**不翻桶**
- 抽签号 10–49 的人:从 control 进入 treatment(预期内的新增)

⚠️ 反例:如果你换了 hash 函数 / 换了拼接顺序 / 用了随机数 → 抽签号全变 → 老 treatment 用户可能被踢回 control → **实验数据作废**。所以 hash 和拼串规则一旦上线就**不能改**。

---

## 5. 为什么要 `+ experimentId`

让每个实验**独立分桶(de-correlate)**。

```
只用 courierId:           用 courierId + experimentId:
exp_A: courier_8423 → 23   exp_A: "courier_8423::exp_A" → 23
exp_B: courier_8423 → 23   exp_B: "courier_8423::exp_B" → 71   ← 不同了
exp_C: courier_8423 → 23   exp_C: "courier_8423::exp_C" → 5
  ↑ 同一批人每个实验都进     ↑ 每个实验里的分组互不相关
    treatment → 样本相关、有偏
```

加上 experimentId,同一个人在不同实验里的分组互相独立,避免"总是那批人当小白鼠"导致的系统性偏差。

---

## 6. Eligibility(资格) vs Bucketing(分桶)—— 两层别混

| 层 | 决定什么 | key on | 例子 |
|---|---|---|---|
| **Eligibility gate** | **谁能进实验** | region / city / % rollout | "先在 Toronto 放量" |
| **Bucket assignment** | 进了之后 **treatment 还是 control** | **必须是稳定的 `courierId`** | `hash(courierId+expId)%100` |

⚠️ 陷阱:**分桶绝不能 key on region** —— 快递员跨区 / region 数据更新就会翻桶。
region 只用来决定"能不能进",**进了之后的桶永远按 `courierId` 算**。

---

## 7. fail-closed(算不出来怎么办)

```
resolve(courierId, experimentId):
    if 缺 courierId / flag 服务异常 / 超时:
        return control          ← 默认对照组,绝不报错、绝不挂
    bucket = hash(courierId + experimentId) % 100
    return bucket < treatment_pct ? treatment : control
```

依赖慢或挂,只**降级实验**(回落 control),**不影响 offer 本身**。fallback 触发率 >1% 就告警。

---

## 8. 代码(demo 里真实跑的)

```js
// demo/server/lib/hash.js
export function fnv1a32(str) {
  let h = 0x811c9dc5;                       // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);                 // XOR 当前字节
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; // ×FNV prime
  }
  return h >>> 0;                           // 转无符号 32-bit
}

export function bucket(courierId, experimentId) {
  return fnv1a32(`${courierId}::${experimentId}`) % 100;   // → 0–99
}
```

> 用 **FNV-1a** 只是因为零依赖、快、分布够均匀,适合分桶。
> 生产里 MurmurHash / xxHash 也行 —— **关键不是哪个 hash,而是"确定性 + 分布均匀 + 一旦上线不再改"**。

---

## 🗣️ 面试可直接说的英文版(背这段)

> "Assignment is **deterministic, not stored**. We take `hash(courierId + experimentId) % 100` — that gives each courier a stable number 0–99 — and compare it to `treatment_pct`. Same courier, same experiment, **always the same bucket**, because it's a pure function of a stable ID.
>
> So a **cache eviction or server restart can't flip anyone** — there's no per-courier state to lose; we recompute it every time, sub-millisecond, no DB lookup.
>
> **Ramping is monotonic**: going 10% → 50% only *adds* couriers to treatment, never removes the ones already in it, because we keep the same hash and just raise the threshold.
>
> We hash on `courierId + experimentId` so **experiments de-correlate** — otherwise the same couriers always land in treatment across every experiment, which biases the results.
>
> Region only gates **eligibility** — who's *allowed* in. The **bucket** is always keyed on the stable courierId, so a courier changing region never flips their variant. And we **fail closed**: if we can't resolve, the courier gets control — a slow flag service degrades the experiment, never the offer."

---

## 相关

- [`en/hybrid-end-to-end-design.md`](../en/hybrid-end-to-end-design.md) — Stickiness / 端到端设计
- [`demo/server/lib/hash.js`](../demo/server/lib/hash.js) — 真实分桶代码
- [`adr/ADR-001-hybrid-sdui.md`](../adr/ADR-001-hybrid-sdui.md) — 决策记录(Experiment Resolver)
