-- B2B pivot: a coach owns an organization (a college athletic program) and
-- can see the athletes in it -- their onboarding results, computed practice
-- level, and generated training. Real self-enrollment/invite flow is out of
-- scope for this pass (see ROADMAP) -- athletes are added directly (coach
-- action or seed data) rather than self-enrolling with a join code.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'athlete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_role ON org_memberships(org_id, role);

-- Athletic identity, collected during onboarding, surfaced on the coach roster.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sport TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS athletic_position TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS season_phase TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS primary_athletic_goal TEXT;
