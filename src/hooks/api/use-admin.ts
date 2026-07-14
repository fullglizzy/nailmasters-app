// ============================================================
// React Query хуки для админки
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { AdminStats, AdminUser, Design, OrderEnriched } from '@/lib/types';

// ── Query Keys ────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: (search?: string) => [...adminKeys.all, 'users', { search }] as const,
  designs: () => [...adminKeys.all, 'designs'] as const,
  orders: () => [...adminKeys.all, 'orders'] as const,
};

// ── Hooks ─────────────────────────────────────────────────

export function useAdminStats() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => apiGet<AdminStats>('/api/admin/stats'),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}

export function useAdminUsers(search?: string) {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: adminKeys.users(search),
    queryFn: () => apiGet<AdminUser[]>('/api/admin/users', search ? { search } : undefined),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}

export function useAdminDesigns() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: adminKeys.designs(),
    queryFn: () => apiGet<Design[]>('/api/designs/admin/all'),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}

export function useAdminOrders() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: adminKeys.orders(),
    queryFn: () => apiGet<OrderEnriched[]>('/api/admin/orders'),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}
