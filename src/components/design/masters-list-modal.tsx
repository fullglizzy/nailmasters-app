'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import Link from 'next/link';
import { X, Star, MapPin, Navigation, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { DistanceBadge } from '@/components/shared/distance-badge';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useDesignMasters } from '@/hooks/api';
import { pluralRu } from '@/lib/utils';
import type { Master } from '@/lib/types';

/* ── Types ──────────────────────────────────────────────── */

interface Props {
  designId: string;
  designTitle: string;
  open: boolean;
  onClose: () => void;
}

type SortKey = 'distance' | 'price' | 'rating';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: 'Ближе' },
  { key: 'price', label: 'Дешевле' },
  { key: 'rating', label: 'Рейтинг' },
];

/* ── Helpers ────────────────────────────────────────────── */

function getNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) || n === 0 ? null : n;
}

function getPrice(m: Master & { _price?: string | number | null }): number | null {
  return getNum(m._price) || getNum((m as Record<string, unknown>).startingPrice as string);
}

function getDuration(m: Master & { _duration?: string | number | null }): number | null {
  return getNum(m._duration) || getNum((m as Record<string, unknown>)._masterDuration as string);
}

/* ── Memoized Master Row ────────────────────────────────── */

interface MasterRowProps {
  master: Master & { _price?: string | number | null; _duration?: string | number | null };
  rank: number;
  isClosest: boolean;
  designId: string;
  clientLat: number | null;
  clientLon: number | null;
}

const MasterRow = memo(function MasterRow({ master, rank, isClosest, designId, clientLat, clientLon }: MasterRowProps) {
  const price = getPrice(master);
  const duration = getDuration(master);

  return (
    <Link
      href={`/masters/${master.userId}?bookDesign=${designId}`}
      className="group flex items-center gap-4 rounded-xl border border-border/40 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
    >
      {/* Rank or avatar */}
      <div className="relative shrink-0">
        <div className="h-12 w-12 rounded-full bg-primary/8 flex items-center justify-center text-lg font-display text-primary">
          {master.fullName.charAt(0)}
        </div>
        {isClosest && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
            Ближе
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {master.fullName}
          </span>
          {master.rating && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-gold shrink-0">
              <Star className="h-3 w-3 fill-current" />
              {master.rating}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {master.city && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3 opacity-60" />{master.city}
            </span>
          )}
          <DistanceBadge
            masterLat={getNum(master.latitude)}
            masterLon={getNum(master.longitude)}
            clientLat={clientLat}
            clientLon={clientLon}
          />
        </div>
      </div>

      {/* Price + CTA */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          {price ? (
            <div className="font-bold text-sm text-foreground">
              ${price.toLocaleString('en-US')}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Договорная</div>
          )}
          {duration && (
            <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-0.5">
              <Clock className="h-2.5 w-2.5" />~{duration} мин
            </div>
          )}
        </div>
        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 shrink-0">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
});

/* ═════════════════════════════════════════════════════════
   MastersListModal
   ═════════════════════════════════════════════════════════ */

export function MastersListModal({ designId, designTitle, open, onClose }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const { coords: clientCoords, request: requestGeo } = useGeolocation();
  const [clientPlace, setClientPlace] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('distance');

  /* ── Reverse geocode for place label ─────────────────── */
  useEffect(() => {
    if (!clientCoords) return;
    const { latitude, longitude } = clientCoords;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&accept-language=ru`;
    fetch(url, { headers: { 'User-Agent': 'NailMasters/2.0' } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.address) {
          const a = data.address;
          const road = a.road || a.pedestrian || a.path || '';
          const house = a.house_number || '';
          const street = [road, house].filter(Boolean).join(', ');
          const suburb = a.suburb || a.neighbourhood || a.city_district || '';
          const city = a.city || a.town || a.village || '';
          const place = [street || suburb, city].filter(Boolean).join(', ');
          setClientPlace(place || a.county || a.state || '');
        }
      })
      .catch(() => {});
  }, [clientCoords]);

  /* ── Request geolocation on open ─────────────────────── */
  useEffect(() => {
    if (open) requestGeo();
  }, [open]);

  /* ── Data ────────────────────────────────────────────── */
  const { data: mastersData, isLoading } = useDesignMasters(open ? designId : undefined);
  const masters = (mastersData || []) as (Master & { _price?: string | number | null; _duration?: string | number | null })[];

  const hasCoords = clientCoords?.latitude != null && clientCoords?.longitude != null;

  /* ── Sorted masters ──────────────────────────────────── */
  const sortedMasters = useMemo(() => {
    const list = [...masters];
    switch (sortBy) {
      case 'price': {
        // Sort by price ascending (null/0 prices go last)
        list.sort((a, b) => {
          const pa = getPrice(a);
          const pb = getPrice(b);
          if (!pa && !pb) return 0;
          if (!pa) return 1;
          if (!pb) return -1;
          return pa - pb;
        });
        break;
      }
      case 'rating':
        list.sort((a, b) => (parseFloat(b.rating || '0') - parseFloat(a.rating || '0')));
        break;
      case 'distance':
      default:
        // Already sorted by API, keep original order
        break;
    }
    return list;
  }, [masters, sortBy]);

  const minPrice = useMemo(() => {
    if (!masters.length) return null;
    const prices = masters.map((m) => getPrice(m)).filter((p): p is number => p !== null && p > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [masters]);

  /* ── Price range for header ──────────────────────────── */
  const priceRange = useMemo(() => {
    if (!masters.length) return null;
    const prices = masters.map((m) => getPrice(m)).filter((p): p is number => p !== null && p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min}`;
    return `от $${min.toLocaleString('en-US')} до $${max}`;
  }, [masters]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Мастера для этого дизайна"
        className="relative z-10 w-full sm:max-w-md max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background shadow-xl modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-4 border-b space-y-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg leading-tight">
                Кто сделает &laquo;{designTitle}&raquo;?
              </h2>
              {masters.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {masters.length} {pluralRu(masters.length, 'мастер', 'мастера', 'мастеров')}
                  {priceRange && <span className="ml-1.5 font-medium text-foreground">{priceRange}</span>}
                </p>
              )}
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50 shrink-0 ml-2">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sort row */}
          {masters.length > 1 && (
            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  disabled={opt.key === 'distance' && !hasCoords}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    sortBy === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  } ${opt.key === 'distance' && !hasCoords ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Location info */}
        {hasCoords && masters.length > 0 && !isLoading && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 rounded-lg bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                Расстояние от:{' '}
                <span className="font-medium text-foreground">{clientPlace || 'вас'}</span>
              </span>
            </div>
          </div>
        )}

        {/* Geolocation fallback */}
        {!hasCoords && !isLoading && masters.length > 0 && (
          <div className="px-4 pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); requestGeo(); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-accent/30 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/50 transition-all active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" />
              Определить расстояние до мастеров
            </button>
          </div>
        )}

        {/* Master list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : sortedMasters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/30">
                <Sparkles className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Пока нет мастеров для этого дизайна</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Мастер может добавить этот дизайн через «Я так могу»</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedMasters.map((m, i) => (
                <MasterRow
                  key={m.userId}
                  master={m}
                  rank={i + 1}
                  isClosest={sortBy === 'distance' && i === 0 && hasCoords}
                  designId={designId}
                  clientLat={clientCoords?.latitude ?? null}
                  clientLon={clientCoords?.longitude ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────── */

