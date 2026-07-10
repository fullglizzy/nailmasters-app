'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseLikeOptions {
  designId: string;
  initialLikesCount: number;
  initialIsLiked: boolean;
}

/**
 * Optimistic like toggle — guest & authenticated users share the same API path.
 *
 * - Syncs to parent-provided `initialIsLiked` and `initialLikesCount` when they change
 *   (e.g., after RQ cache refetch), UNLESS the user just performed a toggle.
 * - Optimistic UI: immediate toggle, server-authoritative count on response.
 * - Invalidates liked cache so Favorites tab & all cards see the change.
 */
export function useLike({ designId, initialLikesCount, initialIsLiked }: UseLikeOptions) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Track whether user just toggled — if so, skip syncing from parent props
  const justToggledRef = useRef(false);

  // Sync from parent when props change (e.g., RQ cache update after like invalidation)
  useEffect(() => {
    if (justToggledRef.current) {
      justToggledRef.current = false;
      return;
    }
    setIsLiked(initialIsLiked);
    setLikesCount(initialLikesCount);
  }, [initialIsLiked, initialLikesCount]);

  // Use refs for values that handleLike reads, so the callback is stable
  const isLikedRef = useRef(isLiked);
  isLikedRef.current = isLiked;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const handleLike = useCallback(async () => {
    if (isLoadingRef.current) return;
    setIsLoading(true);

    const wasLiked = isLikedRef.current;
    // Optimistic update
    setIsLiked(!wasLiked);
    setLikesCount((prev) => prev + (wasLiked ? -1 : 1));
    justToggledRef.current = true;

    const token = localStorage.getItem('token');
    if (!token) {
      // No auth — revert
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
      justToggledRef.current = false;
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
        // Server-authoritative values
        if (typeof json.data.likesCount === 'number') setLikesCount(json.data.likesCount);
        if (typeof json.data.liked === 'boolean') setIsLiked(json.data.liked);
        // Invalidate caches so all instances update
        queryClient.invalidateQueries({ queryKey: ['designs', 'liked'] });
        queryClient.invalidateQueries({ queryKey: ['designs', 'list'] });
      } else {
        // API error — revert
        setIsLiked(wasLiked);
        setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
        justToggledRef.current = false;
      }
    } catch {
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
      justToggledRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [designId, queryClient]); // stable — doesn't depend on isLiked/isLoading

  return { isLiked, likesCount, handleLike, isLoading };
}
