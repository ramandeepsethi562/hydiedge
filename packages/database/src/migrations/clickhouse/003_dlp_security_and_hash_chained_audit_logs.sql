-- ============================================================================
-- 003_dlp_security_and_hash_chained_audit_logs.sql (ClickHouse 24.x)
-- 11-Layer DLP Security Events Stream & SHA-256 Hash-Chained Immutable Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS dlp_security_events_stream (
  event_id String,
  org_id LowCardinality(String),
  employee_id LowCardinality(String),
  device_id LowCardinality(String),
  occurred_at_utc DateTime64(3, 'UTC'),
  dlp_channel LowCardinality(String),
  severity LowCardinality(String),
  action_taken LowCardinality(String),
  policy_id LowCardinality(String),
  source_process LowCardinality(String),
  artifact_name String,
  artifact_sha256 FixedString(64),
  destination_endpoint String,
  risk_score UInt8,
  metadata_json String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at_utc)
ORDER BY (org_id, occurred_at_utc, severity, employee_id, event_id)
TTL toDateTime(occurred_at_utc) + INTERVAL 730 DAY DELETE
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS immutable_audit_log_chain (
  sequence_no UInt64,
  event_id String,
  org_id LowCardinality(String),
  actor_user_id LowCardinality(String),
  actor_role LowCardinality(String),
  actor_ip String,
  module_key LowCardinality(String),
  action_verb LowCardinality(String),
  sensitive_gate_used LowCardinality(String),
  target_entity_type LowCardinality(String),
  target_entity_id String,
  payload_json String,
  prev_hash_sha256 FixedString(64),
  record_hash_sha256 FixedString(64),
  occurred_at_utc DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at_utc)
ORDER BY (org_id, sequence_no, occurred_at_utc)
TTL toDateTime(occurred_at_utc) + INTERVAL 2555 DAY DELETE
SETTINGS index_granularity = 8192;
