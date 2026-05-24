// ─────────────────────────────────────────────────────────────────────────
// mini-kafka — a tiny TEACHING model of Apache Kafka (not production!)
// ─────────────────────────────────────────────────────────────────────────
//
// What real Kafka is: a durable, distributed log of "records" (events),
// organized into TOPICS, each split into PARTITIONS. Producers append records;
// consumers read them in order. The whole point is decoupling: producers and
// consumers don't know about each other, and the log is replayable.
//
// Concept mapping (real Kafka ➜ this file):
//   Topic       ➜ KafkaTopic            a named stream, e.g. "courier-events"
//   Partition   ➜ one slot in offsets[] an ordered shard of the topic
//   Key         ➜ record.key            decides the partition (hash(key) % N)
//   Offset      ➜ record.offset         position of a record within a partition
//   Producer    ➜ .produce(key, value)
//   Consumer    ➜ .subscribe(handler)
//
// THE ONE IDEA THAT MATTERS MOST:
//   Records with the SAME key always go to the SAME partition. Ordering is
//   guaranteed *within* a partition. So if we key by courierId, every event
//   for one courier is ordered and handled together — which is exactly what
//   stateful per-courier logic (Flink keyBy) needs downstream.

import { EventEmitter } from 'node:events';

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export class KafkaTopic {
  constructor(name, numPartitions = 3) {
    this.name = name;
    this.numPartitions = numPartitions;
    this.bus = new EventEmitter();
    this.offsets = new Array(numPartitions).fill(0);
  }

  // Producer: the KEY decides the partition → same key, same partition, ordered.
  produce(key, value) {
    const partition = hashCode(key) % this.numPartitions;
    const offset = this.offsets[partition]++;
    const record = { key, value, partition, offset };
    // In real Kafka this is a durable append; here we just notify consumers.
    queueMicrotask(() => this.bus.emit('record', record));
    return { partition, offset };
  }

  // Consumer: receive records as they arrive (in real Kafka you poll & commit).
  subscribe(handler) {
    this.bus.on('record', handler);
  }
}
