import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// First-open welcome moment -- shown once per device (gated by an
// AsyncStorage flag in App.tsx). No footage, no external assets, nothing
// that needs to be generated or licensed: three "level" bars stack up in
// sequence (echoing the app's actual level/progression system) while the
// slogan fades in underneath, then the whole screen becomes tappable to
// continue. Auto-advances a couple seconds after the animation settles so
// nobody gets stuck waiting on a splash screen.
const SLOGAN = 'UNLOCK YOUR NEXT LEVEL.';
const SUBTEXT = 'AI-powered mobility & performance training, built for athletes.';
const BAR_HEIGHTS = [36, 58, 84];
const AUTO_ADVANCE_DELAY_MS = 2600;

export default function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const barValues = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0))).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const textRise = useRef(new Animated.Value(16)).current;
  const hintFade = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }

  useEffect(() => {
    Animated.stagger(
      160,
      barValues.map((v) => Animated.timing(v, { toValue: 1, duration: 480, easing: Easing.out(Easing.back(1.4)), useNativeDriver: false }))
    ).start(() => {
      Animated.parallel([
        Animated.timing(textFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textRise, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(hintFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    });

    const timer = setTimeout(finish, AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable style={styles.container} onPress={finish}>
      <View style={styles.barsRow}>
        {BAR_HEIGHTS.map((h, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: barValues[i].interpolate({ inputRange: [0, 1], outputRange: [0, h] }),
                opacity: barValues[i],
                backgroundColor: i === BAR_HEIGHTS.length - 1 ? theme.colors.accent : 'rgba(255,255,255,0.85)',
              },
            ]}
          />
        ))}
      </View>

      <Animated.View style={{ opacity: textFade, transform: [{ translateY: textRise }] }}>
        <Text style={styles.slogan}>{SLOGAN}</Text>
        <Text style={styles.subtext}>{SUBTEXT}</Text>
      </Animated.View>

      <Animated.Text style={[styles.hint, { opacity: hintFade }]}>Tap to begin</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: theme.colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', padding: theme.spacing(4),
  },
  barsRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing(1.5),
    height: 90, marginBottom: theme.spacing(5),
  },
  bar: { width: 18, borderRadius: 6 },
  slogan: {
    color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5,
    marginBottom: theme.spacing(1.5),
  },
  subtext: {
    color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', lineHeight: 21,
    maxWidth: 300, alignSelf: 'center',
  },
  hint: {
    position: 'absolute', bottom: theme.spacing(6), color: 'rgba(255,255,255,0.6)',
    fontSize: 13, fontWeight: '600', letterSpacing: 1,
  },
});
