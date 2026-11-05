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
  logout: () => Promise<void>;
  /** Возвращает текущий access-токен из памяти (ref), без ре-рендеров. */
  getToken: () => string | null;
  /**
   * Гарантирует идентификацию перед действием (лайк, комментарий, бронь).
   * Если токен есть — возвращает его; иначе лениво создаёт гостя.
   * Возвращает { token, isGuest } чтобы вызывающий код мог сразу узнать статус
   * (не дожидаясь ререндера контекста).
   */
  ensureAuth: () => Promise<{ token: string; isGuest: boolean } | null>;
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

  // Защита от гонки logout ↔ syncSession/ensureAuth:
  // любой запрос сессии, начатый до logout, не должен вернуть пользователя.
  const authEpochRef = useRef(0);
  const isLoggingOutRef = useRef(false);

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
      authEpochRef.current += 1;
      isLoggingOutRef.current = false;
      tokenRef.current = data.token;
      setUser(data.user);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-change'));
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    // Инвалидируем все in-flight проверки сессии и блокируем создание гостя
    authEpochRef.current += 1;
    isLoggingOutRef.current = true;
    tokenRef.current = null;
    setUser(null);
    try {
      // Ждём удаления httpOnly refresh-cookie: иначе syncSession успеет
      // восстановить пользователя по ещё живой cookie (баг «со второго клика»).
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Даже если сеть недоступна, локально сессия уже сброшена
    } finally {
      isLoggingOutRef.current = false;
    }
  }, []);

  const ensureAuth = useCallback(async (): Promise<{ token: string; isGuest: boolean } | null> => {
    if (tokenRef.current) return { token: tokenRef.current, isGuest: user?.isGuest ?? false };
    if (isLoggingOutRef.current) return null;
    const epoch = authEpochRef.current;
    try {
      const res = await fetch('/api/auth/register-guest', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data?.token && epoch === authEpochRef.current) {
        login({ token: json.data.token, refreshToken: json.data.refreshToken, user: json.data.user });
        return { token: json.data.token, isGuest: json.data.user?.isGuest ?? true };
      }
    } catch {
      // сеть недоступна — вернём null, вызывающий код откатит оптимистичный UI
    }
    return null;
  }, [login, user?.isGuest]);

  // Читает существующую сессию с сервера (без создания гостя).
  // Если у нас уже есть токен — передаём его в Authorization для быстрой верификации.
  // НЕ сбрасываем существующий auth при ошибке/отсутствии сессии —
  // только подтверждаем или обновляем.
  const syncSession = useCallback(async (): Promise<void> => {
    if (isLoggingOutRef.current) return;
    const epoch = authEpochRef.current;
    try {
      const headers: Record<string, string> = {};
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
      const res = await fetch('/api/auth/session', { headers, credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data?.user && epoch === authEpochRef.current) {
        tokenRef.current = json.data.token ?? tokenRef.current;
        setUser(json.data.user);
      }
      // Если сервер не подтвердил сессию — сохраняем текущее состояние.
      // Не обнуляем: возможно cookie ещё не доехал, или сеть моргнула.
    } catch {
      // сеть недоступна — остаёмся с текущим состоянием
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
