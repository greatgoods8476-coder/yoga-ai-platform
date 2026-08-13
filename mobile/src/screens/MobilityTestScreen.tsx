import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import { api, ApiError, MobilityPhoto, MobilityTest, MobilityTestPose } from '../api/client';
import { theme } from '../theme';

// Two frames per clip -- an early hold and a settled deeper hold -- sent to
// Claude's vision API for a qualitative assessment. Claude analyzes images,
// not raw video, so this is a real, honest "watch the movement" experience
// (the athlete records video) built on a real, honest analysis step (a
// couple of frames pulled from it), not a claim of continuous motion tracking.
const FRAME_TIMES_MS = [1000, 4500];

export default function MobilityTestScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [poses, setPoses] = useState<MobilityTestPose[] | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [frames, setFrames] = useState<MobilityPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MobilityTest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.mobilityTestPoses(token)
      .then((r) => setPoses(r.poses))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the test.'));
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
      setResult(res.test);
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
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your mobility assessment</Text>
        <View style={styles.card}>
          <Text style={styles.assessmentText}>{result.assessment}</Text>
        </View>
        {result.flagged_limitations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Areas we'll focus on</Text>
            <View style={styles.chipsRow}>
              {result.flagged_limitations.map((tag) => (
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
      <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
      <Text style={styles.title}>Mobility Test</Text>
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
});
