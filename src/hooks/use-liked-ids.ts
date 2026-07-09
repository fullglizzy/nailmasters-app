'use client';

import { useMemo } from 'react';
import { useLikedDesigns } from '@/hooks/api';

/**
 * Returns a Set of liked design IDs for the current user.
 * Derives from useLikedDesigns — shares the same RQ cache, zero extra API calls.
 * Works for guests (with JWT) and authenticated users identically.
 */
export function useLikedIds(): Set<string> {
  const { data: designs = [] } = useLikedDesigns();

  return useMemo(
    () => new Set(designs.map((d) => d.id)),
    [designs],
  );
}
