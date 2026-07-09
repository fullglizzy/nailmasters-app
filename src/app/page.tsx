'use client';

import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DesignCard } from '@/components/design/design-card';
import { useDesigns } from '@/hooks/api';
import { useLikedIds } from '@/hooks/use-liked-ids';

const FEATURED_TAGS = [
  { key: 'all', label: 'Всё' },
  { key: 'френч', label: 'Френч' },
  { key: 'омбре', label: 'Омбре' },
  { key: 'минимализм', label: 'Минимализм' },
  { key: 'стразы', label: 'Стразы' },
  { key: 'nude', label: 'Nude' },
  { key: 'кошачий глаз', label: 'Кошачий глаз' },
];

export default function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedTag = searchParams.get('tag') || 'all';

  const { data: items = [], isLoading } = useDesigns({
    sort: 'popular',
    includeOwn: true,
    limit: 40,
  });

  // Batch load liked state — 1 API call for all cards, not N
  const likedIds = useLikedIds();

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return items;
    return items.filter((d) =>
      d.tags?.some((t: string) => t.toLowerCase() === selectedTag),
    );
  }, [items, selectedTag]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Tag chips ── */}
      <section className="border-y border-border/50">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {FEATURED_TAGS.map((tag) => (
              <button
                key={tag.key}
                onClick={() => router.push(tag.key === 'all' ? '/' : `/?tag=${tag.key}`, { scroll: false })}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  selectedTag === tag.key
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:bg-surface text-muted-foreground hover:text-foreground'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Design mosaic ── */}
      <section className="mx-auto max-w-7xl px-3 md:px-6 pt-6 pb-24">
        {filtered.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="text-6xl mb-4">💅</div>
            <div className="text-lg font-medium">Дизайны не найдены</div>
            <p className="mt-1 text-sm opacity-80">
              {selectedTag !== 'all'
                ? 'Попробуйте выбрать другой тег.'
                : 'Пока нет доступных дизайнов. Будьте первым!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((d, i) => (
              <DesignCard
                key={d.id}
                design={d}
                isLiked={likedIds.has(d.id)}
                delay={Math.min(i * 40, 600)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
