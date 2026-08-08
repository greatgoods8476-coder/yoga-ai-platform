// Seeds a coach's organization with realistic simulated athletes for sales
// demos to college athletic programs. Reuses the real signup, onboarding
// completion, level assessment, and routine generation code paths (not
// fabricated data glued onto the DB) so what a coach sees in the dashboard
// is exactly what a real athlete's account would produce.
//
// Usage: node src/db/seedDemoAthletes.js coach@example.com ["Program Name"] [count]
//
// The coach account must already exist (sign up normally in the app first) --
// this script only adds simulated athletes under that real, already-
// authenticated account, it doesn't fabricate the coach identity.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { buildProfileUpdate } = require('../services/onboardingEngine');
const { assessYogaLevel } = require('../services/levelAssessment');
const { generateRoutine } = require('../services/routineGenerator');

const DEMO_PASSWORD = 'DemoAthlete123!';

const GOAL_ROUTINE_TYPE = {
  build_strength: 'strength_yoga',
  explosiveness: 'power_yoga',
  injury_prevention: 'athlete_recovery',
  inseason_recovery: 'athlete_recovery',
  mobility_for_sport: 'hip_mobility',
};

const ATHLETES = [
  { first: 'Jordan', last: 'Ellis', sport: 'basketball', position: 'point guard', goal: 'build_strength', season: 'in_season', fitness: 'athlete', flex: 'fair', mobility: 'good' },
  { first: 'Maya', last: 'Torres', sport: 'basketball', position: 'forward', goal: 'injury_prevention', season: 'in_season', fitness: 'advanced', flex: 'poor', mobility: 'moderate', injury: 'knee', kneePain: 3 },
  { first: 'DeShawn', last: 'Carter', sport: 'football', position: 'wide receiver', goal: 'explosiveness', season: 'offseason', fitness: 'athlete', flex: 'fair', mobility: 'good' },
  { first: 'Nate', last: 'Whitfield', sport: 'football', position: 'offensive lineman', goal: 'mobility_for_sport', season: 'offseason', fitness: 'athlete', flex: 'poor', mobility: 'limited' },
  { first: 'Sophia', last: 'Nguyen', sport: 'soccer', position: 'midfielder', goal: 'inseason_recovery', season: 'in_season', fitness: 'advanced', flex: 'good', mobility: 'good' },
  { first: 'Liam', last: 'Okafor', sport: 'soccer', position: 'defender', goal: 'build_strength', season: 'preseason', fitness: 'advanced', flex: 'fair', mobility: 'moderate' },
  { first: 'Ava', last: 'Bergstrom', sport: 'track', position: 'sprinter', goal: 'explosiveness', season: 'in_season', fitness: 'athlete', flex: 'fair', mobility: 'good' },
  { first: 'Priya', last: 'Sharma', sport: 'track', position: 'distance', goal: 'inseason_recovery', season: 'in_season', fitness: 'advanced', flex: 'good', mobility: 'good', injury: 'hip', hipPain: 4 },
  { first: 'Marcus', last: 'Reid', sport: 'volleyball', position: 'outside hitter', goal: 'mobility_for_sport', season: 'postseason', fitness: 'athlete', flex: 'fair', mobility: 'moderate' },
  { first: 'Elena', last: 'Vasquez', sport: 'swimming', position: 'freestyle', goal: 'build_strength', season: 'in_season', fitness: 'advanced', flex: 'excellent', mobility: 'excellent' },
  { first: 'Tyler', last: 'Brooks', sport: 'baseball', position: 'pitcher', goal: 'injury_prevention', season: 'preseason', fitness: 'advanced', flex: 'fair', mobility: 'moderate' },
  { first: 'Grace', last: 'Kim', sport: 'volleyball', position: 'setter', goal: 'build_strength', season: 'postseason', fitness: 'athlete', flex: 'good', mobility: 'good' },
];

function baseAnswers(a) {
  return {
    age: 20, height_cm: 178, weight_kg: 75, gender: 'prefer_not_to_say',
    fitness_level: a.fitness, yoga_experience: 'none',
    occupation: 'student athlete', daily_activity_level: 'very_active',
    sport: a.sport, athletic_position: a.position, season_phase: a.season, primary_athletic_goal: a.goal,
    current_flexibility: a.flex, current_mobility: a.mobility,
    medical_conditions: ['none'], past_injuries: ['none'],
    current_injuries: a.injury ? [a.injury] : ['none'],
    back_pain: 0, neck_pain: 0, hip_pain: a.hipPain || 0, knee_pain: a.kneePain || 0,
    pregnancy_status: 'not_applicable', stress_level: 5, sleep_quality: 6,
    workout_history: `${a.sport} strength and conditioning`, favorite_exercise_types: ['weight_training'],
    favorite_yoga_styles: ['power', 'vinyasa'], available_equipment: ['mat', 'none'],
    workout_days_per_week: 4, session_length_min: 20, preferred_time: 'morning',
    goals: ['strength', 'flexibility', 'recovery'], favorite_music_genres: ['hip_hop'],
    preferred_coaching_style: 'energetic', learning_style: 'kinesthetic',
    voice_preference: 'no_preference', instructor_gender: 'female', color_theme: 'calm_blue',
    meditation_goals: ['sports_performance'], mental_wellness_goals: ['improve_focus'],
  };
}

async function findOrCreateOrgForCoach(client, coachUserId, orgName) {
  const existing = await client.query(
    "SELECT o.* FROM organizations o JOIN org_memberships om ON om.org_id = o.id WHERE om.user_id = $1 AND om.role = 'coach' ORDER BY o.created_at ASC LIMIT 1",
    [coachUserId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const { rows } = await client.query('INSERT INTO organizations (name) VALUES ($1) RETURNING *', [orgName]);
  await client.query("INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'coach')", [rows[0].id, coachUserId]);
  return rows[0];
}

async function createAthlete(client, poses, orgId, spec) {
  const email = `${spec.first.toLowerCase()}.${spec.last.toLowerCase()}.demo@example.com`;
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`  skip (already exists): ${spec.first} ${spec.last} <${email}>`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: userRows } = await client.query(
    'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
    [email, passwordHash, `${spec.first} ${spec.last}`]
  );
  const userId = userRows[0].id;
  await client.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [userId]);

  const answers = baseAnswers(spec);
  const yogaLevel = assessYogaLevel(answers);
  const profileUpdate = { ...buildProfileUpdate(answers), yoga_level: yogaLevel.level };
  const cols = Object.keys(profileUpdate);
  const setClause = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rows: profileRows } = await client.query(
    `UPDATE user_profiles SET ${setClause}, onboarding_completed = true, updated_at = now() WHERE user_id = $1 RETURNING *`,
    [userId, ...cols.map((c) => profileUpdate[c])]
  );

  await client.query(
    `INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'athlete')
     ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'athlete'`,
    [orgId, userId]
  );

  const routineTypeKey = GOAL_ROUTINE_TYPE[spec.goal] || 'custom';
  const result = generateRoutine({
    profile: { ...profileRows[0], user_id: userId },
    poses,
    routineTypeKey,
    recentPoseIds: [],
  });

  const { rows: routineRows } = await client.query(
    `INSERT INTO routines (user_id, type, title, goal_tags, total_duration_sec, generated_reason)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, routineTypeKey, result.title, result.goalTags, result.totalDurationSec, result.generatedReason]
  );
  for (let idx = 0; idx < result.items.length; idx += 1) {
    const it = result.items[idx];
    await client.query(
      `INSERT INTO routine_items (routine_id, pose_id, sequence_index, duration_sec, cue_timestamps)
       VALUES ($1,$2,$3,$4,$5)`,
      [routineRows[0].id, it.pose.id, idx, it.durationSec, { startSec: it.startSec }]
    );
  }

  console.log(`  + ${spec.first} ${spec.last} <${email}> — ${spec.sport}/${spec.position}, level=${yogaLevel.level}, routine="${result.title}"`);
}

async function main() {
  const [, , coachEmail, orgNameArg, countArg] = process.argv;
  if (!coachEmail) {
    console.error('Usage: node src/db/seedDemoAthletes.js coach@example.com ["Program Name"] [count]');
    process.exitCode = 1;
    return;
  }
  const orgName = orgNameArg || 'Demo Athletic Program';
  const count = Math.min(parseInt(countArg, 10) || ATHLETES.length, ATHLETES.length);

  const { rows: coachRows } = await pool.query('SELECT id FROM users WHERE email = $1', [coachEmail.toLowerCase()]);
  if (coachRows.length === 0) {
    console.error(`No user found for ${coachEmail} — sign up with this email in the app first, then re-run this script.`);
    process.exitCode = 1;
    return;
  }
  const coachUserId = coachRows[0].id;

  const { rows: poses } = await pool.query('SELECT * FROM poses');
  if (poses.length === 0) {
    console.error('No poses found — run `npm run seed` first.');
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  try {
    const org = await findOrCreateOrgForCoach(client, coachUserId, orgName);
    console.log(`Organization: ${org.name} (${org.id})`);
    console.log(`Seeding ${count} demo athletes (shared password: ${DEMO_PASSWORD})...`);
    for (const spec of ATHLETES.slice(0, count)) {
      await createAthlete(client, poses, org.id, spec);
    }
    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
