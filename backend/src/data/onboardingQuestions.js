// Ordered onboarding field definitions. `type` tells the client how to render
// the question; `condition` lets a field be skipped based on prior answers;
// `followUps` are additional dynamic questions injected based on the answer
// just given (the "AI should ask follow-up questions whenever needed" requirement).

const CORE_FIELDS = [
  { key: 'age', prompt: "First things first — how old are you?", type: 'number', min: 13, max: 100 },
  { key: 'height_cm', prompt: 'How tall are you, in centimeters?', type: 'number', min: 100, max: 250 },
  { key: 'weight_kg', prompt: 'And your weight, in kilograms?', type: 'number', min: 30, max: 300 },
  {
    key: 'gender', prompt: 'How do you describe your gender?', type: 'single_select',
    options: ['female', 'male', 'non_binary', 'prefer_not_to_say'],
  },
  {
    key: 'fitness_level', prompt: "Let's talk fitness — how would you rate yours overall?", type: 'single_select',
    options: ['beginner', 'intermediate', 'advanced', 'athlete'],
  },
  {
    key: 'yoga_experience', prompt: 'Now the big one — how much yoga have you actually done?', type: 'single_select',
    options: ['none', 'beginner', 'intermediate', 'advanced'],
  },
  { key: 'occupation', prompt: "What do you do for work? (Helps me plan around desk time, travel, physical labor, etc.)", type: 'text' },
  {
    key: 'daily_activity_level', prompt: 'Outside of workouts, how active is your day-to-day?', type: 'single_select',
    options: ['sedentary', 'lightly_active', 'active', 'very_active'],
  },
  { key: 'sport', prompt: "What sport do you play? (Say 'none' if this doesn't apply to you.)", type: 'text' },
  {
    key: 'athletic_position', prompt: "What position or event? (Say 'n/a' if not applicable.)", type: 'text',
    condition: (a) => a.sport && a.sport.toLowerCase() !== 'none',
  },
  {
    key: 'season_phase', prompt: 'Where are you in your season right now?', type: 'single_select',
    options: ['preseason', 'in_season', 'postseason', 'offseason'],
    condition: (a) => a.sport && a.sport.toLowerCase() !== 'none',
  },
  {
    key: 'primary_athletic_goal', prompt: "What's the main thing you want yoga to do for your training?", type: 'single_select',
    options: ['build_strength', 'explosiveness', 'injury_prevention', 'inseason_recovery', 'mobility_for_sport'],
    condition: (a) => a.sport && a.sport.toLowerCase() !== 'none',
  },
  {
    key: 'current_flexibility', prompt: 'Be honest — how flexible are you right now?', type: 'single_select',
    options: ['poor', 'fair', 'good', 'excellent'],
  },
  {
    key: 'current_mobility', prompt: 'How about your joints — how freely do they move?', type: 'single_select',
    options: ['limited', 'moderate', 'good', 'excellent'],
  },
  { key: 'medical_conditions', prompt: 'Any medical conditions I should know about? (List them, or just say "none".)', type: 'multi_text' },
  { key: 'past_injuries', prompt: 'Any past injuries, even ones that are fully healed now?', type: 'multi_text' },
  { key: 'current_injuries', prompt: "Anything bothering you right now — aches, tweaks, old trouble spots?", type: 'multi_text' },
  { key: 'back_pain', prompt: 'On a scale of 0 (none) to 5 (severe), how much back pain do you have?', type: 'scale', min: 0, max: 5 },
  { key: 'neck_pain', prompt: 'Same scale — how about your neck?', type: 'scale', min: 0, max: 5 },
  { key: 'hip_pain', prompt: 'And your hips?', type: 'scale', min: 0, max: 5 },
  { key: 'knee_pain', prompt: 'Last one — your knees?', type: 'scale', min: 0, max: 5 },
  {
    key: 'pregnancy_status', prompt: 'Is pregnancy or postpartum recovery relevant to you right now?', type: 'single_select',
    options: ['not_applicable', 'pregnant', 'postpartum'],
    condition: (a) => a.gender !== 'male',
  },
  { key: 'stress_level', prompt: 'On a scale of 1 (very low) to 10 (very high), how stressed are you these days?', type: 'scale', min: 1, max: 10 },
  { key: 'sleep_quality', prompt: 'On a scale of 1 (very poor) to 10 (excellent), how has your sleep been?', type: 'scale', min: 1, max: 10 },
  { key: 'workout_history', prompt: "Tell me a bit about your workout history — what have you tried before?", type: 'text' },
  { key: 'favorite_exercise_types', prompt: 'What kinds of exercise do you actually enjoy?', type: 'multi_text' },
  {
    key: 'favorite_yoga_styles', prompt: 'Which yoga styles sound appealing to you?', type: 'multi_select',
    options: ['hatha', 'vinyasa', 'yin', 'power', 'restorative', 'prenatal', 'breathwork'],
  },
  {
    key: 'available_equipment', prompt: 'What have you got lying around to practice with?', type: 'multi_select',
    options: ['mat', 'blocks', 'strap', 'bolster', 'wall', 'chair', 'none'],
  },
  { key: 'workout_days_per_week', prompt: "Realistically, how many days a week do you want to practice?", type: 'number', min: 1, max: 7 },
  {
    key: 'available_days', prompt: 'Which specific days actually work for you? (Pick as many as you need — this is what your monthly plan gets scheduled around.)',
    type: 'multi_select',
    options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
  { key: 'session_length_min', prompt: 'How many minutes do you usually have to spare per session?', type: 'number', min: 5, max: 90 },
  {
    key: 'preferred_time', prompt: 'When do you like to practice?', type: 'single_select',
    options: ['morning', 'midday', 'evening', 'varies'],
  },
  {
    key: 'goals', prompt: "What are you really here for? Pick your top goals.", type: 'multi_select',
    options: [
      'flexibility', 'mobility', 'pain_reduction', 'stress_reduction', 'posture', 'balance',
      'recovery', 'breathing', 'mindfulness', 'sleep', 'strength', 'body_awareness', 'habit_building',
    ],
  },
  { key: 'favorite_music_genres', prompt: 'What music helps you relax or focus?', type: 'multi_text' },
  {
    key: 'preferred_coaching_style', prompt: "What kind of coach energy motivates you most?", type: 'single_select',
    options: ['calm_meditative', 'traditional', 'energetic', 'clinical_pt', 'minimal', 'silent'],
  },
  {
    key: 'learning_style', prompt: 'How do you pick up new movement best?', type: 'single_select',
    options: ['visual', 'verbal', 'kinesthetic'],
  },
  {
    key: 'voice_preference', prompt: "Got a voice preference for your coach?", type: 'single_select',
    options: ['male', 'female', 'no_preference'],
  },
  {
    key: 'instructor_gender', prompt: 'Nearly there — preferred look for your avatar coach?', type: 'single_select',
    options: ['male', 'female', 'custom'],
  },
  {
    key: 'color_theme', prompt: 'Which app color theme feels most calming to you?', type: 'single_select',
    options: ['calm_blue', 'earth_tone', 'sunrise', 'monochrome', 'high_contrast'],
  },
  {
    key: 'meditation_goals', prompt: 'What do you want meditation to help with?', type: 'multi_select',
    options: ['stress', 'sleep', 'focus', 'confidence', 'healing', 'anxiety', 'gratitude', 'sports_performance', 'exam_preparation'],
  },
  {
    key: 'mental_wellness_goals', prompt: "Last question — any bigger mental wellness goals on your mind?", type: 'multi_select',
    options: ['reduce_anxiety', 'build_confidence', 'process_grief', 'improve_focus', 'emotional_regulation', 'self_compassion'],
  },
];

// Dynamic follow-ups: given the full answer map after a field was just
// answered, return an extra field definition to ask next, or null.
const FOLLOW_UP_RULES = [
  {
    triggerKey: 'current_injuries',
    shouldAsk: (a) => Array.isArray(a.current_injuries) && a.current_injuries.some((v) => v && v.toLowerCase() !== 'none'),
    field: { key: 'injury_follow_up', prompt: 'Tell me more about your current injuries so I can avoid aggravating poses.', type: 'text' },
  },
  {
    triggerKey: 'medical_conditions',
    shouldAsk: (a) => Array.isArray(a.medical_conditions) && a.medical_conditions.some((v) => v && v.toLowerCase() !== 'none'),
    field: { key: 'medical_follow_up', prompt: 'Anything about those conditions I should factor into your sessions (e.g. movement restrictions)?', type: 'text' },
  },
  {
    triggerKey: 'stress_level',
    shouldAsk: (a) => Number(a.stress_level) >= 7,
    field: { key: 'stress_follow_up', prompt: "What's contributing most to your stress right now?", type: 'text' },
  },
  {
    triggerKey: 'sleep_quality',
    shouldAsk: (a) => Number(a.sleep_quality) <= 4,
    field: { key: 'sleep_follow_up', prompt: "What tends to get in the way of good sleep for you?", type: 'text' },
  },
  {
    triggerKey: 'pregnancy_status',
    shouldAsk: (a) => a.pregnancy_status === 'pregnant',
    field: {
      key: 'pregnancy_trimester', prompt: 'Which trimester are you in?', type: 'single_select',
      options: ['first', 'second', 'third'],
    },
  },
];

module.exports = { CORE_FIELDS, FOLLOW_UP_RULES };
