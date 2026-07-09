'use client';

import { useState, useCallback } from 'react';
import { MapPin, Plus, Minus } from 'lucide-react';

interface MapHeaderProps {
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
  label?: string;
  /** Контент рядом с адресным лейблом (например, DistanceBadge) */
  children?: React.ReactNode;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return null;
  if (n === 0) return null; // координаты 0,0 — невалидны
  return n;
}

// Шаг зума: каждый уровень уменьшает/увеличивает бокс в ~1.6 раза
const ZOOM_FACTOR = 1.6;
const BASE_OFFSET = 0.0025; // ~300м вокруг точки
const MIN_ZOOM = -3;
const MAX_ZOOM = 4;

/**
 * Фоновая карта для шапки профиля мастера.
 * Использует iframe OpenStreetMap embed (бесплатно, без API-ключа).
 * Перетаскивание отключено — только масштабирование кнопками ±.
 */
export function MapHeader({ latitude, longitude, label, children }: MapHeaderProps) {
  const lat = toNum(latitude);
  const lon = toNum(longitude);
  const [zoomLevel, setZoomLevel] = useState(0);

  const zoomIn = useCallback(() => setZoomLevel((z) => Math.min(z + 1, MAX_ZOOM)), []);
  const zoomOut = useCallback(() => setZoomLevel((z) => Math.max(z - 1, MIN_ZOOM)), []);

  if (lat == null || lon == null) {
    return (
      <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden bg-gradient-to-br from-brand-100 via-rose-50 to-amber-50 dark:from-brand-950 dark:via-slate-900 dark:to-amber-950">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute bottom-4 left-4">
          <div className="rounded-full bg-background/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{label || 'Адрес не указан'}</span>
          </div>
        </div>
      </div>
    );
  }

  // Размер бокса зависит от уровня зума
  const scale = Math.pow(ZOOM_FACTOR, zoomLevel);
  const latOffset = BASE_OFFSET / scale;
  const lonOffset = (BASE_OFFSET / scale) / Math.cos((lat * Math.PI) / 180);
  const minLon = lon - lonOffset;
  const minLat = lat - latOffset;
  const maxLon = lon + lonOffset;
  const maxLat = lat + latOffset;

  // Кеш-бастинг по zoomLevel чтобы iframe перезагружался
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon.toFixed(6)},${minLat.toFixed(6)},${maxLon.toFixed(6)},${maxLat.toFixed(6)}&layer=mapnik&v=${zoomLevel}`;

  return (
    <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden bg-slate-200 dark:bg-slate-800">
      {/* pointer-events-none отключает перетаскивание. Смещение влево-вверх скрывает встроенные кнопки зума OSM */}
      <iframe
        src={embedUrl}
        className="absolute -top-[42px] -left-[42px] w-[calc(100%+84px)] h-[calc(100%+78px)] border-0 z-0 pointer-events-none"
        loading="lazy"
        title="Карта расположения мастера"
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Градиент снизу для читаемости */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none z-10" />

      {/* Пин-маркер по центру. +13px компенсирует смещение iframe (3px) + высоту острия пина (10px) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(80%+13px)] pointer-events-none z-20">
        <div className="flex flex-col items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          <div className="h-7 w-7 rounded-full bg-primary border-[3px] border-white flex items-center justify-center shadow-lg">
            <div className="h-2.5 w-2.5 rounded-full bg-white" />
          </div>
          <div className="h-5 w-[3px] bg-primary -mt-0.5 rounded-b shadow" />
        </div>
      </div>

      {/* Кнопки зума */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-0.5">
        <button
          onClick={zoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          className="flex h-8 w-8 items-center justify-center rounded-t-lg bg-background/85 backdrop-blur-sm border border-border/40 shadow-sm text-foreground hover:bg-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Приблизить карту"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          className="flex h-8 w-8 items-center justify-center rounded-b-lg bg-background/85 backdrop-blur-sm border border-border/40 border-t-0 shadow-sm text-foreground hover:bg-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Отдалить карту"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {/* Лейбл с адресом + доп. контент (расстояние и т.д.) */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between">
        <div className="rounded-full bg-background/85 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-sm border border-border/40 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[220px] sm:max-w-xs">{label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}</span>
        </div>
        {children && (
          <div className="rounded-full bg-background/85 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm border border-border/40">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
