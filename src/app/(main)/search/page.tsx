'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Search, X, Star, Clock, Calendar, MapPin,
  Trash2, RotateCcw, SlidersHorizontal, Sparkles, Wallet, Shield, Award,
  Scissors, Palette, Tag
} from 'lucide-react';
import { DesignCard } from '@/components/design/design-card';
import { MasterCard } from '@/components/master/master-card';
import { PolishSwatchGrid } from '@/components/shared/polish-swatch';
import { useDesigns } from '@/hooks/api';
import { useLikedIds } from '@/hooks/use-liked-ids';
import { AVAILABLE_COLORS } from '@/data/colors';

/* ───────────────────────────────────────────
   Constants
   ─────────────────────────────────────────── */
const HISTORY_KEY = 'nm_search_history';
const DEFAULT_SUGGESTIONS = [
  'маникюр идеи', 'френч дизайн', 'нюдовые ногти', 'кошачий глаз',
  'дизайн со стразами', 'градиент маникюр', 'минимализм', 'цветы на ногтях',
  'гелевый маникюр', 'маникюр омбре',
];

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */
interface DesignItem {
  id: string; title: string; images: string[]; videoUrl?: string | null;
  likesCount: number; ordersCount?: number;
  type: string; source: string; color: string | null;
  length: string | null; shape: string | null; season: string | null;
  serviceFormat: string | null; tags: string[] | null; techniques: string[] | null;
  materials: string[] | null; decorTags: string[] | null;
  occasionTags: string[] | null; moodTags: string[] | null;
}

interface MasterItem {
  userId: string; id?: string; fullName: string; username?: string;
  city: string | null; rating: string; startingPrice: string | null;
  experience: string | null; age?: number; specialties: string[] | null;
  workFormat: string[] | null; sterilization: boolean; disposableTools: boolean;
  totalOrders: number; reviewsCount: number; description: string | null;
}

/* ───────────────────────────────────────────
   Page
   ─────────────────────────────────────────── */
export default function SearchPage() {
  const router = useRouter();
  const likedIds = useLikedIds();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'designs' | 'masters'>('designs');
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [masters, setMasters] = useState<MasterItem[]>([]);
  const [didSearch, setDidSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // RQ for designs
  const { data: rqDesigns, isLoading: dLoading } = useDesigns(
    committedQuery && didSearch
      ? { search: committedQuery, limit: 40, includeOwn: true }
      : { limit: 0 },
  );

  /* Design filters */
  const [designFilters, setDesignFilters] = useState({
    type: '', source: '', color: '', length: '', shape: '',
    season: '', serviceFormat: '',
    tags: [] as string[], techniques: [] as string[], materials: [] as string[],
    decorTags: [] as string[], occasionTags: [] as string[], moodTags: [] as string[],
  });

  /* Master filters */
  const [masterFilters, setMasterFilters] = useState({
    specialties: [] as string[], city: '', minRating: '', minPrice: '', maxPrice: '',
    minAge: '', maxAge: '', minExperienceYears: '',
    sterilizationTags: [] as string[], availability: '',
    workFormat: [] as string[],
  });

  /* ── Keyboard shortcut: / focuses search ── */
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement === document.body) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);

  /* ── Load history ── */
  useEffect(() => {
    try { const raw = localStorage.getItem(HISTORY_KEY); if (raw) setHistory(JSON.parse(raw)); } catch {}
  }, []);

  const persistHistory = (next: string[]) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 10))); } catch {}
  };

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setCommittedQuery(trimmed);
    setQuery(trimmed);
    const next = [trimmed, ...history.filter(h => h.toLowerCase() !== trimmed.toLowerCase())];
    persistHistory(next);
    setDidSearch(true);
    setShowFilters(false);
    setDesignFilters({ type: '', source: '', color: '', length: '', shape: '', season: '', serviceFormat: '', tags: [], techniques: [], materials: [], decorTags: [], occasionTags: [], moodTags: [] });
    setMasterFilters({ specialties: [], city: '', minRating: '', minPrice: '', maxPrice: '', minAge: '', maxAge: '', minExperienceYears: '', sterilizationTags: [], availability: '', workFormat: [] });
  };

  /* ── Sync RQ designs → local state ── */
  useEffect(() => {
    if (!didSearch) return;
    const d = (rqDesigns || []) as DesignItem[];
    setDesigns(d);
  }, [rqDesigns, didSearch]);

  /* ── Fetch masters via /api/masters/search (dedicated endpoint) ── */
  useEffect(() => {
    if (!committedQuery || !didSearch) { setMasters([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/masters/search?q=${encodeURIComponent(committedQuery)}&limit=100`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const data = json.success && json.data ? json.data : {};
        const list: MasterItem[] = Array.isArray(data.masters) ? data.masters : Array.isArray(data) ? data : [];
        setMasters(list);
        if (designs.length === 0 && list.length > 0) setActiveTab('masters');
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedQuery, didSearch]);

  // Loading = RQ loading OR masters fetch loading
  const isSearchLoading = dLoading || loading;

  // Auto-switch to tab with results
  useEffect(() => {
    if (!didSearch || dLoading || loading) return;
    const dc = (rqDesigns || []).length;
    const mc = masters.length;
    if (dc > 0 && mc === 0) setActiveTab('designs');
    else if (dc === 0 && mc > 0) setActiveTab('masters');
  }, [didSearch, dLoading, loading, rqDesigns, masters]);

  /* ── Dynamic filter options ── */
  const availableDesignFilters = useMemo(() => ({
    types: [...new Set(designs.map(d => d.type).filter(Boolean))],
    sources: [...new Set(designs.map(d => d.source).filter(Boolean))],
    lengths: [...new Set(designs.map(d => d.length).filter(Boolean))],
    shapes: [...new Set(designs.map(d => d.shape).filter(Boolean))],
    seasons: [...new Set(designs.map(d => d.season).filter(Boolean))],
    serviceFormats: [...new Set(designs.map(d => d.serviceFormat).filter(Boolean))],
    allTags: [...new Set(designs.flatMap(d => d.tags || []).filter(Boolean))],
    allTechniques: [...new Set(designs.flatMap(d => d.techniques || []).filter(Boolean))],
    allMaterials: [...new Set(designs.flatMap(d => d.materials || []).filter(Boolean))],
    allDecorTags: [...new Set(designs.flatMap(d => d.decorTags || []).filter(Boolean))],
    allOccasionTags: [...new Set(designs.flatMap(d => d.occasionTags || []).filter(Boolean))],
    allMoodTags: [...new Set(designs.flatMap(d => d.moodTags || []).filter(Boolean))],
  }), [designs]);

  const availableMasterFilters = useMemo(() => ({
    specialties: [...new Set(masters.flatMap(m => m.specialties || []).filter(Boolean))],
    cities: [...new Set(masters.map(m => m.city).filter(Boolean))],
    workFormats: [...new Set(masters.flatMap(m => m.workFormat || []).filter(Boolean))],
  }), [masters]);

  const designTags = useMemo(() => [...new Set(designs.flatMap(d => d.tags || []).filter(Boolean))].slice(0, 10), [designs]);
  const masterSpecialties = useMemo(() => [...new Set(masters.flatMap(m => m.specialties || []).filter(Boolean))].slice(0, 10), [masters]);

  /* ── Client-side filtering ── */
  const filteredDesigns = useMemo(() => {
    let f = designs;
    if (designFilters.type) f = f.filter(d => d.type === designFilters.type);
    if (designFilters.source) f = f.filter(d => d.source === designFilters.source);
    if (designFilters.color) f = f.filter(d => d.color?.toLowerCase().includes(designFilters.color.toLowerCase()));
    if (designFilters.length) f = f.filter(d => d.length === designFilters.length);
    if (designFilters.shape) f = f.filter(d => d.shape === designFilters.shape);
    if (designFilters.season) f = f.filter(d => d.season === designFilters.season);
    if (designFilters.serviceFormat) f = f.filter(d => d.serviceFormat === designFilters.serviceFormat);
    if (designFilters.tags.length) f = f.filter(d => designFilters.tags.some(t => d.tags?.includes(t)));
    if (designFilters.techniques.length) f = f.filter(d => designFilters.techniques.some(t => d.techniques?.includes(t)));
    if (designFilters.materials.length) f = f.filter(d => designFilters.materials.some(m => d.materials?.includes(m)));
    if (designFilters.decorTags.length) f = f.filter(d => designFilters.decorTags.some(t => d.decorTags?.includes(t)));
    if (designFilters.occasionTags.length) f = f.filter(d => designFilters.occasionTags.some(t => d.occasionTags?.includes(t)));
    if (designFilters.moodTags.length) f = f.filter(d => designFilters.moodTags.some(t => d.moodTags?.includes(t)));
    return f;
  }, [designs, designFilters]);

  const filteredMasters = useMemo(() => {
    let f = masters;
    if (masterFilters.specialties.length) f = f.filter(m => masterFilters.specialties.some(s => m.specialties?.includes(s)));
    if (masterFilters.city) f = f.filter(m => m.city?.toLowerCase().includes(masterFilters.city.toLowerCase()));
    if (masterFilters.minRating) f = f.filter(m => Number(m.rating) >= Number(masterFilters.minRating));
    if (masterFilters.minPrice) f = f.filter(m => Number(m.startingPrice || 0) >= Number(masterFilters.minPrice));
    if (masterFilters.maxPrice) f = f.filter(m => Number(m.startingPrice || 0) <= Number(masterFilters.maxPrice));
    if (masterFilters.minAge) f = f.filter(m => m.age && Number(m.age) >= Number(masterFilters.minAge));
    if (masterFilters.maxAge) f = f.filter(m => m.age && Number(m.age) <= Number(masterFilters.maxAge));
    if (masterFilters.minExperienceYears) f = f.filter(m => { const exp = m.experience?.match(/(\d+)/); return exp && parseInt(exp[1]) >= Number(masterFilters.minExperienceYears); });
    if (masterFilters.sterilizationTags.length) f = f.filter(m => masterFilters.sterilizationTags.some(t => t === 'sterilization' ? m.sterilization : t === 'disposableTools' ? m.disposableTools : false));
    if (masterFilters.workFormat.length) f = f.filter(m => masterFilters.workFormat.some(fmt => m.workFormat?.includes(fmt === 'salon' ? 'salon' : fmt === 'home' ? 'home' : 'outcall')));
    return f;
  }, [masters, masterFilters]);

  /* ── Helpers ── */
  const switchTab = (tab: 'designs' | 'masters') => { setActiveTab(tab); setShowFilters(false); };
  const clearDesignFilters = () => setDesignFilters({ type: '', source: '', color: '', length: '', shape: '', season: '', serviceFormat: '', tags: [], techniques: [], materials: [], decorTags: [], occasionTags: [], moodTags: [] });
  const clearMasterFilters = () => setMasterFilters({ specialties: [], city: '', minRating: '', minPrice: '', maxPrice: '', minAge: '', maxAge: '', minExperienceYears: '', sterilizationTags: [], availability: '', workFormat: [] });

  const hasActiveDesignFilters = designFilters.type || designFilters.source || designFilters.color || designFilters.length || designFilters.shape || designFilters.season || designFilters.serviceFormat || designFilters.tags.length > 0 || designFilters.techniques.length > 0 || designFilters.materials.length > 0 || designFilters.decorTags.length > 0 || designFilters.occasionTags.length > 0 || designFilters.moodTags.length > 0;
  const hasActiveMasterFilters = masterFilters.specialties.length > 0 || masterFilters.city || masterFilters.minRating || masterFilters.minPrice || masterFilters.maxPrice || masterFilters.minAge || masterFilters.maxAge || masterFilters.minExperienceYears || masterFilters.sterilizationTags.length > 0 || masterFilters.availability || masterFilters.workFormat.length > 0;

  /* ── Shared chip style ── */
  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
      active ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
    }`;

  /* ───────────────────────────────────────────
     Render
     ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky search bar ── */}
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-3 py-3 md:px-6">
          {/* Back */}
          <button
            onClick={() => router.back()}
            aria-label="Назад"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Search field */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch(query); }}
              placeholder="Поиск дизайнов и мастеров..."
              aria-label="Поисковый запрос"
              className="h-10 w-full rounded-full border border-border/60 bg-background pl-10 pr-10 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                aria-label="Очистить поиск"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={() => runSearch(query)}
            className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Найти
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="mx-auto max-w-7xl space-y-6 px-3 pt-6 pb-24 md:px-6">
        {/* ── Pre-search: History + Suggestions ── */}
        {!didSearch && (
          <>
            {/* History */}
            {history.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">История поиска</h3>
                  <button
                    onClick={() => persistHistory([])}
                    aria-label="Очистить историю"
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map(h => (
                    <button
                      key={h}
                      onClick={() => runSearch(h)}
                      className="rounded-full border border-border/60 px-4 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Suggestions */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="inline h-3.5 w-3.5 mr-1.5" />
                  Популярные запросы
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {DEFAULT_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => runSearch(s)}
                    className="flex items-center gap-3 rounded-xl border border-border/40 px-4 py-2.5 text-sm text-left hover:bg-surface hover:border-border transition-all group"
                  >
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* No history, no suggestions — empty pre-search */}
            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="font-display text-xl mb-1">Поиск дизайнов и мастеров</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Введите запрос выше или выберите из популярных подсказок ниже
                </p>
                <p className="mt-3 text-xs text-muted-foreground/60">
                  Совет: нажмите <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-mono">/</kbd> для быстрого фокуса на поиске
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Results ── */}
        {didSearch && committedQuery && (
          <div className="space-y-5">
            {/* Results header */}
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Результаты поиска
                </p>
                <h1 className="font-display text-2xl">
                  &laquo;{committedQuery}&raquo;
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'designs'
                  ? `${filteredDesigns.length} ${pluralize(filteredDesigns.length, 'дизайн', 'дизайна', 'дизайнов')}`
                  : `${filteredMasters.length} ${pluralize(filteredMasters.length, 'мастер', 'мастера', 'мастеров')}`
                }
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-1 w-fit">
              <button
                onClick={() => switchTab('designs')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  activeTab === 'designs' ? 'bg-background shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Дизайны
                {designs.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{filteredDesigns.length}</span>
                )}
              </button>
              <button
                onClick={() => switchTab('masters')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  activeTab === 'masters' ? 'bg-background shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Мастера
                {masters.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{filteredMasters.length}</span>
                )}
              </button>
            </div>

            {/* Quick filter row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all flex items-center gap-1.5 ${
                  showFilters || (activeTab === 'designs' ? hasActiveDesignFilters : hasActiveMasterFilters)
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Фильтры
              </button>
              {(activeTab === 'designs' ? designTags : masterSpecialties).map(item => {
                const isDesigns = activeTab === 'designs';
                const isSelected = isDesigns
                  ? designFilters.tags.includes(item)
                  : masterFilters.specialties.includes(item);
                const onClick = isDesigns
                  ? () => setDesignFilters(f => ({ ...f, tags: f.tags.includes(item) ? f.tags.filter(t => t !== item) : [...f.tags, item] }))
                  : () => setMasterFilters(f => ({ ...f, specialties: f.specialties.includes(item) ? f.specialties.filter(s => s !== item) : [...f.specialties, item] }));
                return (
                  <button key={item} onClick={onClick} className={chipClass(isSelected)}>
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Expanded filter panel */}
            {showFilters && (
              <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                {activeTab === 'designs' ? (
                  <div className="space-y-4">
                    {/* ── Тип и источник ── */}
                    {(availableDesignFilters.types.length > 0 || availableDesignFilters.sources.length > 0) && (
                      <FilterGroup icon={Sparkles} title="Тип и источник">
                        <div className="flex flex-wrap gap-2">
                          {availableDesignFilters.types.map(v => (
                            <button key={v} onClick={() => setDesignFilters(f => ({ ...f, type: f.type === v ? '' : v }))}
                              className={chipClass(designFilters.type === v)}>
                              {v === 'basic' ? 'Базовый' : 'Дизайнерский'}
                            </button>
                          ))}
                          {availableDesignFilters.sources.map(v => (
                            <button key={v} onClick={() => setDesignFilters(f => ({ ...f, source: f.source === v ? '' : v }))}
                              className={chipClass(designFilters.source === v)}>
                              {v === 'admin' ? 'Админ' : v === 'client' ? 'Клиент' : 'Мастер'}
                            </button>
                          ))}
                        </div>
                      </FilterGroup>
                    )}

                    {/* ── Параметры: длина, форма, сезон ── */}
                    {(availableDesignFilters.lengths.length > 0 || availableDesignFilters.shapes.length > 0 || availableDesignFilters.seasons.length > 0) && (
                      <FilterGroup icon={Scissors} title="Параметры">
                        <div className="space-y-3">
                          {availableDesignFilters.lengths.length > 0 && (
                            <ChipRow label="Длина" items={availableDesignFilters.lengths} selected={[designFilters.length]} labels={{ short: 'Короткие', medium: 'Средние', long: 'Длинные' }}
                              onToggle={v => setDesignFilters(f => ({ ...f, length: f.length === v ? '' : v }))} />
                          )}
                          {availableDesignFilters.shapes.length > 0 && (
                            <ChipRow label="Форма" items={availableDesignFilters.shapes} selected={[designFilters.shape]}
                              labels={{ square: 'Квадрат', soft_square: 'Мягкий кв.', almond: 'Миндаль', oval: 'Овал', stiletto: 'Стилет', ballerina: 'Балерина' }}
                              onToggle={v => setDesignFilters(f => ({ ...f, shape: f.shape === v ? '' : v }))} />
                          )}
                          {availableDesignFilters.seasons.length > 0 && (
                            <ChipRow label="Сезон" items={availableDesignFilters.seasons} selected={[designFilters.season]}
                              labels={{ spring: 'Весна', summer: 'Лето', fall: 'Осень', winter: 'Зима' }}
                              onToggle={v => setDesignFilters(f => ({ ...f, season: f.season === v ? '' : v }))} />
                          )}
                          {availableDesignFilters.serviceFormats.length > 0 && (
                            <ChipRow label="Формат услуги" items={availableDesignFilters.serviceFormats} selected={[designFilters.serviceFormat]}
                              labels={{ salon: 'Салон', home: 'На дому' }}
                              onToggle={v => setDesignFilters(f => ({ ...f, serviceFormat: f.serviceFormat === v ? '' : v }))} />
                          )}
                        </div>
                      </FilterGroup>
                    )}

                    {/* ── Цвет ── */}
                    <FilterGroup icon={Palette} title="Цвет">
                      <PolishSwatchGrid
                        colors={AVAILABLE_COLORS}
                        selected={designFilters.color}
                        onSelect={(v) => setDesignFilters(f => ({ ...f, color: f.color === v ? '' : v }))}
                      />
                    </FilterGroup>

                    {/* ── Детали: теги, техники, материалы и т.д. ── */}
                    {(availableDesignFilters.allTags.length > 0 || availableDesignFilters.allTechniques.length > 0 || availableDesignFilters.allMaterials.length > 0 || availableDesignFilters.allDecorTags.length > 0 || availableDesignFilters.allMoodTags.length > 0 || availableDesignFilters.allOccasionTags.length > 0) && (
                      <FilterGroup icon={Tag} title="Детали">
                        <div className="space-y-3">
                          {availableDesignFilters.allTags.length > 0 && (
                            <FilterChipSection label="Теги" items={availableDesignFilters.allTags.slice(0, 20)} selected={designFilters.tags} onToggle={tag => setDesignFilters(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }))} />
                          )}
                          {availableDesignFilters.allTechniques.length > 0 && (
                            <FilterChipSection label="Техники" items={availableDesignFilters.allTechniques.slice(0, 20)} selected={designFilters.techniques} onToggle={t => setDesignFilters(f => ({ ...f, techniques: f.techniques.includes(t) ? f.techniques.filter(x => x !== t) : [...f.techniques, t] }))} />
                          )}
                          {availableDesignFilters.allMaterials.length > 0 && (
                            <FilterChipSection label="Материалы" items={availableDesignFilters.allMaterials.slice(0, 20)} selected={designFilters.materials} onToggle={m => setDesignFilters(f => ({ ...f, materials: f.materials.includes(m) ? f.materials.filter(x => x !== m) : [...f.materials, m] }))} />
                          )}
                          {availableDesignFilters.allDecorTags.length > 0 && (
                            <FilterChipSection label="Декор" items={availableDesignFilters.allDecorTags.slice(0, 20)} selected={designFilters.decorTags} onToggle={d => setDesignFilters(f => ({ ...f, decorTags: f.decorTags.includes(d) ? f.decorTags.filter(x => x !== d) : [...f.decorTags, d] }))} />
                          )}
                          {availableDesignFilters.allMoodTags.length > 0 && (
                            <FilterChipSection label="Настроение" items={availableDesignFilters.allMoodTags.slice(0, 20)} selected={designFilters.moodTags} onToggle={m => setDesignFilters(f => ({ ...f, moodTags: f.moodTags.includes(m) ? f.moodTags.filter(x => x !== m) : [...f.moodTags, m] }))} />
                          )}
                          {availableDesignFilters.allOccasionTags.length > 0 && (
                            <FilterChipSection label="Повод" items={availableDesignFilters.allOccasionTags.slice(0, 20)} selected={designFilters.occasionTags} onToggle={o => setDesignFilters(f => ({ ...f, occasionTags: f.occasionTags.includes(o) ? f.occasionTags.filter(x => x !== o) : [...f.occasionTags, o] }))} />
                          )}
                        </div>
                      </FilterGroup>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* ── Локация ── */}
                    <FilterGroup icon={MapPin} title="Локация и формат">
                      <div className="grid sm:grid-cols-2 gap-3">
                        {availableMasterFilters.cities.length > 0 && (
                          <FilterSelect label="Город" value={masterFilters.city} onChange={v => setMasterFilters(f => ({ ...f, city: v }))} options={availableMasterFilters.cities.map(v => ({ value: v, label: v }))} />
                        )}
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Формат работы</label>
                          <div className="flex gap-1.5">
                            {[{ v: 'salon', l: 'Салон' }, { v: 'home', l: 'На дому' }].map(f => {
                              const active = masterFilters.workFormat.includes(f.v);
                              return (
                                <button key={f.v} onClick={() => setMasterFilters(mf => ({ ...mf, workFormat: mf.workFormat.includes(f.v) ? mf.workFormat.filter(x => x !== f.v) : [...mf.workFormat, f.v] }))}
                                  className={`flex-1 rounded-full py-2 text-xs font-medium border transition-all ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'}`}
                                >{f.l}</button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </FilterGroup>

                    {/* ── Бюджет ── */}
                    <FilterGroup icon={Wallet} title="Бюджет">
                      <div className="flex items-center gap-3">
                        <label className="flex-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">От</span>
                          <div className="relative">
                            <input
                              type="number" min="0" placeholder="0" value={masterFilters.minPrice}
                              onChange={e => setMasterFilters(f => ({ ...f, minPrice: e.target.value }))}
                              className="w-full rounded-xl border border-border/60 bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                          </div>
                        </label>
                        <span className="mt-5 text-sm text-muted-foreground">—</span>
                        <label className="flex-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">До</span>
                          <div className="relative">
                            <input
                              type="number" min="0" placeholder="10000" value={masterFilters.maxPrice}
                              onChange={e => setMasterFilters(f => ({ ...f, maxPrice: e.target.value }))}
                              className="w-full rounded-xl border border-border/60 bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                          </div>
                        </label>
                      </div>
                    </FilterGroup>

                    {/* ── Качество ── */}
                    <FilterGroup icon={Star} title="Рейтинг и опыт">
                      {/* Rating */}
                      <div className="mb-3">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Минимальный рейтинг</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(r => (
                            <button
                              key={r}
                              onClick={() => setMasterFilters(f => ({ ...f, minRating: f.minRating === String(r) ? '' : String(r) }))}
                              aria-label={`Рейтинг от ${r}`}
                              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
                                Number(masterFilters.minRating || 0) >= r
                                  ? 'bg-gold text-gold-foreground shadow-sm'
                                  : 'border border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <Star className={`h-4 w-4 ${Number(masterFilters.minRating || 0) >= r ? 'fill-current' : ''}`} />
                              {r}
                            </button>
                          ))}
                          {masterFilters.minRating && (
                            <button
                              onClick={() => setMasterFilters(f => ({ ...f, minRating: '' }))}
                              className="ml-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                              aria-label="Сбросить рейтинг"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Experience presets */}
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Опыт работы</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ v: '1', l: 'От 1 года' }, { v: '3', l: 'От 3 лет' }, { v: '5', l: 'От 5 лет' }, { v: '10', l: 'От 10 лет' }].map(e => {
                            const active = masterFilters.minExperienceYears === e.v;
                            return (
                              <button
                                key={e.v}
                                onClick={() => setMasterFilters(f => ({ ...f, minExperienceYears: f.minExperienceYears === e.v ? '' : e.v }))}
                                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                                  active ? 'bg-primary text-primary-foreground' : 'border border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                                }`}
                              >{e.l}</button>
                            );
                          })}
                        </div>
                      </div>
                    </FilterGroup>

                    {/* ── Безопасность ── */}
                    <FilterGroup icon={Shield} title="Гигиена">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { v: 'sterilization', l: 'Стерилизация инструментов', icon: Sparkles },
                          { v: 'disposableTools', l: 'Одноразовые материалы', icon: Shield },
                        ].map(t => {
                          const active = masterFilters.sterilizationTags.includes(t.v);
                          return (
                            <button
                              key={t.v}
                              onClick={() => setMasterFilters(f => ({ ...f, sterilizationTags: f.sterilizationTags.includes(t.v) ? f.sterilizationTags.filter(x => x !== t.v) : [...f.sterilizationTags, t.v] }))}
                              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                                active ? 'bg-secondary text-secondary-foreground border-secondary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <t.icon className="h-4 w-4" />
                              {t.l}
                            </button>
                          );
                        })}
                      </div>
                    </FilterGroup>

                    {/* ── Доступность ── */}
                    <FilterGroup icon={Calendar} title="Когда">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { v: 'today', l: 'Сегодня', icon: Clock },
                          { v: 'week', l: 'На этой неделе', icon: Calendar },
                          { v: 'evening', l: 'Вечерние часы', icon: Clock },
                          { v: 'weekend', l: 'Выходные', icon: Calendar },
                        ].map(a => {
                          const active = masterFilters.availability === a.v;
                          return (
                            <button
                              key={a.v}
                              onClick={() => setMasterFilters(f => ({ ...f, availability: f.availability === a.v ? '' : a.v }))}
                              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                                active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <a.icon className="h-4 w-4" />
                              {a.l}
                            </button>
                          );
                        })}
                      </div>
                    </FilterGroup>

                    {/* ── Специальности ── */}
                    {availableMasterFilters.specialties.length > 0 && (
                      <FilterGroup icon={Award} title="Специальности">
                        <FilterChipSection label="" items={availableMasterFilters.specialties.slice(0, 20)} selected={masterFilters.specialties} onToggle={s => setMasterFilters(f => ({ ...f, specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s] }))} />
                      </FilterGroup>
                    )}
                  </div>
                )}
                {/* Reset */}
                <div className="pt-3 border-t border-border/30">
                  <button
                    onClick={activeTab === 'designs' ? clearDesignFilters : clearMasterFilters}
                    className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              </div>
            )}

            {/* ── Results content ── */}
            {isSearchLoading ? (
              /* Skeleton loading */
              <div className={activeTab === 'designs' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'grid gap-4 md:grid-cols-2'}>
                {Array.from({ length: activeTab === 'designs' ? 8 : 4 }).map((_, i) => (
                  <div key={i} className={activeTab === 'designs'
                    ? 'rounded-2xl border border-border/40 bg-card overflow-hidden'
                    : 'flex gap-4 rounded-xl border border-border/40 bg-card p-4'
                  }>
                    {activeTab === 'designs' ? (
                      <>
                        <div className="aspect-[4/5] skeleton rounded-none" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 w-3/4 skeleton" />
                          <div className="h-3 w-1/2 skeleton" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-14 w-14 rounded-full skeleton shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-2/3 skeleton" />
                          <div className="h-4 w-1/3 skeleton" />
                          <div className="h-3 w-full skeleton" />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : activeTab === 'designs' ? (
              filteredDesigns.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Дизайны не найдены"
                  description={hasActiveDesignFilters ? 'Попробуйте изменить или сбросить фильтры' : `По запросу «${committedQuery}» ничего не найдено`}
                  action={hasActiveDesignFilters ? { label: 'Сбросить фильтры', onClick: clearDesignFilters } : undefined}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-6">
                  {filteredDesigns.map((d, i) => (
                    <DesignCard key={d.id} design={d} delay={Math.min(i * 30, 300)} isLiked={likedIds.has(d.id)} />
                  ))}
                </div>
              )
            ) : (
              filteredMasters.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="Мастера не найдены"
                  description={hasActiveMasterFilters ? 'Попробуйте изменить или сбросить фильтры' : `По запросу «${committedQuery}» мастера не найдены`}
                  action={hasActiveMasterFilters ? { label: 'Сбросить фильтры', onClick: clearMasterFilters } : undefined}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 pb-6">
                  {filteredMasters.map((m, i) => (
                    <MasterCard key={m.userId || m.id} master={m} delay={Math.min(i * 40, 300)} />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────── */

function FilterGroup({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/[0.06]">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {action && (
        <button onClick={action.onClick} className="rounded-full border border-border/60 px-5 py-2 text-sm font-medium hover:bg-surface transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string | null; onChange: (v: string) => void;
  options: { value: string | null; label: string | null }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
      >
        <option value="">Все</option>
        {options.filter(o => o.value != null).map(o => (
          <option key={o.value} value={o.value!}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type="number" min="0" value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
      />
    </div>
  );
}

function ChipRow({ label, items, selected, labels, onToggle }: {
  label: string; items: (string | null)[]; selected: string[]; labels?: Record<string, string>; onToggle: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {items.filter((v): v is string => v != null).map(v => {
          const active = selected.includes(v);
          return (
            <button key={v} type="button" onClick={() => onToggle(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
              }`}>
              {labels?.[v] || v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterChipSection({ label, items, selected, onToggle }: {
  label: string; items: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  if (!items.length) return null;
  const chip = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
      active ? 'bg-primary text-primary-foreground' : 'border border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div>
      {label && <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>}
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {items.map(item => (
          <button key={item} onClick={() => onToggle(item)} className={chip(selected.includes(item))}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Russian plural helper ── */
function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
