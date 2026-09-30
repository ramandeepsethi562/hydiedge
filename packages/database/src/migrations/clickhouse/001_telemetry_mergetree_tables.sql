-- ============================================================================
-- 001_telemetry_mergetree_tables.sql (ClickHouse 24.x)
-- High-Frequency 10-Second Activity Slices, Keystroke Forensic Logs & Heartbeats
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_slices_10s (
  slice_id String,
  org_id LowCardinality(String),
  employee_id LowCardinality(String),
  department_id LowCardinality(String),
  team_id LowCardinality(String),
  device_id LowCardinality(String),
  slice_start_utc DateTime64(3, 'UTC'),
  duration_sec UInt8,
  time_state LowCardinality(String),
  productivity_category LowCardinality(String),
  productivity_weight Float32,
  process_name LowCardinality(String),
  window_title String,
  url_full String,
  url_domain LowCardinality(String),
  browser_name LowCardinality(String),
  keystrokes_count UInt16,
  mouse_clicks_count UInt16,
  mouse_distance_px UInt32,
  scroll_ticks UInt16,
  idle_seconds_elapsed UInt32,
  active_mic_db Float32,
  active_speaker_db Float32,
  is_personal_mode UInt8,
  is_away_break UInt8,
  away_reason_code LowCardinality(String),
  project_id LowCardinality(String),
  task_id LowCardinality(String),
  monitor_index UInt8,
  ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(slice_start_utc)
ORDER BY (org_id, employee_id, slice_start_utc, slice_id)
TTL toDateTime(slice_start_utc) + INTERVAL 365 DAY DELETE
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS keystroke_logs (
  log_id String,
  org_id LowCardinality(String),
  employee_id LowCardinality(String),
  device_id LowCardinality(String),
  captured_at_utc DateTime64(3, 'UTC'),
  process_name LowCardinality(String),
  window_title String,
  url_domain LowCardinality(String),
  masked_text_sequence String,
  keystroke_count UInt16,
  paste_events_count UInt8,
  backspace_ratio Float32,
  typing_wpm Float32,
  contains_sensitive_pattern UInt8
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(captured_at_utc)
ORDER BY (org_id, employee_id, captured_at_utc, log_id)
TTL toDateTime(captured_at_utc) + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS agent_heartbeats_stream (
  org_id LowCardinality(String),
  employee_id LowCardinality(String),
  device_id LowCardinality(String),
  heartbeat_utc DateTime64(3, 'UTC'),
  agent_version LowCardinality(String),
  os_platform LowCardinality(String),
  current_time_state LowCardinality(String),
  active_app LowCardinality(String),
  cpu_usage_pct Float32,
  ram_usage_mb UInt32,
  sqlite_offline_queue_depth UInt32,
  public_ip String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(heartbeat_utc)
ORDER BY (org_id, employee_id, heartbeat_utc)
TTL toDateTime(heartbeat_utc) + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;
