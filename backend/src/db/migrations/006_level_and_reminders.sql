-- Onboarding completion enhancements: a computed practice level shown right
-- after onboarding, and an opt-in for the existing notification sweep to
-- respect the user's preferred practice time (workout_schedule.preferredTime,
-- already collected) instead of firing at any hour.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS yoga_level TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true;
