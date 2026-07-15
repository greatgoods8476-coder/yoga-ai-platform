import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError, FriendRequest, LeaderboardEntry } from '../api/client';
import { theme } from '../theme';

export default function SocialScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function refresh() {
    const [lb, reqs] = await Promise.all([api.leaderboard(token), api.friendRequests(token)]);
    setLeaderboard(lb.leaderboard);
    setRequests(reqs.requests);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function sendRequest() {
    if (!email.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      await api.sendFriendRequest(token, email.trim());
      setMessage('Friend request sent.');
      setEmail('');
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Could not send that request.');
    } finally {
      setSending(false);
    }
  }

  async function respond(requestId: string, accept: boolean) {
    if (accept) await api.acceptFriendRequest(token, requestId);
    else await api.declineFriendRequest(token, requestId);
    refresh();
  }

  if (!leaderboard) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Friends</Text>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a friend by email"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Pressable style={styles.addButton} onPress={sendRequest} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Add</Text>}
        </Pressable>
      </View>
      {message && <Text style={styles.message}>{message}</Text>}

      {requests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Requests</Text>
          {requests.map((r) => (
            <View key={r.id} style={styles.requestRow}>
              <Text style={styles.requestName}>{r.display_name || r.email}</Text>
              <View style={styles.requestActions}>
                <Pressable onPress={() => respond(r.id, true)}><Text style={styles.acceptLink}>Accept</Text></Pressable>
                <Pressable onPress={() => respond(r.id, false)}><Text style={styles.declineLink}>Decline</Text></Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Streak leaderboard</Text>
        {leaderboard.map((entry, i) => (
          <View key={entry.user_id} style={styles.leaderRow}>
            <Text style={styles.leaderRank}>{i + 1}</Text>
            <Text style={[styles.leaderName, entry.isYou && styles.leaderNameYou]}>
              {entry.isYou ? 'You' : entry.display_name}
            </Text>
            <Text style={styles.leaderStreak}>{entry.streak_days}d</Text>
          </View>
        ))}
        {leaderboard.length === 1 && (
          <Text style={styles.empty}>Add a friend above to start comparing streaks.</Text>
        )}
      </View>

      <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(3) },
  addRow: { flexDirection: 'row', gap: theme.spacing(1), marginBottom: theme.spacing(1) },
  input: {
    flex: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius, padding: theme.spacing(1.5), fontSize: 15, color: theme.colors.text,
  },
  addButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, paddingHorizontal: theme.spacing(2.5), justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600' },
  message: { color: theme.colors.textMuted, marginBottom: theme.spacing(2) },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginBottom: theme.spacing(3), marginTop: theme.spacing(2),
  },
  cardTitle: { fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1.5) },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing(1) },
  requestName: { color: theme.colors.text },
  requestActions: { flexDirection: 'row', gap: theme.spacing(1.5) },
  acceptLink: { color: theme.colors.primary, fontWeight: '600' },
  declineLink: { color: theme.colors.danger, fontWeight: '600' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing(1) },
  leaderRank: { width: 24, color: theme.colors.textMuted },
  leaderName: { flex: 1, color: theme.colors.text },
  leaderNameYou: { fontWeight: '700', color: theme.colors.primary },
  leaderStreak: { color: theme.colors.text, fontWeight: '600' },
  empty: { color: theme.colors.textMuted },
  link: { color: theme.colors.primary, textAlign: 'center' },
});
