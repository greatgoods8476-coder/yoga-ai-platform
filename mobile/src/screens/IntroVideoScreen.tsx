import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// Real scope note: no video asset has been supplied yet, so this renders as
// a graceful no-op (calls onDone immediately) until INTRO_VIDEO_URL is set
// -- rather than showing a broken/blank player. Once a real video exists,
// point this at it (an mp4 URL, or a bundled asset via require()) and the
// screen below will actually play it, with Skip always available.
const INTRO_VIDEO_URL: string | null = null;

export default function IntroVideoScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    if (!INTRO_VIDEO_URL) onDone();
  }, []);

  if (!INTRO_VIDEO_URL) return null;

  // Native playback would use expo-video/expo-av; web can use a plain
  // <video> tag. Left unimplemented until there's a real asset to point at
  // -- see the note above.
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome video</Text>
      <Pressable style={styles.skipButton} onPress={onDone}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 18 },
  skipButton: { position: 'absolute', top: Platform.OS === 'web' ? theme.spacing(3) : theme.spacing(6), right: theme.spacing(3) },
  skipText: { color: '#fff', fontWeight: '600' },
});
