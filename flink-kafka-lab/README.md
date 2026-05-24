# Flink + Kafka 教学 Lab（实时欺诈检测）

> 用一个**零依赖、纯 Node 就能跑**的小程序，把 Kafka 和 Flink 的核心概念**做成你看得见、能改**的代码——
> 用 UC2 的快递欺诈检测当例子。**这是教学模型，不是真的 Flink/Kafka**（真的要 JVM + Docker 很重），
> 但面试会问的概念（分区、keyBy、keyed state、窗口、watermark、迟到事件、有状态 vs 无状态）全在这儿。
>
> 这份 README 也是 UC2 的**复习小抄**。

## 怎么跑

```bash
node flink-kafka-lab/run.mjs      # 零依赖，纯 Node
```

## 管道（和真实系统同形）

```
producer ─▶ Kafka topic "courier-events"  ─▶  Flink job (keyBy courierId)  ─▶  fraud operators  ─▶  alert sink
            (按 courierId 分 3 个分区)          (按 courier 分流 + 状态)        (3 条欺诈规则)        (风控/告警)
```

## 跑出来你会看到什么

```
p1@0 00:00 GPS_PING          courier=c1            ← p1@0 = 分区1、偏移0；00:00 = 事件时间
...
  🚨 ALERT [FAKE_GPS] courier=c2 — 7532 m in 4 s ≈ 6779 km/h     ← 有状态：和上一条 ping 比速度
  🚨 ALERT [FAR_FROM_DEST] courier=c3 — 2224 m from destination  ← 无状态：一条事件里就够判断
  🚨 ALERT [HIGH_RATE] courier=c4 — 6 deliveries in one 60s window ← 有状态+窗口：按窗口计数
... GPS_PING courier=c1 ⟂ LATE — dropped                          ← 迟到事件：晚于 watermark，丢弃
```

- **c1 正常** → 不告警
- **c2 / c3 / c4** → 各触发一种欺诈
- 最后那条 c1 的 ping **事件时间是过去的、却最后才到** → 超过 watermark → **被丢弃**（否则会污染状态）

## 术语对照（概念 ➜ 真实 Kafka/Flink ➜ 代码在哪）

| 概念 | 真实里是什么 | 这个 lab 里 |
|------|-------------|------------|
| **Topic** | 一条命名的事件流 | `KafkaTopic('courier-events')` (`mini-kafka.mjs`) |
| **Partition 分区** | topic 的有序分片；**分区内有序**，跨分区不保证 | `numPartitions=3`，`hash(key)%N` |
| **Key 分区键** | 决定进哪个分区；**同 key 同分区** | `produce(courierId, ...)` |
| **Offset** | 记录在分区内的位置 | `record.offset` |
| **keyBy** | 按 key 把流分组，每组带自己的状态 | `StreamJob({ keyBy: e => e.courierId })` |
| **Keyed State 键控状态** | 每个 key 跨事件的记忆（真实里在 RocksDB、会 checkpoint）| `KeyedState`（`lastPing`、`windowCounts`）|
| **Operator / ProcessFunction** | 你的每条事件逻辑 | `addOperator(name, fn)`、`fraud-job.mjs` |
| **Event time 事件时间** | 事件**发生**的时间（不是到达时间）| `event.eventTime` |
| **Watermark** | "我已看到 ≤W 的所有事件"——窗口据此触发 | `job.watermark = maxEventTime - allowedLateness` |
| **Late event 迟到事件** | 晚于 watermark 到达 | `late = eventTime < watermark` → 丢弃 |
| **Tumbling Window 滚动窗口** | 固定不重叠的时间桶 `[start, start+size)` | `windowStart(ts, 60_000)` |
| **Sink** | 结果去处（库/告警系统）| `alert(...)` |

## 三种 operator = 三种你必须会讲的算子

| 规则 | 类型 | 为什么 |
|------|------|--------|
| `far-from-destination` | **无状态 (stateless)** | 实际 GPS 和目的地坐标**都在一条事件里**——一个 map+filter 就够，**几乎不需要 Flink** |
| `fake-gps` | **有状态 (stateful)** | 要和这个快递员的**上一条 ping** 比速度 → 需要 keyed state |
| `high-rate` | **有状态 + 窗口** | 按快递员**每分钟计数** → 需要 keyed state + window |

> 这张表是回答"Flink 到底给你什么"的核心：**无状态的不需要它；有状态/窗口的才是它的价值。**

## 面试必懂的概念（一两句版）

- **Event time vs Processing time**：按事件**发生**时间算（不是服务器收到时间），否则手机乱序/迟到会让窗口算错。
- **Watermark**：事件时间的"进度条"，到 W 就说明"≤W 的我都收齐了"，窗口可以安全触发。**out-of-orderness 的核心机制。**
- **Late event 迟到**：晚于 watermark 的事件 → **side-output 或丢弃**（本 lab 丢弃，防止污染状态）；或设 allowed-lateness 容忍一点。
- **Keyed state**：按 key 的跨事件记忆，真实里**持久化 + checkpoint**，failover 不丢 → 配合 **exactly-once**。
- **Partition / keyBy**：同 key 进同分区/同 task → **分区内有序** + 状态归属清晰；也是**水平扩展**的单位（并行度 ≤ 分区数）。
- **Window**：tumbling（不重叠）/ sliding（重叠）/ session（按空闲间隔）——按时间聚合。
- **Backpressure 背压**：下游处理不过来 → 反压上游变慢。常见根因:**算子里同步 I/O**、热 key、并行度不足、checkpoint 风暴。**"Flink 慢" 多半是这个，不是 Flink 本身。**
- **Checkpoint / Exactly-once**：周期性给状态打快照，挂了从快照恢复 → 端到端精确一次。

## 回扣 UC2（这才是面试要的判断）

- 量级:5 万快递员 × ~30 单/天 ≈ **~20 事件/秒(峰值 ~100)**;Flink 的设计点是 **10 万+/秒**。差 2–3 个数量级。
- 所以那个团队的 **45 秒延迟,大概率是配错了**(同步 I/O / 并行度不足 / checkpoint 风暴 / 热 key),不是 Flink 慢。
- 而且这个量级,**一个普通 Kafka 消费者 + Redis/DB 存状态**就能做一模一样的事(本 lab 的 `KeyedState` 就是那个角色),运维复杂度低得多。
- **Staff 的答法**:"我懂 Flink 懂到能判断——这个量级未必需要它。先**测真实事件率**再选工具,顺序别反。这是 right-sizing,不是回避。"

## 想看"真版"（真 Kafka + 真 Flink）？

真版用 Docker 起 Kafka + Flink，作业用 **PyFlink**（Python，比 Java 上手快）。大致：

```
docker compose up        # 起 zookeeper + kafka + flink jobmanager/taskmanager
pip install apache-flink
python fraud_job.py      # 用 Table API / DataStream API，连 Kafka source/sink
```

需要的话告诉我，我把 `docker-compose.yml` + 一个 PyFlink 作业写出来——但**先把这个 Node 版概念吃透**，真版只是把同样的概念换成真引擎。

## 文件

| 文件 | 作用 |
|------|------|
| `mini-kafka.mjs` | 模拟 Kafka：topic / 分区 / 按 key 分区 / 消费 |
| `mini-flink.mjs` | 模拟 Flink：keyBy / keyed state / event-time / watermark / window |
| `fraud-job.mjs` | 3 条欺诈规则（无状态 / 有状态 / 有状态+窗口）|
| `run.mjs` | 接线 + 脚本化事件流 + 带解说的输出 |
