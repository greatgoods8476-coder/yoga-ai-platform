-- Manual heart-rate entry (wearable sync is a later phase — see docs/ROADMAP.md).
-- Session-level raw values plus a daily rolling average for the dashboard.

ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS avg_heart_rate INT;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS max_heart_rate INT;

ALTER TABLE progress_metrics ADD COLUMN IF NOT EXISTS avg_heart_rate NUMERIC;
