import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api, RoutineResponse, YogaLevel } from '../api/client';
import { theme } from '../theme';

const LEVEL_EMOJI: Record<string, string> = {
  rooted_beginner: '🌱',
  growing_practice: '🌿',
  confident_flow: '🌊',
  deep_practice: '🔥',
};

export default function OnboardingResultScreen({
  token, yogaLevel, onStartClass, onSkip,
}: {
  token: string;
  yogaLevel: YogaLevel;
  onStartClass: (routine: RoutineResponse) => void;
  onSkip: () => void;
}) {
  const [routine, setRoutine] = useState<RoutineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    api.generateRoutine(token, 'custom')
      .then(setRoutine)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not build your first class.'));
  }, []);

  function toggleReminders(value: boolean) {
    setRemindersEnabled(value);
    api.setReminderPreference(token, value).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.emoji}>{LEVEL_EMOJI[yogaLevel.level] || '🧘'}</Text>
      <Text style={styles.eyebrow}>Your practice level</Text>
      <Text style={styles.level}>{yogaLevel.label}</Text>
      <Text style={styles.tagline}>{yogaLevel.tagline}</Text>
      {yogaLevel.cautious && (
        <Text style={styles.caution}>We're starting gentle based on what you told us about pain or injuries.</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your first class</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {!routine && !error && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Building it now...</Text>
          </View>
        )}
        {routine && (
          <>
            <Text style={styles.routineTitle}>{routine.routine.title}</Text>
            <Text style={styles.routineMeta}>
              {Math.round(routine.routine.total_duration_sec / 60)} min · {routine.items.length} poses
            </Text>
          </>
        )}
      </View>

      <View style={styles.reminderRow}>
        <View style={styles.reminderText}>
          <Text style={styles.reminderTitle}>Keep me consistent</Text>
          <Text style={styles.reminderSubtitle}>Nudge me around my preferred practice time.</Text>
        </View>
        <Switch
          value={remindersEnabled}
          onValueChange={toggleReminders}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        />
      </View>

      <Pressable
        style={[styles.button, !routine && styles.buttonDisabled]}
        disabled={!routine}
        onPress={() => routine && onStartClass(routine)}
      >
        <Text style={styles.buttonText}>Start my first class</Text>
      </Pressable>
      <Pressable onPress={onSkip}><Text style={styles.skipLink}>Maybe later</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3), alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, marginBottom: theme.spacing(1) },
  eyebrow: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  level: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing(0.5), textAlign: 'center' },
  tagline: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(1), maxWidth: 320 },
  caution: { fontSize: 13, color: theme.colors.primaryDark, textAlign: 'center', marginTop: theme.spacing(1.5), maxWidth: 320 },
  card: {
    width: '100%', backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginTop: theme.spacing(3),
  },
  cardTitle: { fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1) },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  loadingText: { color: theme.colors.textMuted },
  routineTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  routineMeta: { color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },
  error: { color: theme.colors.danger },
  reminderRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: theme.spacing(3), padding: theme.spacing(2), backgroundColor: theme.colors.surface,
    borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
  },
  reminderText: { flex: 1, marginRight: theme.spacing(2) },
  reminderTitle: { fontWeight: '600', color: theme.colors.text },
  reminderSubtitle: { color: theme.colors.textMuted, fontSize: 13, marginTop: theme.spacing(0.25) },
  button: {
    width: '100%', backgroundColor: theme.colors.primary, borderRadius: theme.radius,
    padding: theme.spacing(2), alignItems: 'center', marginTop: theme.spacing(3),
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipLink: { color: theme.colors.textMuted, marginTop: theme.spacing(2), textAlign: 'center' },
});
