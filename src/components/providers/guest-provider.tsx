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
    localStorage.setItem('guest_created', '1');
    localStorage.removeItem('guest_likes'); // Clean slate for new guest

    fetch('/api/auth/register-guest', { method: 'POST' })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          localStorage.setItem('token', json.data.token);
          localStorage.setItem('refreshToken', json.data.refreshToken);
          localStorage.setItem('user', JSON.stringify(json.data.user));
          readAuth();
          window.dispatchEvent(new Event('auth-change'));
        }
      })
      .catch(() => {});
  }, [token, readAuth]);

  return (
    <AuthContext.Provider value={{ token, role, isGuest, refresh: readAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
