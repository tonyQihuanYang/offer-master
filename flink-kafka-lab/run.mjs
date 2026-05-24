// ─────────────────────────────────────────────────────────────────────────
// run — wires Kafka ➜ Flink, emits a scripted event stream, narrates output.
//   node flink-kafka-lab/run.mjs
// ─────────────────────────────────────────────────────────────────────────
//
// Pipeline (same shape as the real thing):
//   producer ─▶ Kafka topic "courier-events" (keyed by courierId)
//            ─▶ Flink job (keyBy courierId) ─▶ fraud operators ─▶ alert sink

import { KafkaTopic } from './mini-kafka.mjs';
import { StreamJob } from './mini-flink.mjs';
import { buildFraudOperators } from './fraud-job.mjs';

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cyn: '\x1b[36m', rst: '\x1b[0m' };
const log = (...a) => console.log(...a);

// ── Sink: where alerts go (a DB / risk system in real life) ────────────────
function alert(kind, event, detail) {
  log(`${C.red}  🚨 ALERT [${kind}] courier=${event.courierId} — ${detail}${C.rst}`);
}

// ── Build the topology ─────────────────────────────────────────────────────
const topic = new KafkaTopic('courier-events', 3);

const job = new StreamJob({
  keyBy: (event) => event.courierId, // ← Flink keyBy: all of a courier's events together
  allowedLatenessMs: 2_000, // tolerate 2s of out-of-orderness before "late"
});
for (const [name, fn] of buildFraudOperators(alert)) job.addOperator(name, fn);

// Consumer: every Kafka record flows into the Flink job. Also print the record
// so you can SEE partitioning + event-time + late detection happen.
topic.subscribe((record) => {
  const e = record.value;
  const late = e.eventTime < job.watermark;
  const t = new Date(e.eventTime).toISOString().slice(14, 19); // mm:ss
  log(
    `${C.dim}p${record.partition}@${record.offset}${C.rst} ${C.cyn}${t}${C.rst} ` +
      `${e.type.padEnd(16)} courier=${e.courierId}` +
      (late ? `${C.yel} ⟂ LATE — dropped (real Flink: side-output / allowed-lateness)${C.rst}` : ''),
  );
  // Drop late events BEFORE they reach the operators — otherwise an
  // out-of-order event corrupts stateful results (e.g. a negative time delta).
  // This is exactly why Flink side-outputs/drops events past the watermark.
  if (late) return;
  job.process(record);
});

// ── A scripted stream (real data would be unbounded & live) ────────────────
// eventTime is the simulated "when it happened" clock (ms). We emit them with
// small real delays so it FEELS like a live stream.
const T0 = Date.UTC(2026, 0, 1, 9, 0, 0);
const s = (sec) => T0 + sec * 1000;
const gps = (lat, lng) => ({ lat, lng });
const DEST = gps(51.05, -114.07); // a Calgary-ish destination

// Emitted in ASCENDING event-time order, like a healthy stream — so the
// watermark advances smoothly. Only the LAST event is deliberately out-of-order
// (an old event time arriving late) to demonstrate late handling.
const script = [
  { courierId: 'c1', type: 'GPS_PING', gps: gps(51.04, -114.06), eventTime: s(0) }, // c1 normal
  { courierId: 'c4', type: 'DELIVERY_COMPLETE', gps: DEST, destination: DEST, eventTime: s(5) }, // c4 #1
  { courierId: 'c2', type: 'GPS_PING', gps: gps(51.0, -114.0), eventTime: s(8) }, // c2 ping
  { courierId: 'c4', type: 'DELIVERY_COMPLETE', gps: DEST, destination: DEST, eventTime: s(10) }, // c4 #2
  { courierId: 'c2', type: 'GPS_PING', gps: gps(51.06, -114.05), eventTime: s(12) }, // c2 → FAKE_GPS (≈7.5km/4s)
  { courierId: 'c4', type: 'DELIVERY_COMPLETE', gps: DEST, destination: DEST, eventTime: s(15) }, // c4 #3
  { courierId: 'c1', type: 'GPS_PING', gps: gps(51.045, -114.065), eventTime: s(20) }, // c1 normal
  { courierId: 'c4', type: 'DELIVERY_COMPLETE', gps: DEST, destination: DEST, eventTime: s(22) }, // c4 #4
  { courierId: 'c4', type: 'DELIVERY_COMPLETE', gps: DEST, destination: DEST, eventTime: s(25) }, // c4 #5
  { courierId: 'c3', type: 'DELIVERY_COMPLETE', gps: gps(51.07, -114.07), destination: DEST, eventTime: s(30) }, // c3 → FAR (~2.2km)
  { courierId: 'c4', type: 'DELIVERY_COMPLETE', gps: DEST, destination: DEST, eventTime: s(32) }, // c4 #6 → HIGH_RATE (6 in [0,60)s window)
  { courierId: 'c1', type: 'DELIVERY_COMPLETE', gps: gps(51.0501, -114.0699), destination: DEST, eventTime: s(40) }, // c1 delivers at dest → no alert
  { courierId: 'c1', type: 'GPS_PING', gps: gps(51.046, -114.066), eventTime: s(18) }, // ⟂ arrives last, old event-time → LATE
];

log(`${C.grn}▶ streaming ${script.length} events into Kafka topic "courier-events" (3 partitions)…${C.rst}\n`);

let i = 0;
function emitNext() {
  if (i >= script.length) {
    log(
      `\n${C.grn}✔ stream drained.${C.rst} ${C.dim}c1 (normal) raised no alerts; c2=FAKE_GPS, c3=FAR_FROM_DEST, c4=HIGH_RATE fired; the replayed c1 ping arrived after the watermark → LATE.${C.rst}`,
    );
    return;
  }
  const e = script[i++];
  topic.produce(e.courierId, e); // KEY = courierId → decides the partition
  setTimeout(emitNext, 250);
}
emitNext();
