'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

// ── Types ────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  role: string;
  isGuest: boolean;
  refresh: () => void;
  isLoading: boolean; // true while guest session is being established
}

// ── Context ──────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  token: null,
  role: '',
  isGuest: false,
  refresh: () => {},
  isLoading: true,
});

export const useAuthState = () => useContext(AuthContext);

// ── Helpers ──────────────────────────────────────────────

const STORAGE_KEYS = {
  token: 'token',
  refreshToken: 'refreshToken',
  user: 'user',
  guestCreated: 'guest_created', // prevents duplicate guest accounts
  guestLikes: 'guest_likes',
} as const;

function readStoredAuth(): { token: string | null; user: Record<string, unknown> } {
  if (typeof window === 'undefined') return { token: null, user: {} };
  return {
    token: localStorage.getItem(STORAGE_KEYS.token),
    user: JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}'),
  };
}

/** Persist auth data from API response to localStorage */
function persistAuth(data: { token: string; refreshToken: string; user: Record<string, unknown> }) {
  localStorage.setItem(STORAGE_KEYS.token, data.token);
  localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
  localStorage.setItem(STORAGE_KEYS.guestCreated, '1');
}

/** Clear auth data on explicit logout — keeps guest_created to prevent auto re-creation */
export function clearAuth() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.guestLikes);
  // NOTE: guest_created is intentionally preserved so the guest
  // provider does NOT auto-create a new guest after logout
}

// ── Provider ─────────────────────────────────────────────

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const guestRequestedRef = useRef(false);
  const mountedRef = useRef(true);

  // ── Read auth from storage ──────────────────────────

  const refresh = useCallback(() => {
    const { token: t, user } = readStoredAuth();
    setToken(t);
    setRole((user.role as string) || '');
    setIsGuest((user.isGuest as boolean) || false);
  }, []);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

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

  // ── Guest session creation ──────────────────────────

  useEffect(() => {
    // Already authenticated — nothing to do
    if (token) {
      setIsLoading(false);
      return;
    }

    // Guest already created in a previous session — skip
    if (localStorage.getItem(STORAGE_KEYS.guestCreated)) {
      setIsLoading(false);
      return;
    }

    // Already requested in this mount cycle — prevent double-fetch
    if (guestRequestedRef.current) {
      setIsLoading(false);
      return;
    }
    guestRequestedRef.current = true;

    let cancelled = false;

    fetch('/api/auth/register-guest', { method: 'POST' })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !mountedRef.current) return;

        if (json.success && json.data) {
          persistAuth(json.data);
          // Don't call refresh() — read directly to avoid extra re-render
          setToken(json.data.token);
          setRole(json.data.user.role || 'client');
          setIsGuest(true);
          window.dispatchEvent(new Event('auth-change'));
        } else {
          // API returned non-success — remove stale flag so we retry next visit
          localStorage.removeItem(STORAGE_KEYS.guestCreated);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          // Network error — remove stale flag so we retry next visit
          localStorage.removeItem(STORAGE_KEYS.guestCreated);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── Context value ───────────────────────────────────

  return (
    <AuthContext.Provider value={{ token, role, isGuest, refresh, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
