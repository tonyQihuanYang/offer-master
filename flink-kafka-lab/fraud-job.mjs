// ─────────────────────────────────────────────────────────────────────────
// fraud-job — the actual detection logic, as a set of Flink-style operators.
// ─────────────────────────────────────────────────────────────────────────
//
// Three real fraud patterns from the use case, chosen to show the THREE kinds
// of streaming operator you'll be asked about:
//
//   (1) far-from-destination  → STATELESS   (everything needed is in the event)
//   (2) fake-gps              → STATEFUL    (needs the courier's PREVIOUS ping)
//   (3) high-rate             → STATEFUL + WINDOWED (count per time window)
//
// This is the heart of "what does Flink actually buy you?":
//   - (1) barely needs a stream engine — a map+filter would do.
//   - (2)(3) need per-key STATE across events — that's Flink's real value.

import { KeyedState, windowStart } from './mini-flink.mjs';

const FAR_THRESHOLD_M = 500; // "completed" this far from destination = suspicious
const TELEPORT_KMH = 200; // ground speed no courier can hit = fake GPS
const WINDOW_MS = 60_000; // 1-minute tumbling window
const MAX_DELIVERIES_PER_WINDOW = 5; // > this in one window = suspicious

// Haversine distance between two {lat,lng} points, in meters.
function haversineMeters(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function buildFraudOperators(alert) {
  // Keyed state = per-courier memory. In real Flink this lives in managed,
  // checkpointed state (RocksDB) so it survives failures (exactly-once).
  const lastPing = new KeyedState(); // courierId -> { lat, lng, eventTime }
  const windowCounts = new KeyedState(); // courierId -> Map(windowStart -> count)

  return [
    // (1) STATELESS — both actual GPS and destination are inside the event.
    [
      'far-from-destination',
      ({ event }) => {
        if (event.type !== 'DELIVERY_COMPLETE') return;
        const d = haversineMeters(event.gps, event.destination);
        if (d > FAR_THRESHOLD_M) {
          alert('FAR_FROM_DEST', event, `marked complete ${Math.round(d)} m from destination`);
        }
      },
    ],

    // (2) STATEFUL — compare this GPS ping to the courier's PREVIOUS ping.
    //     Impossible speed ⇒ fabricated location.
    [
      'fake-gps',
      ({ key, event }) => {
        if (event.type !== 'GPS_PING') return;
        const prev = lastPing.get(key);
        lastPing.set(key, { ...event.gps, eventTime: event.eventTime });
        if (!prev) return; // first ping for this courier — nothing to compare
        const meters = haversineMeters(prev, event.gps);
        const seconds = Math.max(1, (event.eventTime - prev.eventTime) / 1000);
        const kmh = meters / 1000 / (seconds / 3600);
        if (kmh > TELEPORT_KMH) {
          alert('FAKE_GPS', event, `${Math.round(meters)} m in ${seconds.toFixed(0)} s ≈ ${Math.round(kmh)} km/h`);
        }
      },
    ],

    // (3) STATEFUL + WINDOWED — count deliveries per courier per 1-min window.
    [
      'high-rate',
      ({ key, event }) => {
        if (event.type !== 'DELIVERY_COMPLETE') return;
        const w = windowStart(event.eventTime, WINDOW_MS);
        let counts = windowCounts.get(key);
        if (!counts) {
          counts = new Map();
          windowCounts.set(key, counts);
        }
        const c = (counts.get(w) || 0) + 1;
        counts.set(w, c);
        if (c > MAX_DELIVERIES_PER_WINDOW) {
          alert('HIGH_RATE', event, `${c} deliveries in one ${WINDOW_MS / 1000}s window`);
        }
      },
    ],
  ];
}
