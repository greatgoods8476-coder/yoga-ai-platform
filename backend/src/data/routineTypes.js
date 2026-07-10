// Routine "templates" from the spec's list of AI-generated program types.
// `categories` entries are matched against a pose's `category` (position
// family: standing/seated/tabletop/supine/prone/balance/arm_balance/
// inversion/backbend/restorative/breathwork) OR its `focus_tags`
// (cross-cutting functional labels like 'hip_opener' or 'backbend') — see
// routineGenerator's tagMatches(). This just biases pose selection; the
// actual picks still come from personalization on top of this template.
module.exports = {
  morning_mobility: { title: 'Morning Mobility', categories: ['hip_opener', 'shoulder_opener', 'spine_mobility', 'standing', 'breathwork'], durationMin: 15 },
  evening_relaxation: { title: 'Evening Relaxation', categories: ['restorative', 'breathwork', 'seated', 'calming'], durationMin: 20 },
  beginner_yoga: { title: 'Beginner Yoga', categories: [], targetDifficulty: 'beginner', durationMin: 20 },
  advanced_yoga: { title: 'Advanced Yoga', categories: [], targetDifficulty: 'advanced', durationMin: 30 },
  weight_loss_yoga: { title: 'Weight Loss Yoga', categories: ['strength', 'standing', 'balance'], durationMin: 30 },
  athlete_recovery: { title: 'Athlete Recovery', categories: ['restorative', 'hamstring', 'hip_opener'], durationMin: 20 },
  office_stretching: { title: 'Office Stretching', categories: ['office_friendly', 'seated', 'twist'], durationMin: 10 },
  lower_back_pain: { title: 'Lower Back Pain Relief', categories: ['restorative', 'twist', 'office_friendly'], durationMin: 15 },
  neck_pain: { title: 'Neck Pain Relief', categories: ['office_friendly', 'restorative'], durationMin: 10 },
  hip_mobility: { title: 'Hip Mobility', categories: ['hip_opener'], durationMin: 20 },
  shoulder_mobility: { title: 'Shoulder Mobility', categories: ['shoulder_opener', 'office_friendly'], durationMin: 15 },
  hamstring_flexibility: { title: 'Hamstring Flexibility', categories: ['hamstring'], durationMin: 20 },
  split_training: { title: 'Split Training', categories: ['hamstring', 'hip_opener'], targetDifficulty: 'advanced', durationMin: 25 },
  balance_training: { title: 'Balance Training', categories: ['balance'], durationMin: 15 },
  meditation_session: { title: 'Meditation Session', categories: ['breathwork', 'restorative', 'calming'], durationMin: 10 },
  stress_relief: { title: 'Stress Relief', categories: ['restorative', 'breathwork', 'calming'], durationMin: 20 },
  deep_stretch: { title: 'Deep Stretch', categories: ['hamstring', 'hip_opener', 'seated'], durationMin: 30 },
  breathwork: { title: 'Breathwork', categories: ['breathwork'], durationMin: 10 },
  sleep_preparation: { title: 'Sleep Preparation', categories: ['restorative', 'breathwork', 'sleep'], durationMin: 15 },
  travel_recovery: { title: 'Travel Recovery', categories: ['hip_opener', 'restorative', 'spine_mobility'], durationMin: 15 },
  running_recovery: { title: 'Running Recovery', categories: ['hamstring', 'hip_opener', 'restorative'], durationMin: 20 },
  strength_yoga: { title: 'Strength Yoga', categories: ['strength', 'core'], durationMin: 25 },
  power_yoga: { title: 'Power Yoga', categories: ['standing', 'strength'], stylesBias: ['power'], durationMin: 30 },
  prenatal_yoga: { title: 'Prenatal Yoga', categories: ['prenatal_safe', 'breathwork', 'restorative'], stylesBias: ['prenatal'], durationMin: 20 },
  senior_mobility: { title: 'Senior Mobility', categories: ['senior_friendly', 'office_friendly'], durationMin: 15 },
  five_minute_stretch: { title: 'Daily Five-Minute Stretch', categories: [], durationMin: 5 },
  twenty_minute_mobility: { title: 'Twenty-Minute Mobility', categories: ['hip_opener', 'shoulder_opener', 'spine_mobility'], durationMin: 20 },
  one_hour_full_body: { title: 'One-Hour Full Body Session', categories: [], durationMin: 60 },
  custom: { title: 'Your Personalized Practice', categories: [], durationMin: 20 },
};
