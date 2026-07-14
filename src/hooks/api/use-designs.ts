// ============================================================
// React Query хуки для дизайнов
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { Design, DesignDetail } from '@/lib/types';

// ── Query Key Factories ───────────────────────────────────

export const designKeys = {
  all: ['designs'] as const,
  lists: () => [...designKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...designKeys.lists(), params] as const,
  details: () => [...designKeys.all, 'detail'] as const,
  detail: (id: string) => [...designKeys.details(), id] as const,
  liked: () => [...designKeys.all, 'liked'] as const,
  popular: () => [...designKeys.all, 'popular'] as const,
  masters: (designId: string) => [...designKeys.detail(designId), 'masters'] as const,
  comments: (designId: string) => [...designKeys.detail(designId), 'comments'] as const,
  canDo: (designId: string) => [...designKeys.detail(designId), 'canDo'] as const,
};

// ── Hooks ─────────────────────────────────────────────────

export interface UseDesignsParams {
  page?: number;
  limit?: number;
  type?: string;
  source?: string;
  color?: string;
  tags?: string;
  length?: string;
  shape?: string;
  season?: string;
  technique?: string;
  mood?: string;
  search?: string;
  sort?: 'likes' | 'newest' | 'popular';
  includeOwn?: boolean;
  uploadedBy?: string;
}

export function useDesigns(params: UseDesignsParams = {}) {
  return useQuery({
    queryKey: designKeys.list(params as Record<string, unknown>),
    queryFn: () => apiGet<Design[]>('/api/designs', params as Record<string, string | number | boolean | undefined>),
  });
}

export function useDesign(id: string | undefined) {
  return useQuery({
    queryKey: designKeys.detail(id!),
    queryFn: () => apiGet<DesignDetail>(`/api/designs/${id}`),
    enabled: !!id,
  });
}

export function usePopularDesigns() {
  return useQuery({
    queryKey: designKeys.popular(),
    queryFn: () => apiGet<Design[]>('/api/designs/popular'),
  });
}

/**
 * Returns the current user's liked designs.
 * Gated on token from auth context — works for guests (who have JWT) and auth users.
 * Disabled when not authenticated (returns empty array, no API call).
 */
export function useLikedDesigns() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: [...designKeys.liked(), user?.id],
    queryFn: () => apiGet<Design[]>('/api/designs/liked'),
    enabled: isAuthenticated,
  });
}

export function useDesignMasters(designId: string | undefined) {
  return useQuery({
    queryKey: designKeys.masters(designId!),
    queryFn: () => apiGet<unknown[]>(`/api/designs/${designId}/masters`),
    enabled: !!designId,
  });
}

export function useComments(designId: string | undefined) {
  return useQuery({
    queryKey: designKeys.comments(designId!),
    queryFn: () => apiGet<unknown[]>(`/api/designs/${designId}/comments`),
    enabled: !!designId,
  });
}

export function useCanDo(designId: string | undefined) {
  return useQuery({
    queryKey: designKeys.canDo(designId!),
    queryFn: () => apiGet<{ canDo: boolean }>(`/api/masters/can-do/${designId}`),
    enabled: !!designId,
  });
}

// ── Mutations ─────────────────────────────────────────────

export function useLikeMutation() {
  const queryClient = useQueryClient();
  const { ensureAuth } = useAuth();
  return useMutation({
    mutationFn: async (designId: string) => {
      await ensureAuth();
      return apiPost<{ likesCount: number; liked: boolean }>(`/api/designs/${designId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: designKeys.all });
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { ensureAuth } = useAuth();
  return useMutation({
    mutationFn: async ({
      designId,
      text,
      parentCommentId,
    }: {
      designId: string;
      text: string;
      parentCommentId?: string;
    }) => {
      await ensureAuth();
      return apiPost<unknown>(`/api/designs/${designId}/comments`, { text, parentCommentId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: designKeys.comments(variables.designId) });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  const { ensureAuth } = useAuth();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await ensureAuth();
      return apiDelete<unknown>(`/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: designKeys.all });
    },
  });
}
