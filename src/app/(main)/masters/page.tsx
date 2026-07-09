'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, MapPin, Star, Award, Shield, X, Navigation } from 'lucide-react';
import { MastersFiltersPanel } from '@/components/master/masters-filters-panel';
import { MasterCard } from '@/components/master/master-card';
import { useGeolocation } from '@/hooks/use-geolocation';
import { sortByDistance } from '@/lib/geo';

interface Master {
  userId: string; fullName: string; description: string | null; city: string | null;
  rating: string; totalOrders: number; reviewsCount: number; specialties: string[] | null;
  startingPrice: string | null; experience: string | null; workFormat: string[] | null;
  sterilization: boolean; disposableTools: boolean;
  latitude?: number | string | null; longitude?: number | string | null;
}

export default function MastersPage() {
  const [allMasters, setAllMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'experience' | 'price' | 'distance'>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const { coords: clientCoords, request: requestGeo } = useGeolocation();
  const [nearMe, setNearMe] = useState(false);

  useEffect(() => { requestGeo(); }, []);

  useEffect(() => {
    fetch('/api/masters?limit=100')
      .then((r) => r.json())
      .then((json) => { if (json.success) setAllMasters(json.data); })
      .finally(() => setLoading(false));
  }, []);

  // Клиентская фильтрация (как в старом проекте)
  const filteredMasters = useMemo(() => {
    let filtered = [...allMasters];

    // Поиск по имени, описанию, специальностям
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((m) =>
        m.fullName?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.specialties?.some((s) => s.toLowerCase().includes(q))
      );
    }

    // Город
    if (selectedCity) {
      filtered = filtered.filter((m) =>
        m.city?.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    // Специальность
    if (selectedSpecialty) {
      filtered = filtered.filter((m) =>
        m.specialties?.includes(selectedSpecialty)
      );
    }

    // Сортировка
    if (sortBy === 'distance' && clientCoords) {
      // @ts-expect-error sortByDistance adds distance field to items
      filtered = sortByDistance(filtered, clientCoords.latitude, clientCoords.longitude,
        m => typeof m.latitude === 'string' ? parseFloat(m.latitude) : (m.latitude ?? null),
        m => typeof m.longitude === 'string' ? parseFloat(m.longitude) : (m.longitude ?? null),
      );
    } else {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'rating':
            return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
          case 'experience':
            return (b.experience || '').localeCompare(a.experience || '');
          case 'price':
            return (parseFloat(a.startingPrice || '0') || 0) - (parseFloat(b.startingPrice || '0') || 0);
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [allMasters, searchQuery, selectedCity, selectedSpecialty, sortBy, clientCoords]);

  const handleFiltersApply = useCallback((filters: { city: string; specialty: string; sortBy: 'rating' | 'experience' | 'price' }) => {
    setSelectedCity(filters.city);
    setSelectedSpecialty(filters.specialty);
    setSortBy(filters.sortBy);
    setShowFilters(false);
  }, []);

  const handleFiltersReset = useCallback(() => {
    setSelectedCity('');
    setSelectedSpecialty('');
    setSortBy('rating');
    setShowFilters(false);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedSpecialty('');
    setSortBy('rating');
  }, []);

  const hasActiveFilters = selectedCity || selectedSpecialty || searchQuery;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Каталог мастеров</h1>
          <p className="text-muted-foreground mt-1">Найдите идеального мастера для вашего маникюра</p>
        </div>

        {/* Поиск и кнопка фильтров */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Поиск по имени мастера или специальности..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
            }`}
          >
            <Filter className="h-4 w-4" />
            Фильтры
          </button>
          {/* Geo: «Рядом со мной» */}
          <button
            onClick={() => {
              if (!clientCoords) { requestGeo(); return; }
              setNearMe(!nearMe);
              setSortBy(nearMe ? 'rating' : 'distance');
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              nearMe ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}
            title={clientCoords ? 'Сортировать по расстоянию' : 'Определить местоположение'}
          >
            <Navigation className={`h-4 w-4 ${nearMe ? '' : 'text-muted-foreground'}`} />
            Рядом
          </button>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="rounded-xl border bg-card p-4 mb-4">
            <MastersFiltersPanel
              selectedCity={selectedCity}
              selectedSpecialty={selectedSpecialty}
              sortBy={sortBy}
              onApply={handleFiltersApply}
              onReset={handleFiltersReset}
            />
          </div>
        )}

        {/* Активные фильтры */}
        {hasActiveFilters && !showFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {selectedCity && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium">
                  Город: {selectedCity}
                  <button onClick={() => setSelectedCity('')} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              )}
              {selectedSpecialty && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium">
                  {selectedSpecialty}
                  <button onClick={() => setSelectedSpecialty('')} className="ml-0.5 hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
            <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground ml-2">
              Сбросить все
            </button>
          </div>
        )}

        {/* Статистика */}
        <div className="flex items-center gap-4 mb-6 text-sm">
          <div>
            <span className="font-bold text-lg">{loading ? '...' : filteredMasters.length}</span>
            <span className="text-muted-foreground ml-1">
              {filteredMasters.length === 1 ? 'мастер найден' :
               filteredMasters.length < 5 ? 'мастера найдено' : 'мастеров найдено'}
            </span>
          </div>
          {searchQuery && (
            <div className="text-muted-foreground">
              Поиск: <strong>&quot;{searchQuery}&quot;</strong>
            </div>
          )}
        </div>

        {/* Загрузка */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        )}

        {/* Сетка мастеров */}
        {!loading && filteredMasters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMasters.map((master, i) => (
              <MasterCard key={master.userId} master={master} delay={Math.min(i * 50, 400)} clientLat={clientCoords?.latitude} clientLon={clientCoords?.longitude} />
            ))}
          </div>
        )}

        {/* Пустое состояние */}
        {!loading && filteredMasters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Search className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Мастера не найдены</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Попробуйте изменить параметры поиска или очистить фильтры
            </p>
            <button
              onClick={clearAllFilters}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Очистить фильтры
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
