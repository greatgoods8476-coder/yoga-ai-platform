import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, OrgMembership, RosterAthlete } from '../api/client';
import { theme } from '../theme';

const LEVEL_LABELS: Record<string, string> = {
  rooted_beginner: 'Rooted Beginner',
  growing_practice: 'Growing Practice',
  confident_flow: 'Confident Flow',
  deep_practice: 'Deep Practice',
};

const GOAL_LABELS: Record<string, string> = {
  build_strength: 'Build Strength',
  explosiveness: 'Explosiveness',
  injury_prevention: 'Injury Prevention',
  inseason_recovery: 'In-Season Recovery',
  mobility_for_sport: 'Sport Mobility',
};

export default function CoachDashboardScreen({
  token, onSelectAthlete, onLogout,
}: {
  token: string;
  onSelectAthlete: (orgId: string, userId: string) => void;
  onLogout: () => void;
}) {
  const [org, setOrg] = useState<OrgMembership | null>(null);
  const [roster, setRoster] = useState<RosterAthlete[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myOrgs(token)
      .then((r) => {
        const coachOrg = r.organizations.find((o) => o.role === 'coach') || null;
        setOrg(coachOrg);
        if (!coachOrg) return { roster: [] };
        return api.roster(token, coachOrg.id);
      })
      .then((r) => setRoster('roster' in r ? r.roster : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your roster.'));
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!roster) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{org?.name || 'Your Roster'}</Text>
          <Text style={styles.subtitle}>{roster.length} athlete{roster.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={onLogout}><Text style={styles.link}>Log out</Text></Pressable>
      </View>

      <FlatList
        data={roster}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => org && onSelectAthlete(org.id, item.user_id)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.name}>{item.display_name || item.email}</Text>
              <Text style={styles.meta}>
                {item.sport || '—'}{item.athletic_position ? ` · ${item.athletic_position}` : ''}
                {item.season_phase ? ` · ${item.season_phase.replace('_', ' ')}` : ''}
              </Text>
              {item.primary_athletic_goal && (
                <Text style={styles.goal}>{GOAL_LABELS[item.primary_athletic_goal] || item.primary_athletic_goal}</Text>
              )}
            </View>
            <View style={styles.rowSide}>
              {item.onboarding_completed ? (
                <Text style={styles.level}>{item.yoga_level ? (LEVEL_LABELS[item.yoga_level] || item.yoga_level) : '—'}</Text>
              ) : (
                <Text style={styles.pending}>Onboarding pending</Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No athletes yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: theme.spacing(3), paddingTop: theme.spacing(6),
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
  subtitle: { color: theme.colors.textMuted, marginTop: theme.spacing(0.25) },
  link: { color: theme.colors.primary, fontWeight: '600' },
  list: { paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(4) },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2), marginBottom: theme.spacing(1.5),
  },
  rowMain: { flex: 1, marginRight: theme.spacing(2) },
  name: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, fontSize: 13, marginTop: theme.spacing(0.25), textTransform: 'capitalize' },
  goal: { color: theme.colors.primaryDark, fontSize: 12, fontWeight: '600', marginTop: theme.spacing(0.5) },
  rowSide: { alignItems: 'flex-end' },
  level: { fontWeight: '600', color: theme.colors.primary, fontSize: 13, textAlign: 'right' },
  pending: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(6) },
  error: { color: theme.colors.danger, textAlign: 'center', padding: theme.spacing(3) },
});
