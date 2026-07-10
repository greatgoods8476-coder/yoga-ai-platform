const { call } = require('./util');

const DEFAULT_ANSWERS = {
  age: 30, height_cm: 165, weight_kg: 60, gender: 'female',
  fitness_level: 'beginner', yoga_experience: 'none',
  occupation: 'teacher', daily_activity_level: 'lightly_active',
  current_flexibility: 'fair', current_mobility: 'moderate',
  medical_conditions: ['none'], past_injuries: ['none'], current_injuries: ['none'],
  back_pain: 0, neck_pain: 0, hip_pain: 0, knee_pain: 0,
  pregnancy_status: 'not_applicable', stress_level: 5, sleep_quality: 6,
  workout_history: 'none', favorite_exercise_types: ['walking'],
  favorite_yoga_styles: ['hatha'], available_equipment: ['mat'],
  workout_days_per_week: 3, session_length_min: 20, preferred_time: 'morning',
  goals: ['flexibility', 'stress_reduction'], favorite_music_genres: ['ambient'],
  preferred_coaching_style: 'calm_meditative', learning_style: 'visual',
  voice_preference: 'no_preference', instructor_gender: 'female', color_theme: 'calm_blue',
  meditation_goals: ['stress'], mental_wellness_goals: ['reduce_anxiety'],
};

// Drives /onboarding/start + /onboarding/answer to completion using either
// the default answer set or an override map, returning the final response.
async function completeOnboarding(baseUrl, token, overrides = {}) {
  const answers = { ...DEFAULT_ANSWERS, ...overrides };
  let { body: state } = await call(baseUrl, 'POST', '/onboarding/start', { token });

  let last;
  while (state.question) {
    const { key } = state.question;
    const value = key in answers ? answers[key] : 'n/a';
    ({ body: state } = await call(baseUrl, 'POST', '/onboarding/answer', {
      token, body: { sessionId: state.sessionId, field: key, value },
    }));
    last = state;
  }
  return last;
}

async function signupAndOnboard(baseUrl, email, password, overrides = {}) {
  const { body: signup } = await call(baseUrl, 'POST', '/auth/signup', { body: { email, password } });
  await completeOnboarding(baseUrl, signup.token, overrides);
  return signup;
}

module.exports = { completeOnboarding, signupAndOnboard, DEFAULT_ANSWERS };
