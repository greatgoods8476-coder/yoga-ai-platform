// Computes contextual "smart notification" suggestions from a user's real
// state (streak, recent feedback, stress level, goals) rather than a fixed
// schedule. This is the logic layer only — actual push delivery needs a
// device-token pipeline (APNs/FCM) that isn't part of this build; these
// suggestions are meant to be shown in-app (e.g. a home screen banner) and
// are a straightforward source for push copy once that pipeline exists.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(date, now) {
  if (!date) return Infinity;
  return Math.floor((now - new Date(date).getTime()) / MS_PER_DAY);
}

function isSameDay(date, now) {
  if (!date) return false;
  const d = new Date(date);
  return d.getUTCFullYear() === now.getUTCFullYear()
    && d.getUTCMonth() === now.getUTCMonth()
    && d.getUTCDate() === now.getUTCDate();
}

// lastSession/lastMeditation: most recent row (or null). currentStreak: number.
// hasEverPracticed: whether any session_log exists at all, ever.
function computeSuggestions({ profile, lastSession, lastMeditation, currentStreak = 0, hasEverPracticed, now = new Date() }) {
  const suggestions = [];

  if (!hasEverPracticed) {
    suggestions.push({
      id: 'first_timer',
      type: 'onboarding',
      priority: 3,
      message: "Ready for your first session? Let's start with something gentle.",
    });
    return suggestions;
  }

  const practicedToday = lastSession && isSameDay(lastSession.completed_at, now);
  const meditatedToday = lastMeditation && isSameDay(lastMeditation.created_at, now);

  if (currentStreak >= 2 && !practicedToday) {
    suggestions.push({
      id: 'streak_at_risk',
      type: 'streak',
      priority: 3,
      message: `Keep your ${currentStreak}-day streak going — a quick session today keeps it alive.`,
    });
  }

  const daysSinceLastSession = daysSince(lastSession?.completed_at, now);
  if (daysSinceLastSession >= 3 && daysSinceLastSession < Infinity) {
    suggestions.push({
      id: 'gentle_restart',
      type: 're_engagement',
      priority: 2,
      message: "It's been a few days — how about a gentle session to ease back in?",
    });
  }

  if (lastSession?.difficulty_feedback === 'too_hard' && daysSinceLastSession === 0) {
    suggestions.push({
      id: 'recovery_day',
      type: 'recovery',
      priority: 2,
      message: 'Yesterday looked tough. A recovery-focused session today might feel better than pushing again.',
    });
  }

  if ((profile.stress_level || 0) >= 7 && !meditatedToday) {
    suggestions.push({
      id: 'stress_relief',
      type: 'meditation',
      priority: 3,
      message: 'Your stress appears elevated. How about a ten-minute meditation?',
    });
  }

  const isEvening = now.getUTCHours() >= 20 || now.getUTCHours() < 2;
  if (isEvening && (profile.goals || []).includes('sleep') && !meditatedToday && !practicedToday) {
    suggestions.push({
      id: 'sleep_wind_down',
      type: 'sleep',
      priority: 2,
      message: 'Winding down for the night? A short sleep-prep session or meditation could help.',
    });
  }

  if (!practicedToday && suggestions.length === 0) {
    suggestions.push({
      id: 'daily_nudge',
      type: 'general',
      priority: 1,
      message: "Time to stretch — even five minutes keeps things moving.",
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

module.exports = { computeSuggestions };
