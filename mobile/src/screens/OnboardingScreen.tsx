import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError, OnboardingField, YogaLevel } from '../api/client';
import { theme } from '../theme';

const OPEN_ENDED_TYPES = new Set(['single_select', 'multi_select', 'scale']);

function answerHint(question: OnboardingField): string | null {
  if (question.type === 'single_select' || question.type === 'multi_select') {
    return `e.g. ${(question.options || []).slice(0, 4).join(', ')}${(question.options || []).length > 4 ? ', ...' : ''}`;
  }
  if (question.type === 'scale' || question.type === 'number') {
    return question.min !== undefined ? `A number between ${question.min} and ${question.max}` : null;
  }
  return null;
}

export default function OnboardingScreen({ token, onComplete }: { token: string; onComplete: (yogaLevel?: YogaLevel) => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<OnboardingField | null>(null);
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(null);
  const [aiModeEnabled, setAiModeEnabled] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.onboardingStart(token).then((state) => {
      if (state.done) return onComplete(state.yogaLevel);
      setSessionId(state.sessionId);
      setQuestion(state.question || null);
      setProgress(state.progress || null);
      setAiModeEnabled(!!state.aiModeEnabled);
      setLoading(false);
    });
  }, []);

  function resetInputs() {
    setTextValue('');
    setSelected([]);
    setParseError(null);
  }

  async function submitAnswer(value: unknown) {
    if (!sessionId || !question) return;
    setSubmitting(true);
    try {
      const state = await api.onboardingAnswer(token, sessionId, question.key, value);
      resetInputs();
      if (state.done) return onComplete(state.yogaLevel);
      setQuestion(state.question || null);
      setProgress(state.progress || null);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFreeTextAnswer() {
    if (!sessionId || !question || !textValue.trim()) return;
    setSubmitting(true);
    setParseError(null);
    try {
      const state = await api.onboardingAnswerFreeText(token, sessionId, question.key, textValue.trim());
      resetInputs();
      if (state.done) return onComplete(state.yogaLevel);
      setQuestion(state.question || null);
      setProgress(state.progress || null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setParseError("I couldn't quite catch that — could you say it a different way?");
      } else {
        setParseError('Something went wrong — please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !question) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  function toggleOption(opt: string, multi: boolean) {
    if (multi) {
      setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
    } else {
      submitAnswer(opt);
    }
  }

  const progressPct = progress && progress.total > 0 ? Math.min(1, progress.answered / progress.total) : 0;
  const useFreeText = aiModeEnabled && OPEN_ENDED_TYPES.has(question.type);
  const hint = answerHint(question);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {progress && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>Getting to know you — {progress.answered} of ~{progress.total}</Text>
        </View>
      )}
      <Text style={styles.prompt}>{question.prompt}</Text>

      {question.type === 'number' && (
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={textValue}
          onChangeText={setTextValue}
          placeholder={question.min !== undefined ? `${question.min}–${question.max}` : undefined}
        />
      )}

      {question.type === 'text' && (
        <TextInput style={styles.input} value={textValue} onChangeText={setTextValue} multiline />
      )}

      {question.type === 'multi_text' && (
        <TextInput
          style={styles.input}
          value={textValue}
          onChangeText={setTextValue}
          placeholder="Comma-separated, or 'none'"
        />
      )}

      {useFreeText && (
        <>
          <TextInput
            style={styles.input}
            value={textValue}
            onChangeText={setTextValue}
            placeholder="Type your answer in your own words..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
          {hint && <Text style={styles.hint}>{hint}</Text>}
          {parseError && <Text style={styles.parseError}>{parseError}</Text>}
        </>
      )}

      {!useFreeText && question.type === 'scale' && (
        <View style={styles.optionsRow}>
          {Array.from({ length: (question.max ?? 5) - (question.min ?? 0) + 1 }, (_, i) => (question.min ?? 0) + i).map((n) => (
            <Pressable key={n} style={styles.scaleChip} onPress={() => submitAnswer(n)}>
              <Text style={styles.scaleChipText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!useFreeText && (question.type === 'single_select' || question.type === 'multi_select') && (
        <View style={styles.optionsColumn}>
          {(question.options || []).map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <Pressable
                key={opt}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleOption(opt, question.type === 'multi_select')}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {opt.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {useFreeText && (
        <Pressable style={styles.button} disabled={submitting || !textValue.trim()} onPress={submitFreeTextAnswer}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Next</Text>}
        </Pressable>
      )}

      {!useFreeText && (question.type === 'number' || question.type === 'text' || question.type === 'multi_text' || question.type === 'multi_select') && (
        <Pressable
          style={styles.button}
          disabled={submitting}
          onPress={() => {
            if (question.type === 'multi_select') return submitAnswer(selected);
            if (question.type === 'multi_text') return submitAnswer(textValue.split(',').map((s) => s.trim()).filter(Boolean));
            if (question.type === 'number') return submitAnswer(Number(textValue));
            return submitAnswer(textValue);
          }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Next</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3), justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  progressWrap: { marginBottom: theme.spacing(3) },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  progressLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing(0.75) },
  prompt: { fontSize: 20, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(3) },
  input: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius, padding: theme.spacing(2), fontSize: 16, marginBottom: theme.spacing(2),
  },
  hint: { color: theme.colors.textMuted, fontSize: 12, marginTop: -theme.spacing(1), marginBottom: theme.spacing(2) },
  parseError: { color: theme.colors.danger, fontSize: 13, marginBottom: theme.spacing(2) },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1), marginBottom: theme.spacing(2) },
  optionsColumn: { gap: theme.spacing(1), marginBottom: theme.spacing(2) },
  scaleChip: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface,
  },
  scaleChipText: { color: theme.colors.text, fontWeight: '600' },
  option: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
    padding: theme.spacing(1.5), backgroundColor: theme.colors.surface,
  },
  optionSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  optionText: { color: theme.colors.text, fontSize: 15, textTransform: 'capitalize' },
  optionTextSelected: { color: '#fff' },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
