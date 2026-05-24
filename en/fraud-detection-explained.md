# How Real-time Fraud Detection Works (UC2 study notes)

> 中文版本：[`../zh/fraud-detection-explained.md`](../zh/fraud-detection-explained.md)
>
> Companion runnable demo: [`../flink-kafka-lab/`](../flink-kafka-lab/) (`node flink-kafka-lab/run.mjs`).
> This note covers both *how the engine runs* (Flink) and *how detection operates* (fraud detection) — UC2 study material.

## In one line

> **Continuously compute a "risk signal" from courier behavior events, trigger a tiered response based on that signal, and feed human-review outcomes back so it keeps getting more accurate.**
> Flink is only the "compute" step in the middle; the full system is a loop: **events → risk signal → response → feedback**.

---

## Part 1 — How the engine runs (Apache Flink)

### The biggest misconception

The teaching demo is "one process, runs once, then exits." **Real Flink is not a script — it's a long-running distributed cluster**: a set of always-on JVM processes. Once you submit your job it runs **24/7**, continuously pulling from Kafka, processing, and emitting. It does not "finish" like a batch job.

### Cluster anatomy

```
   Client ──submit job──▶  ┌─────────────────────────────────┐
   (packaged JAR/Python)   │  JobManager  (the brain)         │
                           │   - splits the job into tasks     │
                           │   - schedules, coordinates        │
                           │     checkpoints, restarts on fail │
                           └──────────────┬──────────────────┘
                                          │ schedule
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                   ┌─────────┐       ┌─────────┐       ┌─────────┐
                   │TaskMgr1 │       │TaskMgr2 │       │TaskMgr3 │  (workers)
                   │ slot... │       │ slot... │       │ slot... │
                   └────┬────┘       └─────────┘       └────┬────┘
                        │ consume                           │ checkpoint
                        ▼                                   ▼
                    Kafka (source)                    S3 / HDFS (state snapshots)
```

| Role | What it does |
|------|--------------|
| **Client** | Submits the packaged job to the cluster, then can leave |
| **JobManager** | The brain: turns the job into parallel tasks, schedules them onto workers, coordinates checkpoints, restarts from a snapshot on failure |
| **TaskManager** | The worker: the process that actually runs your operator code; each has several **slots** (= how many parallel tasks it can run) |

### How a job becomes "a thing that runs"

1. Your source → operator → sink is really a **dataflow graph**.
2. On submit, the JobManager splits each operator into parallel **subtasks** by **parallelism**.
   - `parallelism=4` → the keyBy operator has 4 copies running on 4 slots (possibly on different machines).
3. `keyBy(courierId)` triggers a **shuffle**: all events for one courier are routed to one fixed subtask → that courier's state lives only in that subtask.
4. The job **runs forever**, continuously consuming Kafka.

### What keeps it alive: checkpoints

1. Every few seconds, all subtasks take a **consistent snapshot of their state** at once, saved to S3/HDFS.
2. If a TaskManager crashes → Flink restores state from the latest snapshot + **rewinds Kafka offsets** → replays.
3. Result: **exactly-once** — no loss, no duplicates, even across crashes.

> The demo's `KeyedState` (a JS Map) is gone if the process dies; real Flink uses checkpoints to bring that "Map" back exactly as it was after a machine failure. That's the essential gap between a single-process script and a distributed stream engine.

### How you actually "run Flink"

- **Self-hosted cluster**: Docker/K8s for JobManager + TaskManagers, `flink run yourjob.jar`.
- **Managed** (no ops): AWS Kinesis Data Analytics for Flink / Confluent / Ververica.
- **Local play**: `./bin/start-cluster.sh`, open the `localhost:8081` Web UI to see the job graph, parallelism, checkpoints, backpressure.

---

## Part 2 — How detection operates (end to end)

```
① Behavior events     ② Pipeline (Flink)        ③ Decision      ④ Response            ⑤ Feedback
─────────────         ──────────────────         ────────        ────────             ────────
GPS pings      ─┐                                risk score       low → log only        analyst verdict
delivery events ├─▶ Kafka ─▶ enrich ─▶ detect ─▶ (0–1 or     ─▶  med → human review ──▶ (confirmed / FP)
earnings/pay    │           (dest /    (rules+ML)  flag)            queue                    │
merchant/order ─┘            profile)                          high → automated action       │
                                                               (hold pay / suspend / verify)  │
                                                                                              ▼
                                                       ◀──── labeled data: tune thresholds / retrain
```

### ② Detect — how it decides

| Method | How it decides | Trade-offs |
|--------|----------------|-----------|
| **Rules** | hardcoded thresholds: distance > 500 m, speed > 200 km/h, > 5 deliveries/min | ✅ fast, transparent, explainable; ❌ rigid, gameable |
| **ML model** | learns "what normal looks like", scores deviations (anomaly detection / classification), outputs 0–1 risk | ✅ catches subtle collusion; ❌ needs labeled data, hard to explain |
| **Hybrid** | rules for the clear-cut + ML for the subtle → combined into a **risk score** | the real-world default |

> The lab's three rules are the "rules" tier: `far-from-dest` (stateless), `fake-gps` (stateful), `high-rate` (windowed). Subtle patterns like collusion are where ML earns its keep.
>
> The three operator types: **stateless** (one event is enough) / **stateful** (needs keyed state, e.g. compare to the previous ping) / **stateful + windowed** (aggregate/count over time).

### ④ What happens after a hit (the most overlooked step)

**Key: it's not an auto-ban.** False positives hurt good couriers, so the response is **tiered by confidence**:

| Risk | Action |
|------|--------|
| Low | log / monitor only |
| Medium | **route to a human-review queue** — an ops analyst takes a look |
| High | automated action: hold the payout / suspend the account / require re-verification |

> **Human-in-the-loop is central.** High-stakes actions either go through review or get a "soft" treatment first (hold payout without banning) pending review — because "GPS drifted 2 km" is often just bad signal, not fraud.

### ⑤ How it gets more accurate (the loop)

1. **Shadow mode**: a new rule/model **scores without acting** first; compare against known outcomes, then enforce once it measures well.
2. **Feedback loop**: analysts' "confirmed fraud / false positive" verdicts become **labeled data** → tune thresholds, retrain models.
3. **The two key metrics in tension**:
   - **Precision**: of what we flagged, how much is real fraud (high = fewer good couriers wronged)
   - **Recall**: of all real fraud, how much we caught (high = fewer misses)
   - Raise the threshold → precision↑ recall↓; lower it → the reverse. **The business sets the balance.**

---

## Walk-through: the journey of one suspicious event

```
Courier taps "delivered" 2.2 km from the destination
   └─▶ DELIVERY_COMPLETE event (with GPS) ─▶ Kafka
        └─▶ Flink: enrich with the order's destination ─▶ far-from-dest rule: 2224 m > 500 m ✓
             └─▶ emit risk signal (medium confidence)
                  └─▶ policy: hold this payout + route to human-review queue
                       └─▶ analyst checks the trail: weak signal in a mall basement → "false positive" → release payout
                            └─▶ FP feeds back → raise the threshold for that area / add a model feature
```

---

## Mapping to the lab and UC2

- **The lab implements step ② (detect)** — `alert(...)` is the "risk signal", and it stops there.
- **A real system continues into ③ decide → ④ respond → ⑤ feedback** (scoring, review queue, payout holds, retraining).
- **The UC2 team** is stuck on the streaming implementation of ②; but a full fraud system is much more than streaming. **Staff guidance**: get the **simplest single rule working end-to-end** (detect → alert) to prove the pipeline, then layer on ML, responses, and feedback — don't try to ship 12 patterns + ML + auto-ban all at once.
- **Right-sizing — but measure first (UC2 gives no volume).** The number depends entirely on *what you count*:
  - *Delivery events only:* 50k couriers × ~30/day ≈ **~20/sec avg, ~100/sec peak**.
  - *Plus GPS pings* (what fraud detection actually runs on): ~10k concurrent couriers pinging every ~5s ≈ **~1,000–3,000/sec at peak** — 1–2 orders of magnitude higher.
  - *Cross-check:* UC1's **2M offers/hour ≈ 556/sec** sustained, so the platform already operates at hundreds/sec.
  - So the real fraud-relevant rate plausibly spans **~20 to a few thousand/sec** — a range that *straddles* "Flink is overkill" and "Flink is justified". **Don't assert overkill; measure the real rate (especially GPS volume) first**, then right-size: low end → Kafka consumer + Redis; high end → Kafka Streams / Flink. Either way the 45s latency is most likely misconfiguration (sync I/O / under-parallelism / hot keys / checkpoint storms), independent of tool choice.

## One-line summary

> **Fraud detection = compute a risk signal from behavior events in a stream (rules + ML), respond in tiers by confidence (log / human review / automated action), then close the loop with review outcomes to keep improving. Flink is a long-running distributed cluster and only the "compute" step; the hard parts are responding without hurting good couriers, and the feedback loop that makes it more accurate over time.**
