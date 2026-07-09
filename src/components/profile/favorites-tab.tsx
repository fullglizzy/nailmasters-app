'use client';

import { Heart } from 'lucide-react';
import { DesignCard } from '@/components/design/design-card';
import { useLikedDesigns } from '@/hooks/api';

/**
 * Favorites tab — works identically for guests and authenticated users.
 * Both have JWT tokens, both use the same GET /api/designs/liked endpoint.
 */
export function FavoritesTab() {
  const { data: designs = [], isLoading } = useLikedDesigns();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!designs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
          <Heart className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Нет избранных дизайнов</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Добавляйте дизайны в избранное, нажимая на сердечко
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {designs.map((d) => (
        <DesignCard key={d.id} design={d} href={`/explore/${d.id}`} isLiked={true} />
      ))}
    </div>
  );
}
