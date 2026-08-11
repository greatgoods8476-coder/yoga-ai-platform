// Picks which calendar dates a monthly training plan lands on. Uses the
// athlete's actual reported available days (onboarding's `available_days`)
// so the plan is genuinely built around their real schedule, not a guessed
// pattern -- falling back to an even Mon/Wed/Fri-style spread of
// workout_days_per_week only for older profiles that never answered the
// available_days question.

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const FALLBACK_PATTERNS = {
  1: ['monday'],
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  7: WEEKDAY_NAMES,
};

function resolveAvailableDays(profile) {
  const reported = (profile.available_days || []).filter((d) => WEEKDAY_NAMES.includes(d));
  if (reported.length > 0) return reported;

  const perWeek = Math.min(7, Math.max(1, profile.workout_schedule?.daysPerWeek || 3));
  return FALLBACK_PATTERNS[perWeek] || FALLBACK_PATTERNS[3];
}

// Returns an array of 'YYYY-MM-DD' date strings, one for each day in
// [startDate, startDate + totalDays) that falls on an available weekday.
function pickScheduledDates(profile, startDate, totalDays = 30) {
  const daySet = new Set(resolveAvailableDays(profile));
  const dates = [];

  for (let i = 0; i < totalDays; i += 1) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    if (daySet.has(WEEKDAY_NAMES[d.getUTCDay()])) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

module.exports = { pickScheduledDates, resolveAvailableDays, WEEKDAY_NAMES };
