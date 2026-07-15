// Expo exposes EXPO_PUBLIC_-prefixed env vars to client code with no extra
// config. Defaults to the Android emulator's loopback alias; override with
// EXPO_PUBLIC_API_URL for a device, simulator, or deployed backend.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  { token, body }: { token?: string | null; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (json as { error?: string }).error || `request failed (${res.status})`);
  }
  return json as T;
}

export const api = {
  signup: (email: string, password: string) =>
    request<{ token: string; userId: string }>('POST', '/auth/signup', { body: { email, password } }),
  login: (email: string, password: string) =>
    request<{ token: string; userId: string }>('POST', '/auth/login', { body: { email, password } }),

  onboardingStart: (token: string) =>
    request<OnboardingState>('POST', '/onboarding/start', { token }),
  onboardingAnswer: (token: string, sessionId: string, field: string, value: unknown) =>
    request<OnboardingState>('POST', '/onboarding/answer', { token, body: { sessionId, field, value } }),
  onboardingStatus: (token: string) =>
    request<{ onboardingCompleted: boolean }>('GET', '/onboarding/status', { token }),

  generateRoutine: (token: string, routineType: string, durationMin?: number) =>
    request<RoutineResponse>('POST', '/routines/generate', { token, body: { routineType, durationMin } }),
  listRoutines: (token: string) => request<{ routines: Routine[] }>('GET', '/routines', { token }),
  getRoutine: (token: string, id: string) => request<RoutineResponse>('GET', `/routines/${id}`, { token }),

  startSession: (token: string, routineId: string) =>
    request<{ sessionLog: SessionLog }>('POST', '/sessions', { token, body: { routineId } }),
  completeSession: (token: string, id: string, payload: CompleteSessionPayload) =>
    request<{ sessionLog: SessionLog; adaptationState: unknown }>('POST', `/sessions/${id}/complete`, { token, body: payload }),

  meditationCategories: (token: string) => request<{ categories: string[] }>('GET', '/meditations/categories', { token }),
  generateMeditation: (token: string, category: string, durationSec: number) =>
    request<{ meditation: Meditation; lines: { atSec: number; text: string }[] }>('POST', '/meditations/generate', {
      token, body: { category, durationSec },
    }),
  completeMeditation: (token: string, id: string) =>
    request<{ ok: true }>('POST', `/meditations/${id}/complete`, { token }),

  progressDashboard: (token: string, days = 30) =>
    request<ProgressDashboard>('GET', `/progress/dashboard?days=${days}`, { token }),
};

export type OnboardingField = {
  key: string;
  prompt: string;
  type: 'number' | 'text' | 'multi_text' | 'single_select' | 'multi_select' | 'scale';
  options?: string[];
  min?: number;
  max?: number;
};

export type OnboardingState = { done: boolean; sessionId: string; question?: OnboardingField };

export type Pose = {
  id: string;
  slug: string;
  name: string;
  sanskrit_name: string | null;
  category: string;
  difficulty: string;
  benefits: string[];
  breathing_cue: string | null;
  alignment_cues: string[];
  beginner_modifications: string[];
};

export type Routine = {
  id: string;
  type: string;
  title: string;
  goal_tags: string[];
  total_duration_sec: number;
  created_at: string;
};

export type RoutineItem = { id: string; sequence_index: number; duration_sec: number; pose: Pose };
export type RoutineResponse = { routine: Routine; items: RoutineItem[] };

export type SessionLog = {
  id: string;
  routine_id: string;
  completion_pct: string | number;
  completed_at: string | null;
};

export type CompleteSessionPayload = {
  completionPct: number;
  skippedPoseIds?: string[];
  painReported?: Record<string, number>;
  difficultyFeedback?: 'too_easy' | 'just_right' | 'too_hard';
  enjoymentRating?: number;
  notes?: string;
};

export type Meditation = { id: string; category: string; goal: string; duration_sec: number; script: string };

export type ProgressDay = {
  metric_date: string;
  flexibility_score: string | null;
  mobility_score: string | null;
  balance_score: string | null;
  strength_score: string | null;
  mood_score: string | null;
  stress_score: string | null;
  meditation_minutes: string;
  workout_minutes: string;
  streak_days: number;
};

export type ProgressDashboard = {
  days: ProgressDay[];
  currentStreak: number;
  totals: { workoutMinutes: number; meditationMinutes: number };
};
