'use client';

import { Upload } from 'lucide-react';
import { DesignCard } from '@/components/design/design-card';
import { useDesigns } from '@/hooks/api';
import { useLikedIds } from '@/hooks/use-liked-ids';
import { useAuth } from '@/components/providers/auth-provider';
import type { Design } from '@/lib/types';

export function UploadsTab() {
  const { data: allDesigns = [], isLoading } = useDesigns({ includeOwn: true, limit: 100 });
  const likedIds = useLikedIds();
  const { user } = useAuth();

  const userId = user?.id || '';

  const designs = (allDesigns || []).filter((d: Design) =>
    d.uploadedByClientId === userId || d.uploadedByMasterId === userId
  );

  if (isLoading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!designs.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
        <Upload className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Нет загруженных дизайнов</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Создайте новый дизайн — он появится здесь</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {designs.map(d => <DesignCard key={d.id} design={d} isLiked={likedIds.has(d.id)} />)}
    </div>
  );
}
