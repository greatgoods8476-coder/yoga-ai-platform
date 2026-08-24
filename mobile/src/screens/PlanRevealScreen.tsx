import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, TrainingPlan, TrainingPlanDay } from '../api/client';
import PlanCalendar from '../components/PlanCalendar';
import { theme } from '../theme';

function noop() {}

export default function PlanRevealScreen({
  token, onContinue, onCustomizeAvatar, showAvatarSetup = true,
}: {
  token: string;
  onContinue: () => void;
  onCustomizeAvatar: () => void;
  // Off for a Monthly Exam re-reveal -- the athlete already has a coach
  // avatar by then, so there's nothing to set up, just the updated plan.
  showAvatarSetup?: boolean;
}) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [days, setDays] = useState<TrainingPlanDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.generatePlan(token)
      .then((r) => {
        setPlan(r.plan);
        setDays(r.days);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not generate your plan.'));
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>Continue anyway</Text>
        </Pressable>
      </View>
    );
  }

  if (!days) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Building your first month...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Month, Mapped Out</Text>
      <Text style={styles.subtitle}>
        {days.length} sessions scheduled on the days you told us work for you
        {plan ? ` — ${plan.start_date} through ${plan.end_date}.` : '.'}
      </Text>

      <View style={styles.card}>
        <PlanCalendar days={days} onSelectDay={noop} />
      </View>

      {showAvatarSetup ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set up your coach</Text>
            <Text style={styles.subtitle}>Customize your AI coach's look, or we'll set up a default one for you.</Text>
            <Pressable style={styles.button} onPress={onCustomizeAvatar}>
              <Text style={styles.buttonText}>Customize my coach</Text>
            </Pressable>
          </View>

          <Pressable style={styles.secondaryButton} onPress={onContinue}>
            <Text style={styles.secondaryButtonText}>Continue with a default coach</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, gap: theme.spacing(2) },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing(1), textAlign: 'center' },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, marginBottom: theme.spacing(2), lineHeight: 20 },
  loadingText: { color: theme.colors.textMuted },
  error: { color: theme.colors.danger, textAlign: 'center' },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginBottom: theme.spacing(2.5),
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  secondaryButtonText: { color: theme.colors.primary, fontWeight: '600' },
});
