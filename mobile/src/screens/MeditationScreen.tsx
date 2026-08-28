import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, Meditation } from '../api/client';
import { theme } from '../theme';

function formatClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const DURATIONS = [
  { label: '3 min', sec: 180 },
  { label: '5 min', sec: 300 },
  { label: '10 min', sec: 600 },
  { label: '20 min', sec: 1200 },
];

export default function MeditationScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(300);
  const [meditation, setMeditation] = useState<Meditation | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.meditationCategories(token).then((r) => setCategories(r.categories));
  }, []);

  useEffect(() => {
    if (!meditation) return;
    setSecondsLeft(meditation.duration_sec);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [meditation]);

  async function generate() {
    if (!category) return;
    setLoading(true);
    try {
      const res = await api.generateMeditation(token, category, durationSec);
      setMeditation(res.meditation);
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    if (!meditation) return;
    await api.completeMeditation(token, meditation.id);
    onBack();
  }

  if (meditation) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{meditation.category.replace(/_/g, ' ')}</Text>
        <Text style={styles.timer}>{formatClock(secondsLeft)}</Text>
        <Text style={styles.script}>{meditation.script}</Text>
        <Pressable
          style={[styles.primaryButton, secondsLeft > 0 && styles.primaryButtonDisabled]}
          onPress={complete}
          disabled={secondsLeft > 0}
        >
          <Text style={styles.primaryButtonText}>{secondsLeft > 0 ? `${formatClock(secondsLeft)} remaining` : 'Mark complete'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Meditation</Text>

      <Text style={styles.label}>Category</Text>
      <View style={styles.wrap}>
        {categories.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipSelected]} onPress={() => setCategory(c)}>
            <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>{c.replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Duration</Text>
      <View style={styles.wrap}>
        {DURATIONS.map((d) => (
          <Pressable key={d.sec} style={[styles.chip, durationSec === d.sec && styles.chipSelected]} onPress={() => setDurationSec(d.sec)}>
            <Text style={[styles.chipText, durationSec === d.sec && styles.chipTextSelected]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={generate} disabled={!category || loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Begin</Text>}
      </Pressable>

      <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(3), textTransform: 'capitalize' },
  label: { color: theme.colors.textMuted, marginBottom: theme.spacing(1) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1), marginBottom: theme.spacing(3) },
  chip: { paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(1), borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, textTransform: 'capitalize' },
  chipTextSelected: { color: '#fff' },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: 'center', marginBottom: theme.spacing(2) },
  primaryButtonDisabled: { backgroundColor: theme.colors.border },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  link: { color: theme.colors.primary, textAlign: 'center' },
  script: { fontSize: 16, lineHeight: 26, color: theme.colors.text, marginBottom: theme.spacing(3) },
  timer: { fontSize: 40, fontWeight: '200', color: theme.colors.primary, textAlign: 'center', marginBottom: theme.spacing(3) },
});
