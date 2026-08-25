import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, RoutineResponse } from './src/api/client';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AssessmentStartScreen from './src/screens/AssessmentStartScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MobilityTestScreen from './src/screens/MobilityTestScreen';
import PlanRevealScreen from './src/screens/PlanRevealScreen';
import DefaultAvatarScreen from './src/screens/DefaultAvatarScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionPlayerScreen from './src/screens/SessionPlayerScreen';
import MeditationScreen from './src/screens/MeditationScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SocialScreen from './src/screens/SocialScreen';
import AvatarScreen from './src/screens/AvatarScreen';
import CoachDashboardScreen from './src/screens/CoachDashboardScreen';
import CoachAthleteDetailScreen from './src/screens/CoachAthleteDetailScreen';
import PlanScreen from './src/screens/PlanScreen';
import { useRegisterPushToken } from './src/hooks/usePushNotifications';
import { theme } from './src/theme';

type Screen = 'home' | 'session' | 'meditation' | 'progress' | 'social' | 'avatar' | 'plan' | 'examMobility' | 'examReveal';

// First-time sequence, walked through once right after signup: a (currently
// placeholder) intro video, the written assessment, a baseline mobility
// test that's deliberately downstream of it (assessMobility on the backend
// reads the athlete's sport/position/injuries straight from those written
// answers), then the first month's plan reveal with avatar setup.
type FirstTimeStep = 'mobility' | 'planReveal' | 'avatarCustomize' | 'avatarDefault' | null;

const INTRO_SEEN_KEY = 'yoga_ai_intro_seen';

function InnerApp() {
  const { token, loading, logout } = useAuth();
  const [isCoach, setIsCoach] = useState<boolean | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<{ orgId: string; userId: string } | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [firstTimeStep, setFirstTimeStep] = useState<FirstTimeStep>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [activeRoutine, setActiveRoutine] = useState<RoutineResponse | null>(null);
  const [activePlanDayId, setActivePlanDayId] = useState<string | null>(null);

  useRegisterPushToken(token);

  useEffect(() => {
    if (!token) {
      setIsCoach(null);
      setOnboardingCompleted(null);
      setIntroSeen(null);
      setAssessmentStarted(false);
      setFirstTimeStep(null);
      return;
    }
    api.myOrgs(token).then((r) => setIsCoach(r.organizations.some((o) => o.role === 'coach')));
    api.onboardingStatus(token).then((r) => setOnboardingCompleted(r.onboardingCompleted));
    AsyncStorage.getItem(INTRO_SEEN_KEY).then((stored) => setIntroSeen(!!stored));
  }, [token]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!token) return <AuthScreen />;

  if (isCoach === null || onboardingCompleted === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  // Coach accounts skip athlete onboarding entirely -- they get the roster
  // dashboard, not the practice questionnaire.
  if (isCoach) {
    if (selectedAthlete) {
      return (
        <CoachAthleteDetailScreen
          token={token}
          orgId={selectedAthlete.orgId}
          userId={selectedAthlete.userId}
          onBack={() => setSelectedAthlete(null)}
        />
      );
    }
    return (
      <CoachDashboardScreen
        token={token}
        onSelectAthlete={(orgId, userId) => setSelectedAthlete({ orgId, userId })}
        onLogout={logout}
      />
    );
  }

  if (!onboardingCompleted) {
    if (introSeen === null) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (!introSeen) {
      return (
        <WelcomeScreen
          onDone={() => {
            AsyncStorage.setItem(INTRO_SEEN_KEY, '1').catch(() => {});
            setIntroSeen(true);
          }}
        />
      );
    }
    if (!assessmentStarted) {
      return <AssessmentStartScreen onStart={() => setAssessmentStarted(true)} />;
    }
    return (
      <OnboardingScreen
        token={token}
        onComplete={() => {
          setOnboardingCompleted(true);
          setFirstTimeStep('mobility');
        }}
      />
    );
  }

  if (firstTimeStep === 'mobility') {
    return (
      <MobilityTestScreen
        token={token}
        title="Your Baseline Mobility Test"
        onBack={() => setFirstTimeStep('planReveal')}
        onFirstComplete={() => setFirstTimeStep('planReveal')}
      />
    );
  }

  if (firstTimeStep === 'planReveal') {
    return (
      <PlanRevealScreen
        token={token}
        onContinue={() => setFirstTimeStep('avatarDefault')}
        onCustomizeAvatar={() => setFirstTimeStep('avatarCustomize')}
      />
    );
  }

  if (firstTimeStep === 'avatarCustomize') {
    return <AvatarScreen token={token} onBack={() => setFirstTimeStep(null)} />;
  }

  if (firstTimeStep === 'avatarDefault') {
    return <DefaultAvatarScreen token={token} onDone={() => setFirstTimeStep(null)} />;
  }

  if (screen === 'examMobility') {
    return (
      <MobilityTestScreen
        token={token}
        title="Monthly Exam"
        onBack={() => setScreen('home')}
        onFirstComplete={() => setScreen('examReveal')}
      />
    );
  }

  if (screen === 'examReveal') {
    return (
      <PlanRevealScreen
        token={token}
        showAvatarSetup={false}
        onContinue={() => setScreen('home')}
        onCustomizeAvatar={() => setScreen('avatar')}
      />
    );
  }

  if (screen === 'session' && activeRoutine) {
    return (
      <SessionPlayerScreen
        token={token}
        routine={activeRoutine}
        onFinish={(sessionLogId) => {
          const dayId = activePlanDayId;
          setActiveRoutine(null);
          setActivePlanDayId(null);
          if (dayId && sessionLogId) {
            api.linkPlanDaySession(token, dayId, sessionLogId).catch(() => {});
            setScreen('plan');
          } else {
            setScreen('home');
          }
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

  if (screen === 'avatar') {
    return <AvatarScreen token={token} onBack={() => setScreen('home')} />;
  }

  if (screen === 'plan') {
    return (
      <PlanScreen
        token={token}
        onStartDay={(dayId, routine) => {
          setActivePlanDayId(dayId);
          setActiveRoutine(routine);
          setScreen('session');
        }}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <HomeScreenWithLogout
      token={token}
      onStartSession={(routine) => {
        setActiveRoutine(routine);
        setScreen('session');
      }}
      onStartPlanDay={(dayId, routine) => {
        setActivePlanDayId(dayId);
        setActiveRoutine(routine);
        setScreen('session');
      }}
      onMonthlyExam={() => setScreen('examMobility')}
      onNavigate={setScreen}
    />
  );
}

function HomeScreenWithLogout({
  token, onStartSession, onStartPlanDay, onMonthlyExam, onNavigate,
}: {
  token: string;
  onStartSession: (routine: RoutineResponse) => void;
  onStartPlanDay: (dayId: string, routine: RoutineResponse) => void;
  onMonthlyExam: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const { logout } = useAuth();
  return (
    <HomeScreen
      token={token}
      onStartSession={onStartSession}
      onStartPlanDay={onStartPlanDay}
      onMonthlyExam={onMonthlyExam}
      onNavigate={onNavigate}
      onLogout={logout}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
