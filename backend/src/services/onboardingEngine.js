const { CORE_FIELDS, FOLLOW_UP_RULES } = require('../data/onboardingQuestions');

// Returns the next question to ask given answers collected so far and the
// list of dynamic follow-up fields already queued/answered this session.
// Returns null when onboarding is complete.
function getNextQuestion(answers, extraFields) {
  for (const field of CORE_FIELDS) {
    if (field.condition && !field.condition(answers)) continue;
    if (!(field.key in answers)) return field;
  }

  for (const field of extraFields) {
    if (!(field.key in answers)) return field;
  }

  return null;
}

// After recording `answeredKey`, figure out which follow-up questions (if any)
// newly apply and aren't already queued.
function computeFollowUps(answers, existingExtraFields) {
  const queuedKeys = new Set(existingExtraFields.map((f) => f.key));
  const newFields = [...existingExtraFields];

  for (const rule of FOLLOW_UP_RULES) {
    if (queuedKeys.has(rule.field.key)) continue;
    if (rule.triggerKey in answers && rule.shouldAsk(answers)) {
      newFields.push(rule.field);
      queuedKeys.add(rule.field.key);
    }
  }

  return newFields;
}

function toIntOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toArray(v) {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && x !== '');
  if (v === null || v === undefined || v === '') return [];
  return [v];
}

// Maps the flat onboarding answers object onto user_profiles columns.
function buildProfileUpdate(answers) {
  return {
    age: toIntOrNull(answers.age),
    height_cm: answers.height_cm ?? null,
    weight_kg: answers.weight_kg ?? null,
    gender: answers.gender ?? null,
    fitness_level: answers.fitness_level ?? null,
    yoga_experience: answers.yoga_experience ?? null,
    occupation: answers.occupation ?? null,
    daily_activity_level: answers.daily_activity_level ?? null,
    current_flexibility: answers.current_flexibility ?? null,
    current_mobility: answers.current_mobility ?? null,
    medical_conditions: toArray(answers.medical_conditions),
    past_injuries: toArray(answers.past_injuries),
    current_injuries: toArray(answers.current_injuries),
    joint_pain: {
      back: toIntOrNull(answers.back_pain) ?? 0,
      neck: toIntOrNull(answers.neck_pain) ?? 0,
      hip: toIntOrNull(answers.hip_pain) ?? 0,
      knee: toIntOrNull(answers.knee_pain) ?? 0,
    },
    pregnancy_status: answers.pregnancy_status ?? 'not_applicable',
    stress_level: toIntOrNull(answers.stress_level),
    sleep_quality: toIntOrNull(answers.sleep_quality),
    workout_history: answers.workout_history ?? null,
    favorite_exercise_types: toArray(answers.favorite_exercise_types),
    favorite_yoga_styles: toArray(answers.favorite_yoga_styles),
    available_equipment: toArray(answers.available_equipment),
    workout_schedule: {
      daysPerWeek: toIntOrNull(answers.workout_days_per_week),
      sessionLengthMin: toIntOrNull(answers.session_length_min),
      preferredTime: answers.preferred_time ?? null,
    },
    goals: toArray(answers.goals),
    favorite_music_genres: toArray(answers.favorite_music_genres),
    preferred_coaching_style: answers.preferred_coaching_style ?? null,
    learning_style: answers.learning_style ?? null,
    voice_preference: answers.voice_preference ?? null,
    avatar_preference: { instructorGender: answers.instructor_gender ?? 'female' },
    color_theme: answers.color_theme ?? null,
    meditation_goals: toArray(answers.meditation_goals),
    mental_wellness_goals: toArray(answers.mental_wellness_goals),
  };
}

module.exports = { getNextQuestion, computeFollowUps, buildProfileUpdate };
