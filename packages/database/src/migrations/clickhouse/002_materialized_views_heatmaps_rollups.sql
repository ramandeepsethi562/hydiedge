-- ============================================================================
-- 002_materialized_views_heatmaps_rollups.sql (ClickHouse 24.x)
-- SummingMergeTree Rollups for Hourly Productivity, Lifetime Day-of-Week x Hour
-- Heatmaps, and Daily Application/URL Usage Aggregations
-- ============================================================================

CREATE TABLE IF NOT EXISTS hourly_productivity_rollup (
  org_id LowCardinality(String),
  department_id LowCardinality(String),
  team_id LowCardinality(String),
  employee_id LowCardinality(String),
  hour_bucket_utc DateTime('UTC'),
  productive_seconds UInt64,
  non_productive_seconds UInt64,
  neutral_seconds UInt64,
  no_impact_seconds UInt64,
  idle_seconds UInt64,
  away_seconds UInt64,
  total_keystrokes UInt64,
  total_mouse_clicks UInt64,
  total_mouse_distance_px UInt64,
  total_scroll_ticks UInt64
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour_bucket_utc)
ORDER BY (org_id, department_id, team_id, employee_id, hour_bucket_utc);

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_productivity_rollup_mv
TO hourly_productivity_rollup
AS
SELECT
  org_id,
  department_id,
  team_id,
  employee_id,
  toStartOfHour(slice_start_utc) AS hour_bucket_utc,
  sumIf(duration_sec, time_state = 'PRODUCTIVE') AS productive_seconds,
  sumIf(duration_sec, time_state = 'NON_PRODUCTIVE') AS non_productive_seconds,
  sumIf(duration_sec, time_state = 'NEUTRAL') AS neutral_seconds,
  sumIf(duration_sec, time_state = 'NO_IMPACT') AS no_impact_seconds,
  sumIf(duration_sec, time_state = 'IDLE') AS idle_seconds,
  sumIf(duration_sec, time_state = 'AWAY') AS away_seconds,
  sum(keystrokes_count) AS total_keystrokes,
  sum(mouse_clicks_count) AS total_mouse_clicks,
  sum(mouse_distance_px) AS total_mouse_distance_px,
  sum(scroll_ticks) AS total_scroll_ticks
FROM activity_slices_10s
WHERE is_personal_mode = 0
GROUP BY org_id, department_id, team_id, employee_id, hour_bucket_utc;

CREATE TABLE IF NOT EXISTS lifetime_activity_heatmap (
  org_id LowCardinality(String),
  employee_id LowCardinality(String),
  day_of_week UInt8,
  hour_of_day UInt8,
  active_seconds UInt64,
  productive_seconds UInt64,
  idle_seconds UInt64,
  sample_slices UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (org_id, employee_id, day_of_week, hour_of_day);

CREATE MATERIALIZED VIEW IF NOT EXISTS lifetime_activity_heatmap_mv
TO lifetime_activity_heatmap
AS
SELECT
  org_id,
  employee_id,
  toDayOfWeek(slice_start_utc) AS day_of_week,
  toHour(slice_start_utc) AS hour_of_day,
  sumIf(duration_sec, time_state IN ('PRODUCTIVE', 'NON_PRODUCTIVE', 'NEUTRAL', 'WORKING')) AS active_seconds,
  sumIf(duration_sec, time_state = 'PRODUCTIVE') AS productive_seconds,
  sumIf(duration_sec, time_state = 'IDLE') AS idle_seconds,
  count() AS sample_slices
FROM activity_slices_10s
WHERE is_personal_mode = 0
GROUP BY org_id, employee_id, day_of_week, hour_of_day;

CREATE TABLE IF NOT EXISTS app_url_usage_daily (
  org_id LowCardinality(String),
  department_id LowCardinality(String),
  employee_id LowCardinality(String),
  usage_date Date,
  process_name LowCardinality(String),
  url_domain LowCardinality(String),
  productivity_category LowCardinality(String),
  total_duration_seconds UInt64,
  total_keystrokes UInt64,
  total_mouse_clicks UInt64
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(usage_date)
ORDER BY (org_id, usage_date, department_id, employee_id, process_name, url_domain, productivity_category);

CREATE MATERIALIZED VIEW IF NOT EXISTS app_url_usage_daily_mv
TO app_url_usage_daily
AS
SELECT
  org_id,
  department_id,
  employee_id,
  toDate(slice_start_utc) AS usage_date,
  process_name,
  url_domain,
  productivity_category,
  sum(duration_sec) AS total_duration_seconds,
  sum(keystrokes_count) AS total_keystrokes,
  sum(mouse_clicks_count) AS total_mouse_clicks
FROM activity_slices_10s
WHERE is_personal_mode = 0
GROUP BY org_id, department_id, employee_id, usage_date, process_name, url_domain, productivity_category;
