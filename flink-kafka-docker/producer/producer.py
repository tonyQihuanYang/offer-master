"""Streams courier events into Kafka topic 'courier-events' continuously.

Plants two fraud signals so the Flink jobs visibly fire:
  - c3 occasionally marks DELIVERY_COMPLETE far from the destination  -> FAR_FROM_DEST
  - c4 completes deliveries rapidly (> 3 per 20s window)               -> HIGH_RATE
Everyone also emits normal GPS pings + near-destination completions so the
Flink UI shows steady throughput.
"""
import json
import random
import time

from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

TOPIC = "courier-events"
DEST = (51.05, -114.07)  # a Calgary-ish destination


def connect():
    for attempt in range(60):
        try:
            return KafkaProducer(
                bootstrap_servers="kafka:9092",
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
        except NoBrokersAvailable:
            print(f"[producer] kafka not ready, retry {attempt+1}/60…", flush=True)
            time.sleep(2)
    raise SystemExit("[producer] could not reach kafka")


def now_ms():
    return int(time.time() * 1000)


def event(courier, typ, lat, lng, dest_lat=DEST[0], dest_lng=DEST[1]):
    return {
        "courierId": courier,
        "type": typ,
        "lat": lat,
        "lng": lng,
        "dest_lat": dest_lat,
        "dest_lng": dest_lng,
        "event_time_ms": now_ms(),
    }


def main():
    p = connect()
    print("[producer] connected. streaming events…", flush=True)
    tick = 0
    while True:
        tick += 1
        # normal couriers: GPS pings near the area
        for c in ("c1", "c2"):
            p.send(TOPIC, event(c, "GPS_PING", 51.04 + random.uniform(0, 0.02),
                                -114.06 + random.uniform(0, 0.02)))
        # normal delivery near destination (no alert)
        if tick % 3 == 0:
            p.send(TOPIC, event("c1", "DELIVERY_COMPLETE", 51.0501, -114.0699))

        # FRAUD c3: completes ~2km from destination -> FAR_FROM_DEST
        if tick % 5 == 0:
            p.send(TOPIC, event("c3", "DELIVERY_COMPLETE", 51.07, -114.07))

        # FRAUD c4: rapid completions -> HIGH_RATE (>3 per 20s window)
        p.send(TOPIC, event("c4", "DELIVERY_COMPLETE", *DEST))

        p.flush()
        if tick % 10 == 0:
            print(f"[producer] sent ~{tick*4} events", flush=True)
        time.sleep(1)


if __name__ == "__main__":
    main()
