-- Real Flink SQL fraud detection over a Kafka stream.
-- Submitted by the sql-submitter container; the jobs then run continuously in
-- the cluster (visible at http://localhost:8081). Output goes to the
-- TaskManager stdout (Flink UI → Task Managers → Stdout, or `docker compose logs taskmanager`).

SET 'execution.runtime-mode' = 'streaming';
SET 'pipeline.name' = 'courier-fraud-detection';

-- ── Source: read courier events from Kafka, with event-time + watermark ──
CREATE TABLE courier_events (
  courierId      STRING,
  `type`         STRING,
  lat            DOUBLE,
  lng            DOUBLE,
  dest_lat       DOUBLE,
  dest_lng       DOUBLE,
  event_time_ms  BIGINT,
  ts AS TO_TIMESTAMP_LTZ(event_time_ms, 3),
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND   -- tolerate 5s out-of-orderness
) WITH (
  'connector' = 'kafka',
  'topic' = 'courier-events',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'flink-fraud',
  'scan.startup.mode' = 'latest-offset',
  'format' = 'json',
  'json.fail-on-missing-field' = 'false',
  'json.ignore-parse-errors' = 'true'
);

-- ── Sinks: print (shows up in TaskManager stdout) ────────────────────────
CREATE TABLE alert_far (
  courierId STRING, dist_m DOUBLE, `type` STRING
) WITH ('connector' = 'print', 'print-identifier' = 'FAR_FROM_DEST');

CREATE TABLE alert_rate (
  courierId STRING, window_start TIMESTAMP(3), window_end TIMESTAMP(3), cnt BIGINT
) WITH ('connector' = 'print', 'print-identifier' = 'HIGH_RATE');

-- ── (1) STATELESS rule: completed too far from the destination ───────────
-- Equirectangular distance approximation in meters.
INSERT INTO alert_far
SELECT courierId,
       111320 * SQRT(POWER(lat - dest_lat, 2)
                     + POWER(COS(RADIANS(lat)) * (lng - dest_lng), 2)) AS dist_m,
       `type`
FROM courier_events
WHERE `type` = 'DELIVERY_COMPLETE'
  AND 111320 * SQRT(POWER(lat - dest_lat, 2)
                    + POWER(COS(RADIANS(lat)) * (lng - dest_lng), 2)) > 500;

-- ── (2) STATEFUL + WINDOWED rule: too many deliveries per 20s window ──────
INSERT INTO alert_rate
SELECT courierId, window_start, window_end, COUNT(*) AS cnt
FROM TABLE(TUMBLE(TABLE courier_events, DESCRIPTOR(ts), INTERVAL '20' SECOND))
WHERE `type` = 'DELIVERY_COMPLETE'
GROUP BY courierId, window_start, window_end
HAVING COUNT(*) > 3;
