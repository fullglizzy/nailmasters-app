// ============================================================
// React Query хуки для админки
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { masterKeys } from './use-masters';
import type {
  AdminStats,
  AdminUser,
  AdminMasterListItem,
  AdminMasterDetails,
  Design,
  OrderEnriched,
} from '@/lib/types';
import type {
  AdminCreateMasterInput,
  AdminUpdateMasterInput,
  AdminScheduleBatchInput,
  CreateServiceInput,
} from '@/lib/validators';

// ── Query Keys ────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: (search?: string) => [...adminKeys.all, 'users', { search }] as const,
  designs: () => [...adminKeys.all, 'designs'] as const,
  orders: () => [...adminKeys.all, 'orders'] as const,
  masters: () => [...adminKeys.all, 'masters'] as const,
  masterList: (search?: string) => [...adminKeys.masters(), { search }] as const,
  master: (id: string) => [...adminKeys.masters(), 'detail', id] as const,
};

// ── Queries ───────────────────────────────────────────────

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

export function useAdminMasters(search?: string) {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: adminKeys.masterList(search),
    queryFn: () => apiGet<AdminMasterListItem[]>('/api/admin/masters', search ? { search } : undefined),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}

export function useAdminMaster(id?: string) {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: adminKeys.master(id ?? ''),
    queryFn: () => apiGet<AdminMasterDetails>(`/api/admin/masters/${id}`),
    enabled: !!id && isAuthenticated && user?.role === 'admin',
  });
}

// ── Mutations ─────────────────────────────────────────────

function useInvalidateMaster(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.masters() });
    queryClient.invalidateQueries({ queryKey: adminKeys.master(id) });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    queryClient.invalidateQueries({ queryKey: masterKeys.all });
  };
}

export function useCreateMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminCreateMasterInput) =>
      apiPost<{ userId: string }>('/api/admin/masters', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.masters() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: masterKeys.all });
    },
  });
}

export function useUpdateMaster(id: string) {
  const invalidate = useInvalidateMaster(id);
  return useMutation({
    mutationFn: (payload: AdminUpdateMasterInput) =>
      apiPut<null>(`/api/admin/masters/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useAddMasterService(id: string) {
  const invalidate = useInvalidateMaster(id);
  return useMutation({
    mutationFn: (payload: CreateServiceInput) =>
      apiPost(`/api/admin/masters/${id}/services`, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateMasterService(id: string) {
  const invalidate = useInvalidateMaster(id);
  return useMutation({
    mutationFn: ({ serviceId, ...payload }: Partial<CreateServiceInput> & { serviceId: string }) =>
      apiPut(`/api/admin/masters/${id}/services/${serviceId}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteMasterService(id: string) {
  const invalidate = useInvalidateMaster(id);
  return useMutation({
    mutationFn: (serviceId: string) =>
      apiDelete(`/api/admin/masters/${id}/services/${serviceId}`),
    onSuccess: invalidate,
  });
}

export function useAddMasterSchedule(id: string) {
  const invalidate = useInvalidateMaster(id);
  return useMutation({
    mutationFn: (payload: AdminScheduleBatchInput) =>
      apiPost(`/api/admin/masters/${id}/schedule`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteMasterSchedule(id: string) {
  const invalidate = useInvalidateMaster(id);
  return useMutation({
    mutationFn: (slotId: string) =>
      apiDelete(`/api/admin/masters/${id}/schedule/${slotId}`),
    onSuccess: invalidate,
  });
}
