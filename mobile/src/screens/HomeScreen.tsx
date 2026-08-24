import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, NotificationSuggestion, RoutineResponse, TrainingPlan, TrainingPlanDay } from '../api/client';
import { theme } from '../theme';

export default function HomeScreen({
  token, onStartSession, onStartPlanDay, onMonthlyExam, onNavigate, onLogout,
}: {
  token: string;
  onStartSession: (routine: RoutineResponse) => void;
  onStartPlanDay: (dayId: string, routine: RoutineResponse) => void;
  onMonthlyExam: () => void;
  onNavigate: (screen: 'progress' | 'meditation' | 'social' | 'avatar' | 'plan') => void;
  onLogout: () => void;
}) {
  const [generating, setGenerating] = useState<'scheduled' | 'custom' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<NotificationSuggestion | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [todayDay, setTodayDay] = useState<TrainingPlanDay | null>(null);

  useEffect(() => {
    api.notificationSuggestions(token).then((r) => setSuggestion(r.suggestions[0] || null)).catch(() => {});
    api.currentPlan(token).then((r) => {
      setPlan(r.plan);
      const today = new Date().toISOString().slice(0, 10);
      setTodayDay(r.days.find((d) => d.scheduled_date === today) || null);
    }).catch(() => {});
  }, []);

  async function startScheduled() {
    if (!todayDay) return;
    setGenerating('scheduled');
    setError(null);
    try {
      const routine = await api.generatePlanDayRoutine(token, todayDay.id);
      onStartPlanDay(todayDay.id, routine);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build today's session.");
    } finally {
      setGenerating(null);
    }
  }

  async function startCustom() {
    setGenerating('custom');
    setError(null);
    try {
      const routine = await api.generateRoutine(token, 'custom');
      onStartSession(routine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a routine.');
    } finally {
      setGenerating(null);
    }
  }

  const examDue = !!plan && new Date().toISOString().slice(0, 10) >= plan.end_date;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What would you like to practice?</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {suggestion && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{suggestion.message}</Text>
        </View>
      )}

      <Pressable style={[styles.card, !todayDay && styles.cardMuted]} onPress={startScheduled} disabled={!todayDay || !!generating}>
        {generating === 'scheduled' ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Text style={styles.cardText}>Scheduled Stretch</Text>
            <Text style={styles.cardSubtext}>{todayDay ? "Today's planned session" : 'No session scheduled today'}</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.card} onPress={startCustom} disabled={!!generating}>
        {generating === 'custom' ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Text style={styles.cardText}>Custom Stretch</Text>
            <Text style={styles.cardSubtext}>A fresh personalized session, right now</Text>
          </>
        )}
      </Pressable>

      {examDue && (
        <Pressable style={[styles.card, styles.examCard]} onPress={onMonthlyExam}>
          <Text style={[styles.cardText, styles.examCardText]}>Monthly Exam</Text>
          <Text style={[styles.cardSubtext, styles.examCardSubtext]}>Retest your mobility and get next month's plan</Text>
        </Pressable>
      )}

      <View style={styles.footerLinks}>
        <Pressable onPress={() => onNavigate('plan')}><Text style={styles.link}>My Plan</Text></Pressable>
        <Pressable onPress={() => onNavigate('meditation')}><Text style={styles.link}>Meditation</Text></Pressable>
        <Pressable onPress={() => onNavigate('progress')}><Text style={styles.link}>Progress</Text></Pressable>
        <Pressable onPress={() => onNavigate('social')}><Text style={styles.link}>Friends</Text></Pressable>
        <Pressable onPress={() => onNavigate('avatar')}><Text style={styles.link}>My Coach</Text></Pressable>
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
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing(3),
    alignItems: 'center', justifyContent: 'center', minHeight: 96, marginBottom: theme.spacing(2),
  },
  cardMuted: { opacity: 0.6 },
  cardText: { color: theme.colors.text, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  cardSubtext: { color: theme.colors.textMuted, fontSize: 13, marginTop: theme.spacing(0.5), textAlign: 'center' },
  examCard: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary },
  examCardText: { color: theme.colors.primaryDark },
  examCardSubtext: { color: theme.colors.primaryDark },
  footerLinks: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: theme.spacing(2.5), marginTop: theme.spacing(4), paddingBottom: theme.spacing(2),
  },
  link: { color: theme.colors.primary, fontWeight: '600' },
  error: { color: theme.colors.danger, marginBottom: theme.spacing(2) },
});
