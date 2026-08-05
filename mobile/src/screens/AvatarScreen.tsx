import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { api } from '../api/client';
import { theme } from '../theme';

// Ready Player Me's public "demo" subdomain is their documented quickstart
// avatar creator — no account/API key needed to create a GLB avatar with it.
// See https://docs.readyplayer.me/ready-player-me/integration-guides/web
const CREATOR_URL = 'https://demo.readyplayer.me/avatar?frameApi&bodyType=fullbody&quickStart=false';

const VIEWER_HTML = (glbUrl: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
    <style>
      html, body { margin: 0; height: 100%; background: ${theme.colors.background}; }
      model-viewer { width: 100%; height: 100%; --poster-color: transparent; }
    </style>
  </head>
  <body>
    <model-viewer
      src="${glbUrl}"
      camera-controls
      auto-rotate
      shadow-intensity="1"
      exposure="1.1"
      camera-orbit="0deg 80deg 2.2m"
      field-of-view="30deg"
    ></model-viewer>
  </body>
</html>
`;

// The creator posts window messages as JSON strings of shape
// { source: 'readyplayerme', eventName: 'v1.avatar.exported', data: { url } }.
// This bridges that into React Native's WebView onMessage channel.
const INJECT_BRIDGE = `
window.addEventListener('message', (event) => {
  const json = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
  window.ReactNativeWebView.postMessage(json);
});
true;
`;

export default function AvatarScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAvatar(token)
      .then((r) => {
        const url = r.avatarPreference.avatarUrl || null;
        setAvatarUrl(url);
        setCreating(!url);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your avatar.'))
      .finally(() => setLoading(false));
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
    if (!url) return;

    setSaving(true);
    setError(null);
    api.saveAvatar(token, url)
      .then(() => {
        setAvatarUrl(url);
        setCreating(false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not save your avatar.'))
      .finally(() => setSaving(false));
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.link}>Back</Text></Pressable>
        <Text style={styles.title}>Your coach</Text>
        {avatarUrl && !creating ? (
          <Pressable onPress={() => setCreating(true)}><Text style={styles.link}>Edit</Text></Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {saving && (
        <View style={styles.savingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.savingText}>Saving your avatar...</Text>
        </View>
      )}

      {creating ? (
        <WebView
          source={{ uri: CREATOR_URL }}
          onMessage={handleMessage}
          injectedJavaScript={INJECT_BRIDGE}
          style={styles.webview}
        />
      ) : avatarUrl ? (
        <WebView source={{ html: VIEWER_HTML(avatarUrl) }} style={styles.webview} />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No avatar yet — create one above.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: theme.spacing(2), paddingTop: theme.spacing(6),
  },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.text },
  link: { color: theme.colors.primary, fontWeight: '600' },
  webview: { flex: 1, backgroundColor: theme.colors.background },
  error: { color: theme.colors.danger, textAlign: 'center', marginBottom: theme.spacing(1) },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(1), padding: theme.spacing(1) },
  savingText: { color: theme.colors.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.colors.textMuted },
});
