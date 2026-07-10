import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ProgressDashboard } from '../api/client';
import { theme } from '../theme';

function scoreLabel(v: string | null) {
  if (v === null || v === undefined) return '—';
  return Math.round(Number(v)).toString();
}

export default function ProgressScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<ProgressDashboard | null>(null);

  useEffect(() => {
    api.progressDashboard(token).then(setData);
  }, []);

  if (!data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const latest = data.days[data.days.length - 1];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Progress</Text>

      <View style={styles.statsRow}>
        <Stat label="Streak" value={`${data.currentStreak}d`} />
        <Stat label="Workout min" value={Math.round(data.totals.workoutMinutes).toString()} />
        <Stat label="Meditation min" value={Math.round(data.totals.meditationMinutes).toString()} />
      </View>

      {latest && (
        <View style={styles.scoresCard}>
          <Text style={styles.cardTitle}>Latest scores</Text>
          <Score label="Flexibility" value={latest.flexibility_score} />
          <Score label="Mobility" value={latest.mobility_score} />
          <Score label="Balance" value={latest.balance_score} />
          <Score label="Strength" value={latest.strength_score} />
          <Score label="Mood" value={latest.mood_score} />
          <Score label="Stress" value={latest.stress_score} />
        </View>
      )}

      {data.days.length === 0 && <Text style={styles.empty}>Complete a session to start building your progress history.</Text>}

      <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Score({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{scoreLabel(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(3) },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing(3) },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: theme.colors.primary },
  statLabel: { fontSize: 12, color: theme.colors.textMuted },
  scoresCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing(2.5), marginBottom: theme.spacing(3) },
  cardTitle: { fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1.5) },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(0.5) },
  scoreLabel: { color: theme.colors.textMuted },
  scoreValue: { color: theme.colors.text, fontWeight: '600' },
  empty: { color: theme.colors.textMuted, marginBottom: theme.spacing(3) },
  link: { color: theme.colors.primary, textAlign: 'center' },
});
