import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import { api, ApiError, MobilityPhoto, MobilityTest, MobilityTestPose, MobilityTestSubmitResult } from '../api/client';
import { theme } from '../theme';

const TREND_LABEL: Record<string, string> = { improved: 'Improved since last time', same: 'Holding steady', regressed: 'Slipped since last time' };

// Two frames per clip -- an early hold and a settled deeper hold -- sent to
// Claude's vision API for a qualitative assessment. Claude analyzes images,
// not raw video, so this is a real, honest "watch the movement" experience
// (the athlete records video) built on a real, honest analysis step (a
// couple of frames pulled from it), not a claim of continuous motion tracking.
const FRAME_TIMES_MS = [1000, 4500];

export default function MobilityTestScreen({
  token, onBack, onFirstComplete, title,
}: {
  token: string;
  onBack: () => void;
  // When provided (the onboarding sequence, or a Monthly Exam retest that
  // should auto-regenerate the plan), a successful submit hands control
  // straight to the caller instead of showing the in-place "Done" result
  // screen -- the caller decides what happens next.
  onFirstComplete?: (result: MobilityTestSubmitResult) => void;
  title?: string;
}) {
  const [poses, setPoses] = useState<MobilityTestPose[] | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [frames, setFrames] = useState<MobilityPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MobilityTestSubmitResult | null>(null);
  const [history, setHistory] = useState<MobilityTest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.mobilityTestPoses(token)
      .then((r) => setPoses(r.poses))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the test.'));
    api.mobilityTests(token).then((r) => setHistory(r.tests)).catch(() => {});
  }, []);

  if (!poses) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const completedPoseKeys = new Set(frames.map((f) => f.poseKey));
  const currentPose = poses[poseIndex];
  const allCaptured = poses.every((p) => completedPoseKeys.has(p.key));

  async function recordCurrentPose() {
    if (!currentPose) return;
    if (Platform.OS === 'web') {
      setError('Video capture works on the mobile app (Expo Go or a device build), not in this web preview.');
      return;
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is needed to record the stretch test.');
      return;
    }

    const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 8 });
    if (picked.canceled || !picked.assets?.[0]) return;

    setProcessing(true);
    setError(null);
    try {
      const videoUri = picked.assets[0].uri;
      const newFrames: MobilityPhoto[] = [];
      for (const time of FRAME_TIMES_MS) {
        const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time, quality: 0.6 });
        const compressed = await ImageManipulator.manipulateAsync(
          thumb.uri,
          [{ resize: { width: 800 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (compressed.base64) newFrames.push({ poseKey: currentPose.key, mediaType: 'image/jpeg', data: compressed.base64 });
      }
      setFrames((prev) => [...prev.filter((f) => f.poseKey !== currentPose.key), ...newFrames]);
      if (poses && poseIndex + 1 < poses.length) setPoseIndex(poseIndex + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that recording.');
    } finally {
      setProcessing(false);
    }
  }

  async function submitTest() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitMobilityTest(token, frames);
      if (onFirstComplete) {
        onFirstComplete(res);
        return;
      }
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('AI mobility analysis isn\'t set up on this server yet.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not analyze your test — try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const { test, yogaLevel } = result;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your mobility assessment</Text>

        {test.level_change && yogaLevel && (
          <View style={[styles.card, styles.levelChangeCard]}>
            <Text style={styles.levelChangeTitle}>
              {test.level_change === 'up' ? '🎉 Leveled up!' : 'Adjusting your level'}
            </Text>
            <Text style={styles.cardTitle}>{yogaLevel.label}</Text>
            <Text style={styles.subtitle}>{yogaLevel.tagline}</Text>
          </View>
        )}

        {test.trend && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{TREND_LABEL[test.trend] || test.trend}</Text>
            {test.progress_note && <Text style={styles.assessmentText}>{test.progress_note}</Text>}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.assessmentText}>{test.assessment}</Text>
        </View>

        {test.scores && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scorecard</Text>
            {Object.entries(test.scores).map(([key, value]) => (
              <View key={key} style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{key.replace(/_/g, ' ')}</Text>
                <View style={styles.scoreBarTrack}>
                  <View style={[styles.scoreBarFill, { width: `${value}%` }]} />
                </View>
                <Text style={styles.scoreValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {test.flagged_limitations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Areas we'll focus on</Text>
            <View style={styles.chipsRow}>
              {test.flagged_limitations.map((tag) => (
                <View key={tag} style={styles.flagChip}>
                  <Text style={styles.flagChipText}>{tag.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.subtitle}>Your next sessions and training plan will automatically lean into these.</Text>
          </View>
        )}
        <Pressable style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!onFirstComplete && <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>}
      <Text style={styles.title}>{title || 'Mobility Test'}</Text>
      <Text style={styles.subtitle}>
        Record a short clip of each stretch. The AI reviews your form and range of motion, then shapes your training around what it finds.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.progressRow}>
        {poses.map((p, i) => (
          <View
            key={p.key}
            style={[styles.progressDot, completedPoseKeys.has(p.key) && styles.progressDotDone, i === poseIndex && !allCaptured && styles.progressDotActive]}
          />
        ))}
      </View>

      {!allCaptured && currentPose && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{currentPose.label}</Text>
          <Text style={styles.subtitle}>{currentPose.instructions}</Text>
          <Pressable style={styles.button} onPress={recordCurrentPose} disabled={processing}>
            {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Record</Text>}
          </Pressable>
        </View>
      )}

      {allCaptured && (
        <Pressable style={styles.button} onPress={submitTest} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get my assessment</Text>}
        </Pressable>
      )}

      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.cardTitle}>Past tests</Text>
          {history.map((t) => (
            <View key={t.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
              <Text style={styles.historyTrend}>{t.trend ? (TREND_LABEL[t.trend] || t.trend) : 'First test'}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  link: { color: theme.colors.primary, fontWeight: '600', marginBottom: theme.spacing(2) },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing(1) },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, marginBottom: theme.spacing(2), lineHeight: 20 },
  error: { color: theme.colors.danger, marginBottom: theme.spacing(2) },
  progressRow: { flexDirection: 'row', gap: theme.spacing(1), marginBottom: theme.spacing(3) },
  progressDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  progressDotActive: { backgroundColor: theme.colors.primaryDark },
  progressDotDone: { backgroundColor: theme.colors.primary },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginBottom: theme.spacing(2.5),
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1) },
  assessmentText: { color: theme.colors.text, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1), marginTop: theme.spacing(1), marginBottom: theme.spacing(1.5) },
  flagChip: { backgroundColor: theme.colors.accent, borderRadius: theme.radius, paddingHorizontal: theme.spacing(1.5), paddingVertical: theme.spacing(0.75) },
  flagChipText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  levelChangeCard: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary },
  levelChangeTitle: { color: theme.colors.primaryDark, fontWeight: '700', fontSize: 15, marginBottom: theme.spacing(0.5) },
  historySection: { marginTop: theme.spacing(1) },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(1),
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  historyDate: { color: theme.colors.textMuted, fontSize: 13 },
  historyTrend: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5), paddingVertical: theme.spacing(0.75) },
  scoreLabel: { color: theme.colors.text, fontSize: 13, textTransform: 'capitalize', width: 130 },
  scoreBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  scoreValue: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600', width: 28, textAlign: 'right' },
});
