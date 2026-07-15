import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, RoutineResponse } from './src/api/client';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionPlayerScreen from './src/screens/SessionPlayerScreen';
import MeditationScreen from './src/screens/MeditationScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SocialScreen from './src/screens/SocialScreen';
import { useRegisterPushToken } from './src/hooks/usePushNotifications';
import { theme } from './src/theme';

type Screen = 'home' | 'session' | 'meditation' | 'progress' | 'social';

function InnerApp() {
  const { token, loading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [activeRoutine, setActiveRoutine] = useState<RoutineResponse | null>(null);

  useRegisterPushToken(token);

  useEffect(() => {
    if (!token) {
      setOnboardingCompleted(null);
      return;
    }
    api.onboardingStatus(token).then((r) => setOnboardingCompleted(r.onboardingCompleted));
  }, [token]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!token) return <AuthScreen />;

  if (onboardingCompleted === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingScreen token={token} onComplete={() => setOnboardingCompleted(true)} />;
  }

  if (screen === 'session' && activeRoutine) {
    return (
      <SessionPlayerScreen
        token={token}
        routine={activeRoutine}
        onFinish={() => {
          setActiveRoutine(null);
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'meditation') {
    return <MeditationScreen token={token} onBack={() => setScreen('home')} />;
  }

  if (screen === 'progress') {
    return <ProgressScreen token={token} onBack={() => setScreen('home')} />;
  }

  if (screen === 'social') {
    return <SocialScreen token={token} onBack={() => setScreen('home')} />;
  }

  return (
    <HomeScreenWithLogout
      token={token}
      onStartSession={(routine) => {
        setActiveRoutine(routine);
        setScreen('session');
      }}
      onNavigate={setScreen}
    />
  );
}

function HomeScreenWithLogout({
  token, onStartSession, onNavigate,
}: {
  token: string;
  onStartSession: (routine: RoutineResponse) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const { logout } = useAuth();
  return <HomeScreen token={token} onStartSession={onStartSession} onNavigate={onNavigate} onLogout={logout} />;
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
