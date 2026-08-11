-- Monthly training plans: a scheduled calendar of sessions placed on the
-- athlete's actual available days (not a guessed pattern), plus daily
-- check-ins that feed the *existing* adaptation engine (applyFeedback) so
-- reported soreness naturally steers later sessions in the same plan --
-- reusing the soreness-penalty scoring already in routineGenerator rather
-- than building a second, parallel "assistance" system.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS available_days TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_plans_user_status ON training_plans(user_id, status);

CREATE TABLE IF NOT EXISTS training_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  session_log_id UUID REFERENCES session_logs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_training_plan_days_plan ON training_plan_days(plan_id, scheduled_date);

CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  soreness JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);
