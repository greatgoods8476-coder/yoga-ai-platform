-- Three new progression dimensions beyond the original four
-- (flexibility/mobility/balance/strength already existed). A Monthly Exam
-- (mobility retest) scores all seven from the recorded movements and writes
-- them straight into progress_metrics, so it moves the same dashboard the
-- rest of the app already shows, not a separate disconnected number.

ALTER TABLE progress_metrics ADD COLUMN IF NOT EXISTS stability_score NUMERIC;
ALTER TABLE progress_metrics ADD COLUMN IF NOT EXISTS movement_control_score NUMERIC;
ALTER TABLE progress_metrics ADD COLUMN IF NOT EXISTS athletic_performance_score NUMERIC;

ALTER TABLE mobility_tests ADD COLUMN IF NOT EXISTS scores JSONB;
