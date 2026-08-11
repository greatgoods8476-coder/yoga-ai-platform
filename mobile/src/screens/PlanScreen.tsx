import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, RoutineResponse, TrainingPlan, TrainingPlanDay } from '../api/client';
import { theme } from '../theme';

const SORENESS_AREAS = ['back', 'neck', 'hip', 'knee', 'shoulder', 'hamstring'];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function PlanScreen({
  token, onStartDay, onBack,
}: {
  token: string;
  onStartDay: (dayId: string, routine: RoutineResponse) => void;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [days, setDays] = useState<TrainingPlanDay[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [startingDayId, setStartingDayId] = useState<string | null>(null);
  const [soreness, setSoreness] = useState<Record<string, number>>({});
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    return api.currentPlan(token).then((r) => {
      setPlan(r.plan);
      setDays(r.days);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function generatePlan() {
    setGenerating(true);
    setError(null);
    try {
      await api.generatePlan(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate your plan.');
    } finally {
      setGenerating(false);
    }
  }

  async function startDay(day: TrainingPlanDay) {
    setStartingDayId(day.id);
    setError(null);
    try {
      const routine = await api.generatePlanDayRoutine(token, day.id);
      onStartDay(day.id, routine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build today\'s session.');
    } finally {
      setStartingDayId(null);
    }
  }

  async function submitCheckin() {
    try {
      await api.submitCheckin(token, soreness);
      setCheckinSaved(true);
      setSoreness({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your check-in.');
    }
  }

  if (!days) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
      <Text style={styles.title}>Your Training Plan</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {!plan ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No active plan yet</Text>
          <Text style={styles.subtitle}>
            Generate a month of sessions scheduled around the days you told us you're actually available.
          </Text>
          <Pressable style={styles.button} onPress={generatePlan} disabled={generating}>
            {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate my plan</Text>}
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Daily check-in</Text>
            <Text style={styles.subtitle}>Anything sore today? We'll steer today's poses around it.</Text>
            <View style={styles.chipsRow}>
              {SORENESS_AREAS.map((area) => (
                <Pressable
                  key={area}
                  style={[styles.chip, !!soreness[area] && styles.chipSelected]}
                  onPress={() => setSoreness((prev) => {
                    const next = { ...prev };
                    if (next[area]) delete next[area]; else next[area] = 3;
                    return next;
                  })}
                >
                  <Text style={[styles.chipText, !!soreness[area] && styles.chipTextSelected]}>{area}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.secondaryButton} onPress={submitCheckin}>
              <Text style={styles.secondaryButtonText}>{checkinSaved ? 'Saved ✓' : 'Save check-in'}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{plan.start_date} – {plan.end_date}</Text>
            {days.map((day) => (
              <View key={day.id} style={[styles.dayRow, day.scheduled_date === today && styles.dayRowToday]}>
                <View>
                  <Text style={styles.dayDate}>{formatDate(day.scheduled_date)}</Text>
                  <Text style={styles.dayStatus}>{day.status === 'completed' ? 'Completed' : day.routine_id ? 'Ready' : 'Not generated yet'}</Text>
                </View>
                {day.status !== 'completed' && (
                  <Pressable style={styles.startButton} onPress={() => startDay(day)} disabled={startingDayId === day.id}>
                    {startingDayId === day.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.startButtonText}>Start</Text>
                    )}
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          <Pressable style={styles.secondaryButton} onPress={generatePlan} disabled={generating}>
            {generating ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.secondaryButtonText}>Regenerate plan</Text>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  link: { color: theme.colors.primary, fontWeight: '600', marginBottom: theme.spacing(2) },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing(3) },
  error: { color: theme.colors.danger, marginBottom: theme.spacing(2) },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginBottom: theme.spacing(2.5),
  },
  cardTitle: { fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1) },
  subtitle: { color: theme.colors.textMuted, fontSize: 13, marginBottom: theme.spacing(2) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  secondaryButtonText: { color: theme.colors.primary, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1), marginBottom: theme.spacing(2) },
  chip: { paddingHorizontal: theme.spacing(1.5), paddingVertical: theme.spacing(0.75), borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  chipSelected: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  chipText: { color: theme.colors.text, textTransform: 'capitalize', fontSize: 13 },
  chipTextSelected: { color: '#fff' },
  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: theme.spacing(1.5), borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  dayRowToday: { backgroundColor: theme.colors.accent, marginHorizontal: -theme.spacing(1), paddingHorizontal: theme.spacing(1), borderRadius: 8 },
  dayDate: { color: theme.colors.text, fontWeight: '600' },
  dayStatus: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing(0.25) },
  startButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(1) },
  startButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
