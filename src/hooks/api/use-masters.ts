// ============================================================
// React Query хуки для мастеров
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { Master, MasterProfile, Service, ScheduleSlot } from '@/lib/types';

// ── Query Key Factories ───────────────────────────────────

export const masterKeys = {
  all: ['masters'] as const,
  lists: () => [...masterKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...masterKeys.lists(), params] as const,
  details: () => [...masterKeys.all, 'detail'] as const,
  detail: (id: string) => [...masterKeys.details(), id] as const,
  designs: (masterId: string, source?: string) => [...masterKeys.detail(masterId), 'designs', { source }] as const,
  services: (masterId?: string) => [...masterKeys.all, 'services', masterId] as const,
  schedule: (masterId: string) => [...masterKeys.detail(masterId), 'schedule'] as const,
  availableSlots: (masterId: string, date?: string) => [...masterKeys.detail(masterId), 'slots', { date }] as const,
  reviews: (masterId: string) => [...masterKeys.detail(masterId), 'reviews'] as const,
  myReviews: () => [...masterKeys.all, 'myReviews'] as const,
};

// ── Hooks ─────────────────────────────────────────────────

export interface UseMastersParams {
  page?: number;
  limit?: number;
  city?: string;
  specialty?: string;
  rating?: number;
  search?: string;
  sort?: 'rating' | 'orders' | 'newest';
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export function useMasters(params: UseMastersParams = {}) {
  return useQuery({
    queryKey: masterKeys.list(params as Record<string, unknown>),
    queryFn: () => apiGet<Master[]>('/api/masters', params as Record<string, string | number | boolean | undefined>),
  });
}

export function useMaster(id: string | undefined) {
  return useQuery({
    queryKey: masterKeys.detail(id!),
    queryFn: () => apiGet<MasterProfile>(`/api/masters/profile/${id}`),
    enabled: !!id,
  });
}

export function useMasterDesigns(masterId: string | undefined, source?: string) {
  return useQuery({
    queryKey: masterKeys.designs(masterId!, source),
    queryFn: () => apiGet<unknown[]>(`/api/designs/master/${masterId}`, source ? { source } : undefined),
    enabled: !!masterId,
  });
}

export function useMasterServices(masterId?: string) {
  const path = masterId ? `/api/masters/${masterId}/services` : '/api/masters/services';
  return useQuery({
    queryKey: masterKeys.services(masterId),
    queryFn: () => apiGet<Service[]>(path),
    enabled: true, // Always enabled; if no masterId, uses current master's services
  });
}

export function useMasterSchedule(masterId: string | undefined) {
  return useQuery({
    queryKey: masterKeys.schedule(masterId!),
    queryFn: () => apiGet<ScheduleSlot[]>('/api/masters/schedule'),
    enabled: !!masterId,
  });
}

export function useAvailableSlots(masterId: string | undefined, date?: string) {
  return useQuery({
    queryKey: masterKeys.availableSlots(masterId!, date),
    queryFn: () => apiGet<ScheduleSlot[]>(`/api/masters/${masterId}/schedule/available`, date ? { date } : undefined),
    enabled: !!masterId,
  });
}

export function useMasterReviews(masterId: string | undefined) {
  return useQuery({
    queryKey: masterKeys.reviews(masterId!),
    queryFn: () => apiGet<unknown[]>(`/api/master-rating/${masterId}`),
    enabled: !!masterId,
  });
}

export function useMyReviews() {
  const { user } = useAuth();
  const clientId = user?.id || '';
  return useQuery({
    queryKey: masterKeys.myReviews(),
    queryFn: () => apiGet<unknown[]>('/api/master-rating', { clientId }),
    enabled: !!clientId,
  });
}
