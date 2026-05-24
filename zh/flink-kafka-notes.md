# Flink + Kafka 复习笔记（Q&A）

> 这是学习过程中实际问过的问题 + 弄懂后的答案，按"容易卡的点"组织，方便 review。
> 配套：可跑的教学模型 [`../flink-kafka-lab/`](../flink-kafka-lab/)（纯 Node）、真集群 [`../flink-kafka-docker/`](../flink-kafka-docker/)（看 Flink UI）、概念长文 [`fraud-detection-explained.md`](./fraud-detection-explained.md)。

---

## Q0. 基础词汇：Source / Operator / Sink（先记这组）

所有流处理/数据管道的通用三件套（Flink、Spark、Kafka Streams 都一样），一个水管比喻：

```
Source(水龙头)──▶ Operator(管道,处理)──▶ Sink(出水口/排水口)
数据从哪来              中间加工                 结果往哪去
```

| 词 | 意思 | demo 里 | UI 里 |
|----|------|---------|-------|
| **Source 源** | 数据**进来**的地方 | Kafka topic `courier-events`（`'connector'='kafka'`） | 作业图第一个框 `Source: courier_events` |
| **Operator 算子** | 中间处理（过滤/聚合/join） | WHERE 过滤、TUMBLE 窗口聚合 | 中间的框 + HASH 边 |
| **Sink 汇** | 结果**出去**的地方 | `print` 表（`'connector'='print'`）→ 打到 Stdout | 最后一个框 `Sink: alert_rate` |

> 生产里 sink 通常是：写数据库 / 写另一个 Kafka topic / 调风控接口 / 写文件。demo 用 `print` 只是图方便看输出。

**「慢 sink → 背压」**：sink 是出口，出口写得太慢（比如写一个慢 DB）→ 结果排不出去 → **倒灌回上游 → 整条流水线变慢**。就像下水道堵了，整个水槽积水。所以排查延迟时，慢 sink 和同步 I/O 一样是常见嫌疑。

---

## Q1. Flink 是怎么运行的？

**不是一个脚本，是一个常驻的分布式集群。** 你的 job 提交后 7×24 永远在跑（流处理，不像批处理跑完就结束）。

```
Client 提交 job ──▶ JobManager(大脑：拆任务/调度/协调 checkpoint/故障重启)
                          │
                   ┌──────┴──────┐
                   ▼             ▼
              TaskManager   TaskManager   (工人，每个有若干 slot)
                   │ 拉数据         │ 存快照
                   ▼               ▼
                 Kafka          S3/HDFS
```

- 你写的 `source → operator → sink` 是一张**数据流图**；提交后 JobManager 按**并行度**拆成多个**并行子任务**跑在各 slot 上。
- `keyBy` 触发 **shuffle**：同一个 key 的事件路由到固定子任务 → 状态归属清晰（UI 里那条 **HASH** 边就是它）。
- **Checkpoint**：每隔几秒所有子任务同时给状态拍快照存到 S3；崩了从快照恢复 + 回拨 Kafka offset → **exactly-once**。

---

## Q2. Flink UI（localhost:8081）能看到什么？

**只看「量」，不看「内容」。** UI 是监控仪表盘，不是数据查看器。

| 面板 | 看到什么 | 对应概念 |
|------|---------|---------|
| Overview | Running Jobs、Task Slots、TaskManagers | 集群规模 |
| 点进作业 → 数据流图 | `Source → 窗口聚合 → Sink` 的框 + **HASH** 边 | keyBy / shuffle |
| 框里的数字 | Parallelism、**Backpressured %**、**Low Watermark**、Records | 并行度 / 背压 / 事件时间 / 吞吐 |
| **Backpressure** 子标签 | OK(绿) / HIGH(红) | "Flink 慢"先查这里 |
| **Checkpoints** 标签 | 每 10s 一次、Completed 数、时长/大小 | 容错 / exactly-once |
| Task Managers → **Stdout** | print 出来的告警 `FAR_FROM_DEST> c3, 2226` | 作业输出 |

> ❌ 看不到每条记录的具体内容。**Records Received: 24** 是条数，不是数据。

---

## Q3. 怎么看「真实的数据」？

| 想看 | 用什么 | 看到 |
|------|--------|------|
| 输入原始数据 | `kafka-console-consumer`（读 topic） | Kafka 里的原始 JSON |
| Flink 解析后的输入 | SQL `SELECT * FROM courier_events`（result-mode=TABLEAU） | 实时滚动的结构化行 |
| 输出结果 | print sink → TaskManager Stdout | 告警行 |
| 有多少数据（非内容） | Flink UI 的 Records Received | 只有条数 |

读 Kafka 原始数据的命令：
```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic courier-events --from-beginning --max-messages 8
```

---

## Q4. Low Watermark 是什么意思？⭐ 最容易卡

**它是一个一直往前爬的「完成进度点」，永远比最新事件落后 5 秒**（不是一段时间范围）。

```
watermark = (见过的最大事件时间) − 5 秒
```

- 这个"−5 秒" = **容忍乱序/迟到的缓冲**（假设事件最多晚到 5 秒），不是窗口大小、不是"过去 5 秒的数据"。
- 例子：最新事件 ts=10:00:30 → watermark=10:00:25 → 「10:00:25 之前的我都齐了」。
  - 再来一条 ts=10:00:23 → 比 watermark 还旧 → **判为 LATE，丢弃**
  - 再来一条 ts=10:00:28 → 在容忍内 → 正常收
- 为什么 UI 上 Low Watermark ≈ 现在−5秒：producer 给事件盖的是当前时间，所以最新事件≈现在 → watermark≈现在−5秒，一直涨。
- **"Low"**：算子有多个输入时，取所有输入 watermark 的**最小值**（只能推进到最慢那个输入）。
- ⚠️ 著名坑：watermark **卡住不动** → 窗口永不触发 → 作业在跑但**没输出**。常见原因：某 Kafka 分区 idle（无数据），它的 watermark 不前进，取最小值就整个卡住。解法：source 配 idleness timeout。

---

## Q5. Watermark 和 窗口 INTERVAL 是一回事吗？→ 不是！

两个**独立**的旋钮：

| | 窗口 INTERVAL（`TUMBLE … 20 SECOND`） | WATERMARK（`ts − 5 SECOND`） |
|---|---|---|
| 是什么 | **桶的大小**（怎么把时间切段） | **事件时间进度点**（何时算收齐） |
| 管 | 哪些事件**归一组** | 窗口**何时触发** |
| 那个数 | 20 秒 = 每段多长 | 5 秒 = **容忍乱序多久** |

时间线：
```
窗口边界:  0 ────────── 20 ────────── 40   (由 20 SECOND 决定)
触发时机:  窗口 [0,20) 要等 watermark 爬过 20，也就是再等 5 秒(由 watermark 决定)
         → 触发时间 ≈ 窗口结束 + watermark 延迟 = 20s + 5s
```

> **窗口 = 分组大小；watermark = 等迟到的容忍度（决定何时触发）。** 可任意搭配（1 小时窗口 + 5 秒 watermark 都行）。
> 调大 watermark = 更容忍迟到但触发更慢；调小 = 触发快但易丢迟到数据。这是 **准确性 vs 延迟** 的权衡。

---

## Q6. 代码到底怎么写的？

整套就两个文件，**UI 那堆复杂度是 Flink 自动从 SQL 生成的**。

**① SQL 作业** `flink-kafka-docker/sql/fraud.sql`（~40 行）：
```sql
-- 数据源（= UI 的 Source 框）
CREATE TABLE courier_events (
  courierId STRING, `type` STRING, lat DOUBLE, lng DOUBLE,
  dest_lat DOUBLE, dest_lng DOUBLE, event_time_ms BIGINT,
  ts AS TO_TIMESTAMP_LTZ(event_time_ms, 3),
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND        -- ← Low Watermark 来源
) WITH ('connector'='kafka', 'topic'='courier-events', 'format'='json', ...);

-- 规则1 无状态：离目的地 >500m
INSERT INTO alert_far
SELECT courierId, <距离公式> AS dist_m, `type`
FROM courier_events WHERE `type`='DELIVERY_COMPLETE' AND <距离> > 500;

-- 规则2 有状态+窗口：20秒内 >3 单
INSERT INTO alert_rate
SELECT courierId, window_start, window_end, COUNT(*)
FROM TABLE(TUMBLE(TABLE courier_events, DESCRIPTOR(ts), INTERVAL '20' SECOND))
WHERE `type`='DELIVERY_COMPLETE'
GROUP BY courierId, window_start, window_end HAVING COUNT(*) > 3;
```

**② 造数据** `flink-kafka-docker/producer/producer.py`：每秒发一批 JSON 到 Kafka，埋了两个假数据——
- **c3**：在离目的地 ~2.2km 处"送达"（纬度差 0.02°×111320=**2226m**）→ 触发 FAR_FROM_DEST
- **c4**：每秒 1 单 → 20 秒窗口里 >3 → 触发 HIGH_RATE
- c1/c2：正常（对照组）
- JSON 的 key 必须和 SQL 表的列**一一对上**（这是 producer↔Flink 的契约）

---

## Q7. 整条链路串起来

```
producer.py 造 JSON         Kafka(管道)         Flink SQL 读+判          UI/输出
────────────────           ──────────         ──────────────          ──────
event(c3, 远2.2km)   ─▶  topic           ─▶  WHERE dist>500     ─▶  Stdout: FAR_FROM_DEST> c3,2226
event(c4, 每秒1单)   ─▶  courier-events  ─▶  TUMBLE 20s COUNT>3 ─▶  Stdout: HIGH_RATE> c4
event_time_ms=now    ─▶                  ─▶  WATERMARK ts-5s    ─▶  Low Watermark≈now-5s
```
Kafka 解耦两端：producer 不知道谁读，Flink 不知道谁写。

---

## Q8. 怎么自己跑 + 看 UI

```bash
cd flink-kafka-docker
docker compose up -d --build     # 起 Kafka + Flink + 作业 + producer
open http://localhost:8081       # Flink UI
docker compose logs -f taskmanager | grep -E "FAR_FROM_DEST|HIGH_RATE"   # 看告警
docker compose down -v           # 关掉
```
UI 导览见 [`../flink-kafka-docker/README.md`](../flink-kafka-docker/README.md)。

---

## Q9. 回扣 UC2（这才是面试要的）

- 这一套（几个 JVM + Kafka）只为抓几个模式——**对 ~20 到几千/秒的量级是重型工具**。
- 那 45 秒延迟：UI 里先看 **Backpressure**（红=下游顶不住，常是同步 I/O）、**Checkpoint** 时长、**并行度 vs Kafka 分区数**。
- right-sizing：撞上"实时聚合 / event-time乱序 / CEP / DB被压垮"这些触发器才值得 Flink；否则 **Kafka 消费者 + Redis** 就够（`flink-kafka-lab/` 里那个 `KeyedState` 就是 Redis 的角色）。
- 详见 [`fraud-detection-explained.md`](./fraud-detection-explained.md)。
