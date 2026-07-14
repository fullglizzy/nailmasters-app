// ============================================================
// React Query хуки для профиля и уведомлений
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
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
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: [...profileKeys.all, user?.id],
    queryFn: () => apiGet<UserProfile>('/api/auth/profile'),
    enabled: isAuthenticated,
  });
}

/**
 * Fetch unread notifications for the current user.
 * Enabled automatically when the auth context has a token.
 */
export function useNotifications() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: [...notificationKeys.all, user?.id],
    queryFn: () => apiGet<Notification[]>('/api/notifications'),
    enabled: isAuthenticated,
  });
}

// ── Mutations ─────────────────────────────────────────────

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { ensureAuth } = useAuth();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await ensureAuth();
      return apiPut<unknown>('/api/auth/profile', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}
