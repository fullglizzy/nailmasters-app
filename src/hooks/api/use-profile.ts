// ============================================================
// React Query хуки для профиля и уведомлений
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuthState } from '@/components/providers/guest-provider';
import type { UserProfile, Notification } from '@/lib/types';

// ── Query Keys ────────────────────────────────────────────

export const profileKeys = {
  all: ['profile'] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
};

// ── Hooks ─────────────────────────────────────────────────

/**
 * Fetch the current user's profile.
 * Enabled automatically when the auth context has a token.
 * Re-fetches on auth state changes (login / logout / guest creation).
 */
export function useProfile() {
  const { token } = useAuthState();
  return useQuery({
    queryKey: [...profileKeys.all, token],
    queryFn: () => apiGet<UserProfile>('/api/auth/profile'),
    enabled: !!token,
  });
}

/**
 * Fetch unread notifications for the current user.
 * Enabled automatically when the auth context has a token.
 */
export function useNotifications() {
  const { token } = useAuthState();
  return useQuery({
    queryKey: [...notificationKeys.all, token],
    queryFn: () => apiGet<Notification[]>('/api/notifications'),
    enabled: !!token,
  });
}
