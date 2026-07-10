import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const TOKEN_KEY = 'yoga_ai_token';

type AuthContextValue = {
  token: string | null;
  loading: boolean;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((stored) => {
      setToken(stored);
      setLoading(false);
    });
  }, []);

  async function persist(nextToken: string) {
    await AsyncStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }

  const signup = async (email: string, password: string) => {
    const res = await api.signup(email, password);
    await persist(res.token);
  };

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await persist(res.token);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
