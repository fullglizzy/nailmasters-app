'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DesignCard } from '@/components/design/design-card';
import { Sparkles, ArrowRight } from 'lucide-react';

interface DesignListItem {
  id: string;
  title: string;
  images?: string[];
  videoUrl?: string | null;
  likesCount?: number;
  isLiked?: boolean;
  tags?: string[];
}

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
  const [items, setItems] = useState<DesignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedTag = searchParams.get('tag') || 'all';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/designs?page=1&limit=40&includeOwn=true&sort=popular');
        const json = await res.json();
        if (json.success && json.data) setItems(json.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return items;
    return items.filter((d) =>
      d.tags?.some((t: string) => t.toLowerCase() === selectedTag),
    );
  }, [items, selectedTag]);

  const featured = items[0];

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-8 md:pt-20 md:pb-16">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <div className="h-6 w-40 skeleton rounded-full" />
            <div className="space-y-3">
              <div className="h-12 w-3/4 skeleton" />
              <div className="h-12 w-1/2 skeleton" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full skeleton" />
              <div className="h-4 w-5/6 skeleton" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-40 skeleton rounded-full" />
              <div className="h-10 w-36 skeleton rounded-full" />
            </div>
          </div>
          <div className="aspect-[4/5] skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Hero masthead ── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-8 md:pt-20 md:pb-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            {/* Hero copy */}
            <div className="space-y-6 animate-reveal" style={{ animationDelay: '0.1s' }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                Каталог дизайнов
              </div>

              <h1 className="font-display text-4xl leading-[1.1] tracking-tight md:text-5xl lg:text-6xl text-balance">
                Искусство<br />
                <span className="text-primary">на кончиках</span>{' '}
                пальцев
              </h1>

              <p className="max-w-md text-base text-muted-foreground leading-relaxed">
                Найдите свой стиль среди тысяч дизайнов, выберите мастера поблизости
                и запишитесь на маникюр в пару касаний.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Смотреть ленту
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface transition-colors"
                >
                  Найти мастера
                </Link>
              </div>
            </div>

            {/* Hero visual — featured design treated as editorial art */}
            {featured && (
              <Link
                href={`/explore/${featured.id}`}
                className="group relative block animate-reveal gloss-highlight rounded-2xl overflow-hidden"
                style={{
                  animationDelay: '0.3s',
                  aspectRatio: '4 / 5',
                  maxHeight: 'min(560px, 70vh)',
                }}
              >
                <img
                  src={featured.images?.[0] || '/placeholder.svg'}
                  alt={featured.title}
                  fetchPriority="high"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-xs font-medium uppercase tracking-widest text-white/60 mb-1">
                    Выбор редакции
                  </p>
                  <h2 className="text-xl font-semibold text-white leading-tight">
                    {featured.title}
                  </h2>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

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
                delay={Math.min(i * 40, 600)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
