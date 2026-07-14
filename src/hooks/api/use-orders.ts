// ============================================================
// React Query хуки для заказов
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuthState } from '@/components/providers/guest-provider';
import type { OrderEnriched } from '@/lib/types';

// ── Query Key Factories ───────────────────────────────────

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (status?: string) => [...orderKeys.lists(), { status }] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ── Hooks ─────────────────────────────────────────────────

export function useOrders(status?: string) {
  const { token } = useAuthState();
  return useQuery({
    queryKey: [...orderKeys.list(status), token],
    queryFn: () => apiGet<OrderEnriched[]>('/api/orders', status ? { status } : undefined),
    enabled: !!token,
    refetchOnMount: true,
    staleTime: 0,
  });
}
