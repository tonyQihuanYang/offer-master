# Runtime Data Flow (Approach C) — App Cold Start, Offer Delivery, Template Updates

> 端上视角的运行时数据流：app 冷启动如何拿到 layout、一个 offer 怎么被推下来渲染、以及 **layout/模板更新了怎么传播**。
> 配套后端事件流见 `courier-offer-system-architecture.md` 与 `hybrid-end-to-end-design.md` 里的 Mermaid 时序图。

---

## 先记住一个关键设计决定

方案 C 里有**三样东西**会"变"，它们的传播方式完全不同——分清楚这三样，整张图就清楚了：

| 会变的东西 | 住在哪 | 怎么传播 | 要发版吗 |
|-----------|--------|----------|---------|
| **Component Registry**（组件的实际渲染代码，~10–15 个） | **App 二进制内**（编译进去） | 随 app 发布 | ✅ 要 |
| **Layout 描述符**（哪些组件、顺序、hints） | **服务端 Layout Composer** | 在**每个 offer 的 payload 里随包带下来** | ❌ 不要 |
| **Offer 数据**（earnings、距离、地址…） | 服务端，每单实时算 | 同样随 offer payload 推下来 | ❌ 不要 |

> 🔑 **核心**：app **不单独"去读模板"**。layout 是**烤进每个 offer**的。所以"模板更新"= "下一个 offer 自带新 layout"，**默认零额外通道**。
>
> 这一点在快递场景特别成立，因为 **offer 是短命的**（~40 秒就过期）——你根本不需要把模板更新推给一个马上要消失的屏幕，下一单自然带新 layout。

---

## ① App 冷启动（initial state）

app 启动时**不读服务端模板**——registry 已经编译在二进制里，它只需：登录拿 `courierId` → 开推送连接 → 等 offer。

```mermaid
sequenceDiagram
    autonumber
    participant App as Courier App
    participant Reg as In-app Component Registry
    participant Auth as Auth / Session
    participant T as Transport (AppSync WS / SSE)
    participant Cfg as Template service (optional)

    Note over App,Reg: registry (~10-15 components) compiled into the binary
    App->>Auth: login
    Auth-->>App: courierId + clientVersion (token claim)
    App->>T: subscribe(courierId)  — open WebSocket / SSE
    T-->>App: connected
    opt only in the template-cache model (see section 3, Model B)
        App->>Cfg: GET /templates?clientVersion
        Cfg-->>App: layout manifest (+ version)
        App->>App: cache manifest on device
    end
    App->>App: show idle / waiting state
```

**要点**：
- 基线模型里，冷启动**没有** `GET /templates` 这一步（那个 `opt` 框只在可选的缓存模型里出现）。
- app 在拿到第一个 offer **之前**屏幕上显示什么，是**app 内置的静态 UI**（如 skeleton / "等待派单"），不是服务端模板。
- `clientVersion`（用于老 app 兼容/版本协商）从登录 token claim 拿——具体来源待向真实代码核实，见 `handOver.md`。

---

## ② Offer 投递（steady state，layout 随包带下来）

每个 offer 自带 `layout[]`。app 只是**遍历 → registry 查表 → 原生渲染**，没有任何"该显示什么"的判断逻辑。

```mermaid
sequenceDiagram
    autonumber
    participant CM as Courier Management
    participant COS as courier_offer_service
    participant ER as Experiment Resolver
    participant LC as Layout Composer
    participant PB as Payload Builder
    participant T as Transport (AppSync WS / SSE)
    participant App as Courier App
    participant Reg as Component Registry

    CM->>COS: JobSummaryUpdated (event)
    COS->>ER: resolve(courierId) -> variant (sticky hash, fail-closed)
    COS->>LC: compose(variant, context) -> layout[] + hints
    COS->>PB: build(layout, data, clientVersion)
    PB-->>COS: offer payload (layout embedded)
    COS->>T: push
    T-->>App: event: offer  (layout + data in one payload)
    loop for each name in layout.components
        App->>Reg: lookup(name)
        alt known component
            Reg-->>App: render(data[name]) natively
        else unknown name
            App->>App: skip silently (forward-compat)
        end
    end
    App->>App: display offer card (countdown ~40s)
```

**要点**：
- layout 和 data 在**同一个 payload** 里到达——app 不需要二次请求。
- **未知组件静默跳过** = 老 app 遇到新组件不崩、server 可以领先 app 发布。
- 这就是 demo 现在的行为（`/api/dispatch` 推 → `/api/stream` SSE → `OfferRenderer` 遍历 `layout.components`）。

---

## ③ Layout / 模板更新了，怎么传播？（两种模型）

### Model A —— 基线：不推模板，layout 跟着下一个 offer 走 ✅ 推荐

运营在 admin 改了 layout config（比如给某 zone 加 `surge_indicator`）后：

```mermaid
sequenceDiagram
    autonumber
    participant Adm as Admin / Ops tool
    participant Cfg as Config service
    participant LC as Layout Composer (in courier_offer_service)
    participant COS as Offer assembly
    participant App as Courier App

    Adm->>Cfg: save new layout config (add surge_indicator)
    Note over LC: polls config every 30s, keeps last-good in memory
    Cfg-->>LC: refreshed config (within ~30s)
    Note over App: current offer just expires (~40s) — nothing to update mid-flight
    COS->>App: NEXT offer carries the new layout[]
    App->>App: render new layout via registry
    Note over App: no app action, no app release, no extra channel
```

- **收敛时间**：≤ 30s（config 轮询）+ 到下一个 offer。对快递场景**完全够**。
- **为什么这样最好**：offer 短命，没有"改了模板要刷新正在看的屏幕"的需求——下一单自带新 layout。最简单、最少出错。
- ⚠️ 前提：新 layout 引用的组件**必须已在 app registry 里**。若引用了 app 还没有的新组件 → 该组件被静默跳过，直到 app 发版（见 `app-version-compatibility.md`）。

### Model B —— 可选优化：端上缓存模板 + SSE 推送失效

只有当 **(a) payload 因为重复 layout 变大**，或 **(b) 你想让很多 offer 共享同一份模板** 时才需要。代价是多一套缓存失效逻辑。

```mermaid
sequenceDiagram
    autonumber
    participant Adm as Admin / Ops tool
    participant Cfg as Config service
    participant T as Transport (SSE / WebSocket)
    participant App as Courier App

    Adm->>Cfg: save config -> bump layout_version
    Cfg->>T: emit config_updated { layout_version }
    T-->>App: event: config_updated
    App->>App: compare to cached version
    alt cache is stale
        App->>Cfg: GET /templates?clientVersion
        Cfg-->>App: refreshed manifest
        App->>App: replace cached templates
    else up to date
        App->>App: no-op
    end
    Note over App: subsequent offers reference template by id, rendered from cache
```

- 这里 **SSE/WebSocket 不只推 offer，也推 `config_updated` 控制事件**——这正是你问的"TemplateUpdate 了会怎样"。
- offer payload 变小（只带 `template_id` + data，不带完整 layout），但引入**缓存一致性**问题（版本比对、失效、回退）。

### 两个模型怎么选

| | Model A（基线） | Model B（缓存+推送失效） |
|---|---|---|
| layout 在哪 | 每个 offer 内嵌 | 端上缓存，offer 只带 template_id |
| 更新传播 | 跟下一个 offer | `config_updated` SSE 事件 → 重新拉 |
| 复杂度 | 低 | 高（缓存失效） |
| payload 大小 | 略大（重复 layout） | 小 |
| 适合 | **短命 offer（快递场景）✅** | 长驻屏幕 / 海量共享模板 |

> **面试结论**：默认用 **Model A**——"offer 短命，layout 随包带最简单，连模板同步通道都不需要。只有当 payload 体积或模板复用成为问题时，我才会升级到 Model B 那种端上缓存 + SSE 推送失效的方案。" 这个"知道何时**不**加复杂度"的判断本身就是 Staff 信号。

---

## ③.5 深挖：「每个 offer 都带 layout」的成本与缓存权衡

> 这是最可能的现场追问：*"每个 offer 都带 layout 不会增加成本吗？能不能用 layout-version 让前端复用？"* —— 下面是完整推演。

### 先把"成本"拆成两种，别混着看

| 成本 | 真实情况 |
|------|---------|
| **计算成本**（每个 offer 重新算 layout） | 几乎为零，且可彻底消除 |
| **带宽/payload 成本**（每个 offer 重复带 layout） | 真实存在，但这个量级是零头 |

**计算成本 ≈ 0 —— 因为 layout 不依赖单个 courier。**
layout 只取决于 `(variant, zone, tier)`，不取决于某个 courier 的数据。"CA + treatment" 的 layout 对所有 CA-treatment courier 是同一份 → 服务端按 `(variant, zone, tier)` **memoize**，算一次、所有 offer 复用 → **per-offer 计算成本 ≈ 0**。Layout Composer 本就是内存查表（~2ms，已在延迟预算内），不调外部服务。

**带宽成本 —— 量化就知道不疼：**
- `layout[]` ≈ 8 个组件名 ≈ ~150 字节；`data` 块有好几 KB → layout 是零头。
- 每 courier ~30–100 offer/天 × 150B ≈ ~15KB/天/courier。
- 5 万 courier ≈ ~750MB/天 layout 总字节 → 对后端微不足道。

> 所以默认就**内嵌**（Model A）：计算可 memoize 到≈0，带宽是零头。

### layout-version + reuse = Model B，方向对，但有命门

offer 只带 `layout_version`、前端按版本号查本地缓存复用——这是标准的**按版本引用 + 端上缓存**（类似 HTTP ETag / 内容寻址）。但它的命门是 **cache miss**：

⚠️ 若 offer 引用了**前端没有的 `layout_version`**（server 刚滚新 layout 前端没拉到 / 全新安装 / 错过推送）→ 前端查不到 → **整屏渲染不出来 → BREAK**。

🔴 **严重性升级**：
- "未知**组件**静默跳过" = **局部**失败（少画一个，其余照常）。
- "未知 **layout_version**" = **整屏**失败（整个 offer 不知道画什么）。
- **Model B 把"局部可降级"的故障，升级成了"整屏故障"——这是它最大的代价。**

### 真要上 Model B，怎么不 break（4 个机制，缺一不可）

| # | 机制 | 作用 |
|---|------|------|
| ① | **layout 不可变 + 版本化**（version = 内容 hash） | 同名永远同内容，杜绝"版本号一样内容不一样" |
| ② | **push-before-use（先推后用）** | server 在引用新 version 前，先 SSE 推 `config_updated` 让前端预取；只引用前端"已持有"的版本 |
| ③ | **fetch-on-miss（兜底拉取）** | cache 没有就同步 `GET /templates/{version}` 再渲染 |
| ④ | 🔴 **内置默认 layout（最关键，fail-soft）** | 前端二进制永远内置一份 default layout；拿到未知 version 且拉不到 → 用 default 渲染。offer 的 `data` 还在，照样显示 earnings/距离/Accept |

**④ 是真正的安全网**：offer 有 ~40s 倒计时，cache miss 时多一个网络往返很糟（离线还直接失败）。所以**绝不能让 layout 拉取阻塞 offer**——拉不到立刻退回内置默认 layout。**最坏情况：courier 看到默认样式（无实验优化），但单子照样能接——绝不白屏、绝不丢单。**

### 一句话总结（面试可直接说）

> *"我会默认内嵌 layout。这个量级它几乎免费——计算可按 (variant,zone,tier) memoize 到接近零、带宽只是零头——而且它消除了一整类 cache-miss 故障。按版本引用+端上缓存是真实优化，但它把'局部组件缺失'升级成了'整屏故障'。除非实测带宽真的疼，否则我不会用稳健性换这点字节。真要做，我会配齐：不可变版本 + 先推后用 + miss 时拉取 + 一份永远兜底的内置默认 layout。"*

这个「知道优化存在、也知道何时**不该**用」的判断就是 Staff 信号——和「Flink 是否过度设计」是同一种思维。

---

## ④ 什么会变、怎么传、要不要发版（速查）

| 变化 | 传播方式 | 发版？ |
|------|----------|--------|
| 重排 / 显隐 / 替换**已有**组件 | Layout Composer config → 下个 offer 的 `layout[]` | ❌ 否 |
| hints（highlight、theme） | 同上 | ❌ 否 |
| 实验分配 / 灰度百分比 | Experiment Resolver config → 下个 offer | ❌ 否 |
| 给已有组件**加**一个可选字段 | additive，老 app 忽略 | ❌ 否（加法安全） |
| **新组件类型** | 必须先进 app 内 registry | ✅ 是 |
| 改已有组件的数据**语义** | 当新组件（v2）或双发 | ✅ 是（或双发过渡） |

详细的发版/兼容 playbook 见 [`app-version-compatibility.md`](../en/app-version-compatibility.md)。

---

## Related

- `courier-offer-system-architecture.md` — 现状后端事件流（Mermaid）
- `hybrid-end-to-end-design.md` — 改造后流程 + payload 契约
- `app-version-compatibility.md` — 老 app 兼容与版本协商
- `demo/` — 可运行实现（Model A：SSE 推 offer，layout 内嵌）
