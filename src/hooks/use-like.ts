'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// ── Types ────────────────────────────────────────────────

interface UseLikeOptions {
  designId: string;
  initialLikesCount: number;
  /** The parent MUST provide this from a batch check (useLikedIds).
   *  Never default to false — that loses state on reload. */
  initialIsLiked: boolean;
}

// ── Hook ─────────────────────────────────────────────────

/**
 * Optimistic like toggle — same code path for guests and authenticated users.
 *
 * – Toggle calls POST /api/designs/:id/like with Bearer token.
 * – Guests have a token (created by GuestSessionProvider), so they use the same endpoint.
 * – initialIsLiked MUST be provided by the parent from a batch check (useLikedIds).
 * – Optimistic UI: immediate toggle, server-authoritative count on response.
 * – Invalidates liked-ids cache so Favorites tab and all DesignCards see the change instantly.
 * – Rollback on error.
 */
export function useLike({ designId, initialLikesCount, initialIsLiked }: UseLikeOptions) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleLike = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    const wasLiked = isLiked;
    // Optimistic update
    setIsLiked(!wasLiked);
    setLikesCount((prev) => prev + (wasLiked ? -1 : 1));

    const token = localStorage.getItem('token');
    if (!token) {
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/designs/${designId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.success && json.data) {
        // Server returns authoritative values
        if (typeof json.data.likesCount === 'number') {
          setLikesCount(json.data.likesCount);
        }
        if (typeof json.data.liked === 'boolean') {
          setIsLiked(json.data.liked);
        }
        // Invalidate liked-ids cache — Favorites tab & all DesignCards pick up the change
        queryClient.invalidateQueries({ queryKey: ['designs', 'liked'] });
        // Also invalidate design lists so like counts stay in sync
        queryClient.invalidateQueries({ queryKey: ['designs', 'list'] });
      } else {
        // API error — revert
        setIsLiked(wasLiked);
        setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
      }
    } catch {
      // Network error — revert
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
    } finally {
      setIsLoading(false);
    }
  }, [designId, isLiked, isLoading, queryClient]);

  return { isLiked, likesCount, handleLike, isLoading };
}
