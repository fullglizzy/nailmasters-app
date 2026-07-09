'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  role: string;
  isGuest: boolean;
  refresh: () => void;
}

const AuthContext = createContext<AuthState>({ token: null, role: '', isGuest: false, refresh: () => {} });
export const useAuthState = () => useContext(AuthContext);

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [isGuest, setIsGuest] = useState(false);

  const readAuth = useCallback(() => {
    const t = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setToken(t);
    setRole(user.role || '');
    setIsGuest(user.isGuest || false);
  }, []);

  // Initial read
  useEffect(() => { readAuth(); }, [readAuth]);

  // Listen for changes from other parts of the app
  useEffect(() => {
    const handler = () => readAuth();
    window.addEventListener('auth-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('auth-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, [readAuth]);

  // Create guest if no account
  useEffect(() => {
    if (token) return;
    const guestCreated = localStorage.getItem('guest_created');
    if (guestCreated) return;

    let cancelled = false;

    fetch('/api/auth/register-guest', { method: 'POST' })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.success && json.data) {
          localStorage.setItem('token', json.data.token);
          localStorage.setItem('refreshToken', json.data.refreshToken);
          localStorage.setItem('user', JSON.stringify(json.data.user));
          localStorage.setItem('guest_created', '1');
          readAuth();
          window.dispatchEvent(new Event('auth-change'));
        } else {
          // API returned error — clean up so we can retry next visit
          localStorage.removeItem('guest_created');
        }
      })
      .catch(() => {
        // Network error — clean up so we can retry next visit
        if (!cancelled) localStorage.removeItem('guest_created');
      });

    return () => { cancelled = true; };
  }, [token, readAuth]);

  return (
    <AuthContext.Provider value={{ token, role, isGuest, refresh: readAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
