-- Phase 1 schema: users, profiles, onboarding, pose library, routines, sessions, meditations, progress

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  gender TEXT,
  fitness_level TEXT,
  yoga_experience TEXT,
  occupation TEXT,
  daily_activity_level TEXT,
  current_flexibility TEXT,
  current_mobility TEXT,
  medical_conditions TEXT[] NOT NULL DEFAULT '{}',
  past_injuries TEXT[] NOT NULL DEFAULT '{}',
  current_injuries TEXT[] NOT NULL DEFAULT '{}',
  joint_pain JSONB NOT NULL DEFAULT '{}',
  pregnancy_status TEXT,
  stress_level INT,
  sleep_quality INT,
  workout_history TEXT,
  favorite_exercise_types TEXT[] NOT NULL DEFAULT '{}',
  favorite_yoga_styles TEXT[] NOT NULL DEFAULT '{}',
  available_equipment TEXT[] NOT NULL DEFAULT '{}',
  workout_schedule JSONB NOT NULL DEFAULT '{}',
  goals TEXT[] NOT NULL DEFAULT '{}',
  favorite_music_genres TEXT[] NOT NULL DEFAULT '{}',
  preferred_coaching_style TEXT,
  learning_style TEXT,
  voice_preference TEXT,
  avatar_preference JSONB NOT NULL DEFAULT '{}',
  color_theme TEXT,
  meditation_goals TEXT[] NOT NULL DEFAULT '{}',
  mental_wellness_goals TEXT[] NOT NULL DEFAULT '{}',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  adaptation_state JSONB NOT NULL DEFAULT '{"avoidedPoses": [], "sorenessAreas": {}, "difficultyTrend": 0, "recentEnjoyment": []}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  answers JSONB NOT NULL DEFAULT '{}',
  pending_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  styles TEXT[] NOT NULL DEFAULT '{}',
  primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  common_mistakes TEXT[] NOT NULL DEFAULT '{}',
  contraindications TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT[] NOT NULL DEFAULT '{}',
  default_duration_sec INT NOT NULL DEFAULT 30,
  breathing_cue TEXT,
  pose_reference_angles JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  goal_tags TEXT[] NOT NULL DEFAULT '{}',
  total_duration_sec INT NOT NULL DEFAULT 0,
  generated_reason JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  pose_id UUID NOT NULL REFERENCES poses(id),
  sequence_index INT NOT NULL,
  duration_sec INT NOT NULL,
  cue_timestamps JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completion_pct NUMERIC NOT NULL DEFAULT 0,
  poses_skipped UUID[] NOT NULL DEFAULT '{}',
  pain_reported JSONB NOT NULL DEFAULT '{}',
  difficulty_feedback TEXT,
  enjoyment_rating INT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS meditation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  goal TEXT,
  duration_sec INT NOT NULL,
  script TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  flexibility_score NUMERIC,
  mobility_score NUMERIC,
  balance_score NUMERIC,
  strength_score NUMERIC,
  meditation_minutes NUMERIC NOT NULL DEFAULT 0,
  workout_minutes NUMERIC NOT NULL DEFAULT 0,
  streak_days INT NOT NULL DEFAULT 0,
  mood_score NUMERIC,
  stress_score NUMERIC,
  UNIQUE (user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_routines_user ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_user ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_metrics_user_date ON progress_metrics(user_id, metric_date);
