import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, RoutineResponse } from '../api/client';
import { theme } from '../theme';

type Phase = 'practicing' | 'feedback' | 'done';

export default function SessionPlayerScreen({
  token, routine, onFinish,
}: {
  token: string;
  routine: RoutineResponse;
  onFinish: () => void;
}) {
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(routine.items[0]?.duration_sec ?? 0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('practicing');
  const [difficulty, setDifficulty] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);
  const [enjoyment, setEnjoyment] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = routine.items[index];

  useEffect(() => {
    api.startSession(token, routine.routine.id).then((r) => setSessionLogId(r.sessionLog.id));
  }, []);

  useEffect(() => {
    if (phase !== 'practicing') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          advance();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index, phase]);

  function advance(skip = false) {
    if (skip && current) setSkipped((prev) => [...prev, current.pose.id]);
    if (index + 1 < routine.items.length) {
      setIndex(index + 1);
      setSecondsLeft(routine.items[index + 1].duration_sec);
    } else {
      setPhase('feedback');
    }
  }

  async function submitFeedback() {
    if (!sessionLogId) return;
    const completionPct = Math.round(((routine.items.length - skipped.length) / routine.items.length) * 100);
    await api.completeSession(token, sessionLogId, {
      completionPct,
      skippedPoseIds: skipped,
      difficultyFeedback: difficulty || undefined,
      enjoymentRating: enjoyment || undefined,
    });
    setPhase('done');
  }

  if (phase === 'feedback') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>How did that feel?</Text>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.row}>
          {(['too_easy', 'just_right', 'too_hard'] as const).map((d) => (
            <Pressable key={d} style={[styles.chip, difficulty === d && styles.chipSelected]} onPress={() => setDifficulty(d)}>
              <Text style={[styles.chipText, difficulty === d && styles.chipTextSelected]}>{d.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Enjoyment</Text>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} style={[styles.chip, enjoyment === n && styles.chipSelected]} onPress={() => setEnjoyment(n)}>
              <Text style={[styles.chipText, enjoyment === n && styles.chipTextSelected]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.primaryButton} onPress={submitFeedback}>
          <Text style={styles.primaryButtonText}>Save & Finish</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Nicely done.</Text>
        <Text style={styles.subtitle}>Your practice is logged and your next session will adapt to how this one felt.</Text>
        <Pressable style={styles.primaryButton} onPress={onFinish}>
          <Text style={styles.primaryButtonText}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.progressText}>{index + 1} / {routine.items.length}</Text>
      <Text style={styles.poseName}>{current.pose.name}</Text>
      <Text style={styles.timer}>{secondsLeft}s</Text>
      {current.pose.breathing_cue && <Text style={styles.cue}>{current.pose.breathing_cue}</Text>}
      {current.pose.benefits?.length > 0 && (
        <Text style={styles.benefits}>Benefits: {current.pose.benefits.join(', ')}</Text>
      )}

      <View style={styles.row}>
        <Pressable style={styles.secondaryButton} onPress={() => advance(true)}>
          <Text style={styles.secondaryButtonText}>Skip</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => advance(false)}>
          <Text style={styles.primaryButtonText}>Next pose</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3), justifyContent: 'center', alignItems: 'center' },
  progressText: { color: theme.colors.textMuted, marginBottom: theme.spacing(2) },
  poseName: { fontSize: 26, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  timer: { fontSize: 48, fontWeight: '200', color: theme.colors.primary, marginVertical: theme.spacing(3) },
  cue: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing(2) },
  benefits: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing(3) },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(3), textAlign: 'center' },
  subtitle: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing(3) },
  label: { color: theme.colors.textMuted, marginBottom: theme.spacing(1), alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: theme.spacing(1.5), marginTop: theme.spacing(2), marginBottom: theme.spacing(3) },
  chip: { paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(1), borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text },
  chipTextSelected: { color: '#fff' },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(3), alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { borderRadius: theme.radius, paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(3), alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  secondaryButtonText: { color: theme.colors.textMuted, fontWeight: '600' },
});
