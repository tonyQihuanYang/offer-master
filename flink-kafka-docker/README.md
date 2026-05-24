# Real Flink + Kafka — see how Flink actually runs

> A **real** Apache Flink cluster + Apache Kafka in Docker, running a SQL fraud-detection
> job over a live event stream. Purpose: **see the Flink Web UI** and understand the runtime
> (job graph, parallelism, checkpoints, backpressure, throughput) — the things the
> zero-dep [`../flink-kafka-lab/`](../flink-kafka-lab/) model can only *describe*.

## Run it

```bash
cd flink-kafka-docker
docker compose up -d --build      # first run pulls ~1GB (Flink + Kafka images)
open http://localhost:8081        # the Flink Web UI

docker compose logs -f taskmanager   # watch the fraud alerts print
docker compose down -v               # stop & clean up
```

What's running (5 containers):

| Container | Role |
|-----------|------|
| `fkd-kafka` | Apache Kafka (KRaft, single node) — the event log |
| `fkd-jobmanager` | Flink **JobManager** — the brain + the Web UI (:8081) |
| `fkd-taskmanager` | Flink **TaskManager** — the worker (4 task slots) |
| `fkd-sql-submitter` | submits `sql/fraud.sql` to the cluster, then idles |
| `fkd-producer` | streams courier events into Kafka continuously |

> If the UI shows no job after ~1 min, the submitter is still starting (the SQL client JVM is slow to boot). You can also submit manually:
> `docker compose exec jobmanager bash -c "/opt/flink/bin/sql-client.sh -f /opt/sql/fraud.sql"`
> (the `sql/` folder is mounted into the jobmanager too).

## What to look at in the Flink UI (http://localhost:8081)

This is the whole point — map what you see to the concepts:

| In the UI | What it means |
|-----------|---------------|
| **Running Jobs** | `courier-fraud-detection` — the SQL job(s), running **forever** (streaming, not batch) |
| Click a job → **the dataflow graph** | Source (Kafka) → operators (filter / window aggregate) → Sink. This is your `keyBy`/window/`INSERT` turned into a parallel execution graph |
| **Parallelism** on each operator | how many parallel subtasks (bounded by Kafka partitions for the source) |
| **Records Received / Sent** | live throughput per operator — see the numbers tick up |
| **Backpressure** tab (per operator) | OK / LOW / HIGH — *this* is what "Flink is slow" usually means: a downstream operator (often blocking I/O) can't keep up |
| **Checkpoints** tab | periodic state snapshots (every 10s here). Duration & size; if these grow/fail, state management is the problem |
| **Task Managers → Stdout** | the `print` sink output — the actual `FAR_FROM_DEST` / `HIGH_RATE` alerts |

## The job (`sql/fraud.sql`)

Pure Flink SQL over a Kafka source with **event-time + watermark**:

- **Source** `courier_events` — reads JSON from Kafka topic `courier-events`, declares `ts` as event-time with a 5s watermark.
- **(1) Stateless rule** `FAR_FROM_DEST` — `DELIVERY_COMPLETE` more than 500 m from the destination (equirectangular distance in SQL).
- **(2) Stateful + windowed rule** `HIGH_RATE` — more than 3 deliveries by one courier in a 20s tumbling window (`TABLE(TUMBLE(...))`).

The producer plants both: courier `c3` completes ~2 km away (FAR), courier `c4` completes rapidly (HIGH_RATE); `c1`/`c2` are normal.

## How this maps to the concepts (and the lab)

| Concept | Here (real Flink) | In `flink-kafka-lab/` (the model) |
|---------|-------------------|-----------------------------------|
| Cluster | JobManager + TaskManager processes | one Node process |
| Parallelism | real subtasks across slots (UI shows it) | single-threaded |
| Keyed state | managed state + checkpoints (UI Checkpoints tab) | a JS `Map` |
| Event-time / watermark | `WATERMARK FOR ts` + TUMBLE window | `allowedLatenessMs` + `windowStart` |
| Fault tolerance | checkpoint → restore → exactly-once | none (crash = gone) |
| Backpressure | a real UI metric | explained in the README only |

## Tie-back to UC2

This is what the UC2 team is operating. In the UI you can *see* the things to diagnose:
**backpressure** (the 45s-latency culprit), **checkpoint** duration/failures, **parallelism** vs Kafka partitions.
And it makes the right-sizing point concrete: this cluster is several JVMs + Kafka just to detect a couple of patterns — at ~20–few-thousand events/sec, a Kafka consumer + Redis would carry the same logic with a fraction of the operational surface. See [`../en/fraud-detection-explained.md`](../en/fraud-detection-explained.md).

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | the 5-service stack |
| `Dockerfile` | Flink image + the Kafka SQL connector jar |
| `sql/fraud.sql` | the SQL job (source + 2 rules + sinks) |
| `producer/` | Python Kafka producer (plants the fraud signals) |
