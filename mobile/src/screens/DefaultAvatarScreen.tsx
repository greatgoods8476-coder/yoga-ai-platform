import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from '../components/WebViewCompat';
import { api } from '../api/client';
import { theme } from '../theme';

// Auto-generates a default coach avatar (no manual customization) using
// Ready Player Me's quickStart mode, keyed off instructor_gender already
// collected during onboarding. Real caveat: I can't fully verify from this
// sandbox whether RPM's quickStart mode truly auto-exports with zero taps
// or still needs one confirm tap -- the WebView stays visible (not hidden)
// so it degrades gracefully to "one quick tap" rather than silently
// breaking if quickStart isn't fully automatic. Either way, the export
// event is caught the same way the manual creator flow already handles it.
export default function DefaultAvatarScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [creatorUrl, setCreatorUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAvatar(token)
      .then((r) => {
        const gender = r.avatarPreference.instructorGender;
        const genderParam = gender === 'male' || gender === 'female' ? `&gender=${gender}` : '';
        setCreatorUrl(`https://demo.readyplayer.me/avatar?frameApi&bodyType=fullbody&quickStart=true${genderParam}`);
      })
      .catch(() => setCreatorUrl('https://demo.readyplayer.me/avatar?frameApi&bodyType=fullbody&quickStart=true'));
  }, []);

  function handleMessage(event: WebViewMessageEvent) {
    let payload: any;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (payload?.eventName !== 'v1.avatar.exported') return;
    const url: string | undefined = payload?.data?.url;
    if (!url || saving) return;

    setSaving(true);
    api.saveAvatar(token, url).finally(onDone);
  }

  if (!creatorUrl) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setting up your coach...</Text>
      <WebView source={{ uri: creatorUrl }} onMessage={handleMessage} style={styles.webview} />
      {saving && (
        <View style={styles.overlay}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  title: { fontSize: 15, fontWeight: '600', color: theme.colors.text, textAlign: 'center', padding: theme.spacing(2) },
  webview: { flex: 1 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center',
  },
});
