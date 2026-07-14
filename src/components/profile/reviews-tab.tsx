'use client';

import { Star, MessageSquare } from 'lucide-react';
import { useMyReviews, useMasterReviews } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';

interface ReviewItem {
  id: string;
  ratingNumber: number;
  description: string | null;
  createdAt: string;
  nailMasterId: string;
  clientId: string;
  masterName?: string;
  clientName?: string;
  clientAvatar?: string | null;
}

export function ReviewsTab() {
  const { user } = useAuth();
  const role = user?.role || '';
  const userId = user?.id || '';

  const isMaster = role === 'nailmaster';

  // Master: show reviews clients left for THEM
  const { data: masterReviews = [], isLoading: masterLoading } = useMasterReviews(isMaster ? userId : undefined);
  // Client: show reviews THEY wrote
  const { data: clientReviews = [], isLoading: clientLoading } = useMyReviews();

  const reviews = isMaster ? (masterReviews || []) : (clientReviews || []);
  const isLoading = isMaster ? masterLoading : clientLoading;
  const reviewItems = reviews as ReviewItem[];

  if (isLoading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!reviewItems.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
        <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {role === 'nailmaster' ? 'Нет отзывов от клиентов' : 'Нет оставленных отзывов'}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        {role === 'nailmaster' ? 'Отзывы клиентов появятся здесь после выполнения заказов' : 'Ваши отзывы о мастерах появятся здесь'}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {reviewItems.map(r => (
        <div key={r.id} className="rounded-xl border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold shrink-0">
              {(r.clientName || r.masterName || '?').charAt(0)}
            </div>
            <div>
              {role === 'nailmaster' ? (
                <div className="text-sm font-medium">{r.clientName}</div>
              ) : (
                <a href={`/masters/${r.nailMasterId}`} className="text-sm font-medium hover:text-primary hover:underline">{r.masterName}</a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} className={`h-4 w-4 ${s <= r.ratingNumber ? 'fill-gold text-gold' : 'text-muted-foreground/20'}`} />
            ))}
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(r.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {r.description && <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>}
        </div>
      ))}
    </div>
  );
}
