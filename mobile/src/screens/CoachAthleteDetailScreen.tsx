import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, AthleteDetail } from '../api/client';
import { theme } from '../theme';

const LEVEL_LABELS: Record<string, string> = {
  rooted_beginner: 'Rooted Beginner',
  growing_practice: 'Growing Practice',
  confident_flow: 'Confident Flow',
  deep_practice: 'Deep Practice',
};

export default function CoachAthleteDetailScreen({
  token, orgId, userId, onBack,
}: {
  token: string;
  orgId: string;
  userId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<AthleteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.athleteDetail(token, orgId, userId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this athlete.'));
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const { profile, latestRoutine, latestMobilityTest, mobilityTestHistory, recentCheckins, planAdherence } = detail;
  const painEntries = Object.entries(profile.joint_pain || {}).filter(([, v]) => v > 0);
  const scoreEntries = Object.entries(latestMobilityTest?.scores || {}) as [string, number][];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}><Text style={styles.link}>Back to roster</Text></Pressable>

      <Text style={styles.name}>{profile.display_name || profile.email}</Text>
      <Text style={styles.meta}>
        {profile.sport || '—'}{profile.athletic_position ? ` · ${profile.athletic_position}` : ''}
        {profile.season_phase ? ` · ${profile.season_phase.replace('_', ' ')}` : ''}
      </Text>
      {profile.yoga_level && (
        <Text style={styles.level}>{LEVEL_LABELS[profile.yoga_level] || profile.yoga_level}</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Questionnaire results</Text>
        <Row label="Fitness level" value={profile.fitness_level} />
        <Row label="Yoga experience" value={profile.yoga_experience} />
        <Row label="Flexibility" value={profile.current_flexibility} />
        <Row label="Mobility" value={profile.current_mobility} />
        <Row label="Training goal" value={profile.primary_athletic_goal?.replace(/_/g, ' ')} />
        <Row label="Goals" value={(profile.goals || []).join(', ')} />
        {profile.current_injuries && profile.current_injuries.filter((i) => i !== 'none').length > 0 && (
          <Row label="Current injuries" value={profile.current_injuries.join(', ')} danger />
        )}
        {painEntries.length > 0 && (
          <Row label="Reported pain" value={painEntries.map(([k, v]) => `${k}: ${v}/5`).join(', ')} danger />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobility test</Text>
        {!latestMobilityTest ? (
          <Text style={styles.empty}>No mobility test yet.</Text>
        ) : (
          <>
            {latestMobilityTest.trend && (
              <Text style={[styles.trendText, latestMobilityTest.trend === 'regressed' && styles.trendTextDown]}>
                {latestMobilityTest.trend === 'improved' ? '↑ Improved since last test'
                  : latestMobilityTest.trend === 'regressed' ? '↓ Regressed since last test'
                  : '→ Holding steady'}
              </Text>
            )}
            <Text style={styles.assessmentText}>{latestMobilityTest.assessment}</Text>
            {latestMobilityTest.flagged_limitations.length > 0 && (
              <Text style={styles.meta}>Flagged: {latestMobilityTest.flagged_limitations.join(', ').replace(/_/g, ' ')}</Text>
            )}
            <Text style={styles.testDate}>{new Date(latestMobilityTest.created_at).toLocaleDateString()}</Text>

            {scoreEntries.length > 0 && (
              <View style={styles.scoresBlock}>
                {scoreEntries.map(([key, value]) => (
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

            {mobilityTestHistory.length > 1 && (
              <View style={styles.historyBlock}>
                <Text style={styles.miniHeading}>Test history</Text>
                {mobilityTestHistory.map((t) => (
                  <View key={t.id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
                    <Text style={styles.historyTrend}>
                      {t.trend === 'improved' ? '↑ improved' : t.trend === 'regressed' ? '↓ regressed' : t.trend === 'same' ? '→ steady' : 'baseline'}
                      {t.flagged_limitations.length > 0 ? ` · ${t.flagged_limitations.length} flagged` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan adherence</Text>
        {!planAdherence ? (
          <Text style={styles.empty}>No training plan generated yet.</Text>
        ) : (
          <>
            <Text style={styles.assessmentText}>
              {planAdherence.completedDays} / {planAdherence.totalDays} scheduled sessions completed this month
            </Text>
            <View style={styles.scoreBarTrack}>
              <View
                style={[
                  styles.scoreBarFill,
                  { width: `${planAdherence.totalDays > 0 ? Math.round((planAdherence.completedDays / planAdherence.totalDays) * 100) : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.meta}>{planAdherence.startDate} – {planAdherence.endDate} · {planAdherence.status}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent check-ins</Text>
        {recentCheckins.length === 0 ? (
          <Text style={styles.empty}>No check-ins yet.</Text>
        ) : (
          recentCheckins.map((c) => (
            <View key={c.checkin_date} style={styles.historyRow}>
              <Text style={styles.historyDate}>{new Date(`${c.checkin_date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC' })}</Text>
              <Text style={styles.checkinNotes}>{c.notes || 'nothing sore reported'}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Latest AI-generated training</Text>
        {!latestRoutine ? (
          <Text style={styles.empty}>No training generated yet.</Text>
        ) : (
          <>
            <Text style={styles.routineTitle}>{latestRoutine.routine.title}</Text>
            <Text style={styles.meta}>{Math.round(latestRoutine.routine.total_duration_sec / 60)} min · {latestRoutine.items.length} poses</Text>
            {latestRoutine.items.map((item) => (
              <View key={item.id} style={styles.poseRow}>
                <Text style={styles.poseName}>{item.sequence_index + 1}. {item.pose.name}</Text>
                <Text style={styles.poseMeta}>{Math.round(item.duration_sec)}s</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Row({ label, value, danger }: { label: string; value?: string | null; danger?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, danger && styles.rowValueDanger]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, gap: theme.spacing(2) },
  link: { color: theme.colors.primary, fontWeight: '600', marginBottom: theme.spacing(2) },
  name: { fontSize: 24, fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, marginTop: theme.spacing(0.5), textTransform: 'capitalize' },
  level: { color: theme.colors.primary, fontWeight: '600', marginTop: theme.spacing(0.5) },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginTop: theme.spacing(3),
  },
  cardTitle: { fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1.5) },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(0.75) },
  rowLabel: { color: theme.colors.textMuted },
  rowValue: { color: theme.colors.text, fontWeight: '600', textTransform: 'capitalize', maxWidth: '60%', textAlign: 'right' },
  rowValueDanger: { color: theme.colors.danger },
  routineTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  poseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(0.75), borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: theme.spacing(1) },
  poseName: { color: theme.colors.text, flex: 1 },
  poseMeta: { color: theme.colors.textMuted },
  empty: { color: theme.colors.textMuted },
  error: { color: theme.colors.danger, textAlign: 'center' },
  trendText: { color: theme.colors.primary, fontWeight: '600', marginBottom: theme.spacing(1) },
  trendTextDown: { color: theme.colors.danger },
  assessmentText: { color: theme.colors.text, lineHeight: 20 },
  testDate: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing(1) },
  scoresBlock: { marginTop: theme.spacing(2), borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing(1.5) },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5), paddingVertical: theme.spacing(0.5) },
  scoreLabel: { color: theme.colors.text, fontSize: 12, textTransform: 'capitalize', width: 110 },
  scoreBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden', marginVertical: theme.spacing(1) },
  scoreBarFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  scoreValue: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', width: 24, textAlign: 'right' },
  historyBlock: { marginTop: theme.spacing(2), borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing(1.5) },
  miniHeading: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: theme.spacing(0.5) },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing(0.5) },
  historyDate: { color: theme.colors.textMuted, fontSize: 12 },
  historyTrend: { color: theme.colors.text, fontSize: 12, textTransform: 'capitalize' },
  checkinNotes: { color: theme.colors.text, fontSize: 12, flex: 1, textAlign: 'right', marginLeft: theme.spacing(2) },
});
