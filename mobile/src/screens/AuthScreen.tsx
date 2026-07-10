import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { theme } from '../theme';

export default function AuthScreen() {
  const { signup, login } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') await signup(email.trim(), password);
      else await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your practice, personalized.</Text>
      <Text style={styles.subtitle}>A private yoga & meditation coach that adapts to you.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.buttonText}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
        <Text style={styles.switchMode}>
          {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(3), justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(1) },
  subtitle: { fontSize: 15, color: theme.colors.textMuted, marginBottom: theme.spacing(4) },
  input: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(2), fontSize: 16,
  },
  button: {
    backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2),
    alignItems: 'center', marginTop: theme.spacing(1),
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchMode: { color: theme.colors.primary, textAlign: 'center', marginTop: theme.spacing(2) },
  error: { color: theme.colors.danger, marginBottom: theme.spacing(1) },
});
