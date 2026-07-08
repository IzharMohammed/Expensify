'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { api, refreshAccessToken } from '@/lib/api';
import {
  clearSession,
  getSession,
  setSession,
  subscribeToSession,
  type SessionUser,
  userFromAccessToken,
} from '@/lib/token-store';

type Credentials = {
  email: string;
  password: string;
  name?: string;
};

type AuthContextValue = {
  user: SessionUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  consumeAccessToken: (accessToken: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState(getSession().accessToken);
  const [user, setUser] = useState(getSession().user);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToSession((nextSession) => {
      setAccessToken(nextSession.accessToken);
      setUser(nextSession.user);
    });

    refreshAccessToken().finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      async login(credentials) {
        const response = await api.post('/auth/login', credentials);
        setSession({
          accessToken: response.data.accessToken,
          user: response.data.user ?? userFromAccessToken(response.data.accessToken),
        });
      },
      async register(credentials) {
        const response = await api.post('/auth/register', credentials);
        setSession({
          accessToken: response.data.accessToken,
          user: response.data.user ?? userFromAccessToken(response.data.accessToken),
        });
      },
      async logout() {
        try {
          await api.post('/auth/logout');
        } finally {
          clearSession();
        }
      },
      consumeAccessToken(nextAccessToken) {
        setSession({
          accessToken: nextAccessToken,
          user: userFromAccessToken(nextAccessToken),
        });
      },
    }),
    [accessToken, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: unknown })?.message;
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (message && typeof message === 'object') {
      return JSON.stringify(message);
    }

    return 'Authentication request failed';
  }

  return 'Authentication request failed';
}
