'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { registerTokenGetter } from '@/lib/api';
import type { UserProfile } from '@/lib/types';

// ── Contract ─────────────────────────────────────────────

export interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  /** Устанавливает сессию из ответа API (login / register / register-guest). */
  login: (data: { token: string; refreshToken?: string; user: UserProfile }) => void;
  /** Сбрасывает сессию и удаляет refreshToken cookie на сервере. */
  logout: () => void;
  /** Возвращает текущий access-токен из памяти (ref), без ре-рендеров. */
  getToken: () => string | null;
  /**
   * Гарантирует идентификацию перед действием (лайк, комментарий, бронь).
   * Если токен есть — возвращает его; иначе лениво создаёт гостя.
   */
  ensureAuth: () => Promise<string | null>;
  /** Перечитывает сессию с сервера (после изменения профиля и т.п.). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // accessToken живёт в ref — не в state, чтобы не триггерить ре-рендеры
  const tokenRef = useRef<string | null>(null);

  // Регистрируем геттер токена для lib/api синхронно при первом рендере,
  // до монтирования детей — чтобы их запросы сразу видели токен.
  const registeredRef = useRef(false);
  if (!registeredRef.current) {
    registeredRef.current = true;
    registerTokenGetter(() => tokenRef.current);
  }

  const getToken = useCallback(() => tokenRef.current, []);

  const login = useCallback(
    (data: { token: string; refreshToken?: string; user: UserProfile }) => {
      tokenRef.current = data.token;
      setUser(data.user);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'));
      }
    },
    [],
  );

  const logout = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    // Удаляем refreshToken cookie на сервере (не блокируем UI)
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-change'));
    }
  }, []);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    try {
      const res = await fetch('/api/auth/register-guest', { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data?.token) {
        login({ token: json.data.token, refreshToken: json.data.refreshToken, user: json.data.user });
        return json.data.token;
      }
    } catch {
      // сеть недоступна — вернём null, вызывающий код откатит оптимистичный UI
    }
    return null;
  }, [login]);

  // Читает существующую сессию с сервера (без создания гостя)
  const syncSession = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/auth/session');
      const json = await res.json();
      if (json.success && json.data?.user) {
        tokenRef.current = json.data.token ?? tokenRef.current;
        setUser(json.data.user);
      } else {
        tokenRef.current = null;
        setUser(null);
      }
    } catch {
      // нет сессии — остаёмся анонимными
    }
  }, []);

  const refresh = useCallback(() => syncSession(), [syncSession]);

  // ── Bootstrap: читаем существующую сессию при монтировании ──
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    syncSession().finally(() => setIsLoading(false));
  }, [syncSession]);

  // ── Cross-tab / in-app синхронизация ──
  useEffect(() => {
    const handler = () => { void syncSession(); };
    window.addEventListener('auth-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('auth-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, [syncSession]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isGuest: user?.isGuest ?? false,
    isLoading,
    login,
    logout,
    getToken,
    ensureAuth,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
