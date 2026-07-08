'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { DesignCard } from '@/components/design/design-card';

interface Design {
  id: string; title: string; images: string[]; likesCount: number; ordersCount: number;
}

export default function TrendingPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/designs/popular')
      .then(r => r.json())
      .then(j => { if (j.success) setDesigns(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
            <TrendingUp className="h-5 w-5 text-gold" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Тренды</p>
            <h1 className="font-display text-3xl">Популярное</h1>
          </div>
        </div>

        {designs.length === 0 ? (
          <div className="text-center py-20"><p className="text-muted-foreground">Пока нет популярных дизайнов</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {designs.map((d, i) => (
              <DesignCard key={d.id} design={d} rank={i + 1} href={`/explore/${d.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
