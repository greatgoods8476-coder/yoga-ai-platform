import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TrainingPlanDay } from '../api/client';
import { theme } from '../theme';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Renders the plan's actual date range as real weekday-aligned calendar
// rows (Sun-Sat), not a single named month -- a ~30-day rolling plan
// usually spans parts of two calendar months, so forcing it into one
// month's grid would misrepresent the dates.
export default function PlanCalendar({
  days, onSelectDay,
}: {
  days: TrainingPlanDay[];
  onSelectDay: (day: TrainingPlanDay) => void;
}) {
  if (days.length === 0) return null;

  const byDate = new Map(days.map((d) => [d.scheduled_date, d]));
  const first = toDate(days[0].scheduled_date);
  const last = toDate(days[days.length - 1].scheduled_date);

  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(last);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const today = isoDate(new Date());

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((date) => {
            const dateStr = isoDate(date);
            const day = byDate.get(dateStr);
            const isToday = dateStr === today;
            const isCompleted = day?.status === 'completed';
            return (
              <Pressable
                key={dateStr}
                style={[
                  styles.cell,
                  !!day && styles.cellScheduled,
                  isCompleted && styles.cellCompleted,
                  isToday && styles.cellToday,
                ]}
                onPress={() => day && onSelectDay(day)}
                disabled={!day}
              >
                <Text style={[styles.cellText, !!day && styles.cellTextScheduled, isCompleted && styles.cellTextCompleted]}>
                  {date.getUTCDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  weekdayRow: { flexDirection: 'row', marginBottom: theme.spacing(0.5) },
  weekdayLabel: { flex: 1, textAlign: 'center', color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  weekRow: { flexDirection: 'row', marginBottom: theme.spacing(0.5) },
  cell: {
    flex: 1, aspectRatio: 1, marginHorizontal: 1, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
  },
  cellScheduled: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  cellCompleted: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  cellToday: { borderColor: theme.colors.primaryDark, borderWidth: 2 },
  cellText: { color: theme.colors.textMuted, fontSize: 13 },
  cellTextScheduled: { color: theme.colors.text, fontWeight: '600' },
  cellTextCompleted: { color: '#fff' },
});
