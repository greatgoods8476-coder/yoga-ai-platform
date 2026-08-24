import React, { useEffect } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { theme } from '../theme';

// Real scope note: no footage has been supplied yet, so INTRO_VIDEO_URL is
// null and this screen renders as a graceful no-op (calls onDone
// immediately) rather than showing a broken/blank player. Point this at a
// real clip -- an mp4 URL, or a bundled asset via require() -- once one
// exists (either footage you supply, or an AI-generated sports montage;
// generating one here needs Field/Higgsfield video-generation credits,
// which this workspace currently has none of) and the player below takes
// over automatically. The slogan is rendered as a real text overlay (not
// baked into the video pixels), so it can be changed anytime without
// re-rendering any footage.
const INTRO_VIDEO_URL: string | null = null;
const SLOGAN = 'UNLOCK YOUR NEXT LEVEL.';

export default function IntroVideoScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    if (!INTRO_VIDEO_URL) onDone();
  }, []);

  if (!INTRO_VIDEO_URL) return null;

  return <VideoIntro videoUrl={INTRO_VIDEO_URL} onDone={onDone} />;
}

function VideoIntro({ videoUrl, onDone }: { videoUrl: string; onDone: () => void }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  const fade = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 900, delay: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const sub = player.addListener('playToEnd', onDone);
    return () => sub.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />

      <View pointerEvents="none" style={styles.scrim} />

      <Animated.View pointerEvents="none" style={[styles.sloganWrap, { opacity: fade }]}>
        <Text style={styles.slogan}>{SLOGAN}</Text>
      </Animated.View>

      <Pressable style={styles.skipButton} onPress={onDone}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sloganWrap: { position: 'absolute', left: 0, right: 0, bottom: theme.spacing(8), paddingHorizontal: theme.spacing(4) },
  slogan: {
    color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  skipButton: { position: 'absolute', top: Platform.OS === 'web' ? theme.spacing(3) : theme.spacing(6), right: theme.spacing(3) },
  skipText: { color: '#fff', fontWeight: '600' },
});
