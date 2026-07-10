'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  role: string;
  isGuest: boolean;
  refresh: () => void;
  isLoading: boolean;
}

// ── Context ──────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  token: null, role: '', isGuest: false, refresh: () => {}, isLoading: true,
});

export const useAuthState = () => useContext(AuthContext);

// ── Storage helpers ──────────────────────────────────────

const KEYS = {
  token: 'token',
  refreshToken: 'refreshToken',
  user: 'user',
  guestCreated: 'guest_created',
  guestLikes: 'guest_likes',
} as const;

function clearAllAuth() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

/** Public logout — clears everything, hard reloads */
export function clearAuth() {
  clearAllAuth();
  window.location.href = '/';
}

/** Persist auth from API response */
function persist(data: { token: string; refreshToken: string; user: Record<string, unknown> }) {
  localStorage.setItem(KEYS.token, data.token);
  localStorage.setItem(KEYS.refreshToken, data.refreshToken);
  localStorage.setItem(KEYS.user, JSON.stringify(data.user));
  localStorage.setItem(KEYS.guestCreated, '1');
}

/** Quick check if stored token is still valid */
async function isTokenValid(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── State machine ────────────────────────────────────────

type Phase = 'checking' | 'guest_needed' | 'ready';

// ── Provider ─────────────────────────────────────────────

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [phase, setPhase] = useState<Phase>('checking');
  const startedRef = useRef(false);

  const refresh = useCallback(() => {
    const t = localStorage.getItem(KEYS.token);
    const user = JSON.parse(localStorage.getItem(KEYS.user) || '{}');
    setToken(t);
    setRole((user.role as string) || '');
    setIsGuest((user.isGuest as boolean) || false);
  }, []);

  // ── Bootstrap: sequential, no races ────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      // 1. Check for existing token
      const storedToken = localStorage.getItem(KEYS.token);

      if (storedToken) {
        // 2a. Token exists — validate it
        const valid = await isTokenValid(storedToken);
        if (valid) {
          // Token is good — use it
          const user = JSON.parse(localStorage.getItem(KEYS.user) || '{}');
          setToken(storedToken);
          setRole((user.role as string) || '');
          setIsGuest((user.isGuest as boolean) || false);
          setPhase('ready');
          return;
        }
        // Token expired — clear everything, fall through to guest creation
        clearAllAuth();
        setToken(null);
        setRole('');
        setIsGuest(false);
      }

      // 2b. No valid token — check if guest was already created
      if (localStorage.getItem(KEYS.guestCreated)) {
        setPhase('ready');
        return;
      }

      // 3. Need a guest
      setPhase('guest_needed');

      try {
        const res = await fetch('/api/auth/register-guest', { method: 'POST' });
        const json = await res.json();
        if (json.success && json.data) {
          persist(json.data);
          setToken(json.data.token);
          setRole(json.data.user.role || 'client');
          setIsGuest(true);
          window.dispatchEvent(new Event('auth-change'));
        } else {
          localStorage.removeItem(KEYS.guestCreated);
        }
      } catch {
        localStorage.removeItem(KEYS.guestCreated);
      }

      setPhase('ready');
    })();
  }, []); // runs exactly once on mount

  // Listen for cross-tab / in-app auth changes
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('auth-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('auth-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  // ── Render ───────────────────────────────────────────

  const isLoading = phase !== 'ready';

  return (
    <AuthContext.Provider value={{ token, role, isGuest, refresh, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
