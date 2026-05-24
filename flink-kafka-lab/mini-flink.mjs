// ─────────────────────────────────────────────────────────────────────────
// mini-flink — a tiny TEACHING model of Apache Flink (not production!)
// ─────────────────────────────────────────────────────────────────────────
//
// What real Flink is: a distributed STREAM PROCESSOR. It runs your logic on
// every event as it arrives (low latency), keeps STATE across events, and
// understands EVENT TIME so it can handle out-of-order / late data correctly.
//
// Concept mapping (real Flink ➜ this file):
//   keyBy(courierId)        ➜ StreamJob({ keyBy })   partition the stream by key
//   Keyed State             ➜ KeyedState             per-key memory across events
//   Operator / ProcessFn    ➜ addOperator(name, fn)  your per-event logic
//   Event time              ➜ event.eventTime        when it HAPPENED (not now)
//   Watermark               ➜ this.watermark         "seen everything up to W"
//   Allowed lateness        ➜ allowedLatenessMs      tolerance for out-of-order
//   Late event              ➜ ctx.late === true      arrived after the watermark
//   Tumbling window         ➜ windowStart(ts, size)  fixed [start, start+size)
//
// WHY EVENT TIME + WATERMARKS EXIST (the #1 streaming concept):
//   Mobile events arrive out of order and late (bad signal, retries). If you
//   bucketed by wall-clock arrival time, your windows would be wrong. So Flink
//   timestamps each event by when it HAPPENED, and a "watermark" tracks how far
//   event-time has progressed. A watermark of W means "I don't expect events
//   older than W anymore" — windows up to W can safely fire; anything older is
//   LATE and handled specially (dropped, or sent to a side-output).

export class KeyedState {
  constructor() {
    this.map = new Map();
  }
  get(key) {
    return this.map.get(key);
  }
  set(key, v) {
    this.map.set(key, v);
  }
}

export class StreamJob {
  constructor({ keyBy, allowedLatenessMs = 0 }) {
    this.keyBy = keyBy;
    this.allowedLatenessMs = allowedLatenessMs;
    this.operators = [];
    this.maxEventTime = -Infinity;
    this.watermark = -Infinity;
  }

  addOperator(name, fn) {
    this.operators.push({ name, fn });
    return this;
  }

  // Process one Kafka record through every operator (Flink's operator chain).
  process(record) {
    const event = record.value;
    const key = this.keyBy(event);

    // Is this event late? (older than the current watermark)
    const late = event.eventTime < this.watermark;

    // Advance the watermark: "bounded out-of-orderness" strategy —
    // watermark = (max event time seen so far) - allowedLateness.
    this.maxEventTime = Math.max(this.maxEventTime, event.eventTime);
    this.watermark = this.maxEventTime - this.allowedLatenessMs;

    const ctx = { key, event, record, late, watermark: this.watermark };
    for (const op of this.operators) op.fn(ctx);
  }
}

// Tumbling window: which fixed [start, start+size) bucket does ts fall in?
export function windowStart(ts, sizeMs) {
  return Math.floor(ts / sizeMs) * sizeMs;
}
