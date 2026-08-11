const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickScheduledDates, resolveAvailableDays } = require('../src/services/planGenerator');

test('resolveAvailableDays: uses reported available_days when present', () => {
  const days = resolveAvailableDays({ available_days: ['tuesday', 'thursday'], workout_schedule: { daysPerWeek: 5 } });
  assert.deepEqual(days, ['tuesday', 'thursday']);
});

test('resolveAvailableDays: falls back to a spread pattern by days-per-week when unset', () => {
  assert.deepEqual(resolveAvailableDays({ available_days: [], workout_schedule: { daysPerWeek: 3 } }), ['monday', 'wednesday', 'friday']);
  assert.deepEqual(resolveAvailableDays({ available_days: [], workout_schedule: {} }), ['monday', 'wednesday', 'friday']);
});

test('pickScheduledDates: only returns dates matching the available weekdays, within the requested window', () => {
  const profile = { available_days: ['monday'] };
  // 2026-01-05 is a Monday (UTC)
  const dates = pickScheduledDates(profile, new Date('2026-01-01T00:00:00Z'), 14);
  assert.deepEqual(dates, ['2026-01-05', '2026-01-12']);
});

test('pickScheduledDates: returns an empty array over a window with no matching weekday somehow excluded gracefully', () => {
  const profile = { available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] };
  const dates = pickScheduledDates(profile, new Date('2026-01-01T00:00:00Z'), 7);
  assert.equal(dates.length, 7);
});
