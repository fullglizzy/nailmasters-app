'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, X, Filter } from 'lucide-react';
import { DesignCard } from '@/components/design/design-card';
import { AVAILABLE_COLORS, POPULAR_TAGS } from '@/data/colors';

interface Design {
  id: string; title: string; images: string[];
  likesCount: number; type: string; source: string;
  color: string | null; length: string | null; shape: string | null;
  season: string | null; tags: string[] | null; createdAt: string;
}

export default function DesignsCatalogPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Фильтры как в старом проекте
  const [designType, setDesignType] = useState('');
  const [source, setSource] = useState('');
  const [color, setColor] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [length, setLength] = useState('');
  const [shape, setShape] = useState('');
  const [season, setSeason] = useState('');

  const fetchDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (search) params.set('search', search);
      if (designType) params.set('type', designType);
      if (source) params.set('source', source);
      if (color) params.set('color', color);
      if (selectedTags.length) params.set('tags', selectedTags.join(','));
      if (length) params.set('length', length);
      if (shape) params.set('shape', shape);
      if (season) params.set('season', season);

      const res = await fetch(`/api/designs?${params}`);
      const json = await res.json();
      if (json.success) {
        setDesigns(json.data);
        if (json.pagination) setTotalPages(json.pagination.totalPages);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, designType, source, color, selectedTags, length, shape, season]);

  useEffect(() => { fetchDesigns(); }, [fetchDesigns]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchDesigns(); };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    setPage(1);
  };

  const addCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags((prev) => [...prev, newTag.trim()]);
      setPage(1);
    }
    setNewTag('');
  };

  const clearFilters = () => {
    setSearch(''); setDesignType(''); setSource(''); setColor('');
    setSelectedTags([]); setLength(''); setShape(''); setSeason('');
    setPage(1);
    setShowFilters(false);
  };

  const hasActiveFilters = designType || source || color || selectedTags.length > 0 || length || shape || season;

  const filterChipClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
      active ? 'bg-primary text-white border-primary' : 'hover:bg-accent'
    }`;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Каталог дизайнов</h1>
            <p className="text-muted-foreground mt-1">Найдите идеальный дизайн для вашего маникюра</p>
          </div>
          <Link href="/create" className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90">
            + Создать дизайн
          </Link>
        </div>

        {/* Search + Filter toggle */}
        <div className="flex gap-3 mb-4">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск дизайнов..."
              className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters ? 'bg-accent' : 'hover:bg-accent'
            }`}
          >
            <Filter className="h-4 w-4" /> Фильтры
          </button>
        </div>

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => { setDesignType(''); setPage(1); }} className={filterChipClass(!designType)}>Все типы</button>
          <button onClick={() => { setDesignType(designType === 'basic' ? '' : 'basic'); setPage(1); }} className={filterChipClass(designType === 'basic')}>Базовые</button>
          <button onClick={() => { setDesignType(designType === 'designer' ? '' : 'designer'); setPage(1); }} className={filterChipClass(designType === 'designer')}>Дизайнерские</button>
          <span className="w-px bg-border mx-1 self-stretch" />
          {['short', 'medium', 'long'].map((l) => (
            <button key={l} onClick={() => { setLength(length === l ? '' : l); setPage(1); }} className={filterChipClass(length === l)}>
              {l === 'short' ? 'Короткие' : l === 'medium' ? 'Средние' : 'Длинные'}
            </button>
          ))}
          <span className="w-px bg-border mx-1 self-stretch" />
          {['spring', 'summer', 'fall', 'winter'].map((s) => (
            <button key={s} onClick={() => { setSeason(season === s ? '' : s); setPage(1); }} className={filterChipClass(season === s)}>
              {s === 'spring' ? 'Весна' : s === 'summer' ? 'Лето' : s === 'fall' ? 'Осень' : 'Зима'}
            </button>
          ))}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="rounded-xl border bg-card p-6 mb-4 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Фильтры</h3>
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">Сбросить все</button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {/* Тип */}
              <div>
                <label className="block text-xs font-medium mb-1.5">Тип дизайна</label>
                <select value={designType} onChange={(e) => { setDesignType(e.target.value); setPage(1); }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">Все типы</option>
                  <option value="basic">Базовый</option>
                  <option value="designer">Дизайнерский</option>
                </select>
              </div>

              {/* Источник */}
              <div>
                <label className="block text-xs font-medium mb-1.5">Источник</label>
                <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">Все источники</option>
                  <option value="admin">Администратор</option>
                  <option value="master">Мастер</option>
                  <option value="client">Клиент</option>
                </select>
              </div>

              {/* Форма */}
              <div>
                <label className="block text-xs font-medium mb-1.5">Форма ногтей</label>
                <select value={shape} onChange={(e) => { setShape(e.target.value); setPage(1); }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">Все формы</option>
                  <option value="square">Квадрат</option>
                  <option value="soft_square">Мягкий квадрат</option>
                  <option value="almond">Миндаль</option>
                  <option value="oval">Овал</option>
                  <option value="stiletto">Стилет</option>
                  <option value="ballerina">Балерина</option>
                </select>
              </div>
            </div>

            {/* Color swatches */}
            <div>
              <label className="block text-xs font-medium mb-2">Основной цвет</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.name}
                    onClick={() => { setColor(color === c.value ? '' : c.value); setPage(1); }}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      color === c.value ? 'border-primary scale-125 shadow-md ring-2 ring-primary/30' : 'border-border hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium mb-2">Теги</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {POPULAR_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                      selectedTags.includes(tag) ? 'bg-primary text-white border-primary' : 'hover:bg-accent'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <form onSubmit={addCustomTag} className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Добавить свой тег..."
                  className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button type="submit" className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent">Добавить</button>
              </form>
            </div>
          </div>
        )}

        {/* Active filter badges */}
        {hasActiveFilters && !showFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {source && <Badge label={`Источник: ${source}`} onRemove={() => { setSource(''); setPage(1); }} />}
            {color && <Badge label={`Цвет: ${AVAILABLE_COLORS.find((c) => c.value === color)?.name || color}`} onRemove={() => { setColor(''); setPage(1); }} />}
            {selectedTags.map((tag) => (
              <Badge key={tag} label={`#${tag}`} onRemove={() => toggleTag(tag)} />
            ))}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground ml-2">Сбросить все</button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <div className="aspect-square skeleton rounded-none" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 skeleton" />
                  <div className="h-3 w-1/2 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Ничего не найдено</h3>
            <p className="text-muted-foreground mb-4 text-sm">Попробуйте изменить параметры поиска</p>
            <button onClick={clearFilters} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Очистить фильтры</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {designs.map((design) => (
                <DesignCard key={design.id} design={design} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-9 w-9 rounded-lg text-sm font-medium ${page === p ? 'bg-primary text-white' : 'border hover:bg-accent'}`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Badge component for active filters
function Badge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-foreground"><X className="h-3 w-3" /></button>
    </span>
  );
}
