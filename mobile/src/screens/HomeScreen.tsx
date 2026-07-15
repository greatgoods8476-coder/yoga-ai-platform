import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, NotificationSuggestion, RoutineResponse } from '../api/client';
import { theme } from '../theme';

const ROUTINE_TYPES: { key: string; label: string }[] = [
  { key: 'morning_mobility', label: 'Morning Mobility' },
  { key: 'evening_relaxation', label: 'Evening Relaxation' },
  { key: 'office_stretching', label: 'Office Stretching' },
  { key: 'stress_relief', label: 'Stress Relief' },
  { key: 'hip_mobility', label: 'Hip Mobility' },
  { key: 'hamstring_flexibility', label: 'Hamstring Flexibility' },
  { key: 'balance_training', label: 'Balance Training' },
  { key: 'sleep_preparation', label: 'Sleep Preparation' },
  { key: 'five_minute_stretch', label: 'Five-Minute Stretch' },
  { key: 'custom', label: 'Personalized For Me' },
];

export default function HomeScreen({
  token, onStartSession, onNavigate, onLogout,
}: {
  token: string;
  onStartSession: (routine: RoutineResponse) => void;
  onNavigate: (screen: 'progress' | 'meditation' | 'social') => void;
  onLogout: () => void;
}) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<NotificationSuggestion | null>(null);

  useEffect(() => {
    api.notificationSuggestions(token).then((r) => setSuggestion(r.suggestions[0] || null)).catch(() => {});
  }, []);

  async function pick(routineType: string) {
    setGenerating(routineType);
    setError(null);
    try {
      const routine = await api.generateRoutine(token, routineType);
      onStartSession(routine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a routine.');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What would you like to practice?</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {suggestion && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{suggestion.message}</Text>
        </View>
      )}

      <View style={styles.grid}>
        {ROUTINE_TYPES.map((rt) => (
          <Pressable key={rt.key} style={styles.card} onPress={() => pick(rt.key)} disabled={!!generating}>
            {generating === rt.key ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={styles.cardText}>{rt.label}</Text>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.footerLinks}>
        <Pressable onPress={() => onNavigate('meditation')}><Text style={styles.link}>Meditation</Text></Pressable>
        <Pressable onPress={() => onNavigate('progress')}><Text style={styles.link}>Progress</Text></Pressable>
        <Pressable onPress={() => onNavigate('social')}><Text style={styles.link}>Friends</Text></Pressable>
        <Pressable onPress={onLogout}><Text style={styles.link}>Log out</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(3) },
  banner: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius,
    padding: theme.spacing(2), marginBottom: theme.spacing(3),
  },
  bannerText: { color: theme.colors.primaryDark, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5) },
  card: {
    width: '47%', backgroundColor: theme.colors.surface, borderRadius: theme.radius,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing(2.5),
    alignItems: 'center', justifyContent: 'center', minHeight: 84,
  },
  cardText: { color: theme.colors.text, fontWeight: '600', textAlign: 'center' },
  footerLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing(4) },
  link: { color: theme.colors.primary, fontWeight: '600' },
  error: { color: theme.colors.danger, marginBottom: theme.spacing(2) },
});
