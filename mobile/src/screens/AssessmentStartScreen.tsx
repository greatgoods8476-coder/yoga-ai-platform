import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export default function AssessmentStartScreen({ onStart }: { onStart: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Let's build your plan</Text>
      <Text style={styles.subtitle}>Two quick parts, then we'll map out your first month.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Written Assessment</Text>
            <Text style={styles.stepMeta}>~8-10 min · sport, training history, injuries, goals</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Mobility Test</Text>
            <Text style={styles.stepMeta}>~5 min · record 5 short movements on camera</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.button} onPress={onStart}>
        <Text style={styles.buttonText}>Start Now: Take Your Assessment</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3), justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing(1), textAlign: 'center' },
  subtitle: { color: theme.colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: theme.spacing(4) },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing(2.5), marginBottom: theme.spacing(4),
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing(1.5) },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing(2),
  },
  stepNumberText: { color: '#fff', fontWeight: '700' },
  stepBody: { flex: 1 },
  stepTitle: { color: theme.colors.text, fontWeight: '600', fontSize: 15 },
  stepMeta: { color: theme.colors.textMuted, fontSize: 13, marginTop: theme.spacing(0.25) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
