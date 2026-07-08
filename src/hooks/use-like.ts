'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface UseLikeOptions {
  designId: string;
  initialLikesCount: number;
  initialIsLiked: boolean;
}

function getGuestLikes(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('guest_likes') || '[]')); } catch { return new Set(); }
}
function saveGuestLikes(likes: Set<string>) {
  localStorage.setItem('guest_likes', JSON.stringify([...likes]));
}

export function useLike({ designId, initialLikesCount, initialIsLiked }: UseLikeOptions) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLoading, setIsLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check actual like status on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.isGuest) {
      // Guest: restore from localStorage
      const guestLikes = getGuestLikes();
      setIsLiked(guestLikes.has(designId));
      setChecked(true);
      return;
    }
    const currentToken = localStorage.getItem('token');
    if (!currentToken) { setChecked(true); return; }
    fetch(`/api/designs/${designId}/like-status`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) setIsLiked(json.data.liked);
      })
      .finally(() => setChecked(true));
  }, [designId]);

  const handleLike = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev) => prev + (wasLiked ? -1 : 1));

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.isGuest) {
        // Guest: local-only like, persist in localStorage
        const guestLikes = getGuestLikes();
        if (isLiked) {
          guestLikes.delete(designId);
        } else {
          guestLikes.add(designId);
        }
        saveGuestLikes(guestLikes);
        return;
      }
      const currentToken = localStorage.getItem('token');
      const res = await fetch(`/api/designs/${designId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const json = await res.json();
      if (json.success && json.data?.likesCount !== undefined) {
        setLikesCount(json.data.likesCount);
      }
    } catch {
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
    } finally {
      setIsLoading(false);
    }
  }, [designId, isLiked, isLoading]);

  return { isLiked, likesCount, handleLike, isLoading, canLike: true };
}
