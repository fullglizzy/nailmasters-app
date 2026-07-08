'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { MASTER_SPECIALTIES, CITIES } from '@/data/specialties';

interface FiltersPanelProps {
  selectedCity: string;
  selectedSpecialty: string;
  sortBy: 'rating' | 'experience' | 'price';
  onApply: (filters: { city: string; specialty: string; sortBy: 'rating' | 'experience' | 'price' }) => void;
  onReset: () => void;
}

export function MastersFiltersPanel({
  selectedCity, selectedSpecialty, sortBy, onApply, onReset,
}: FiltersPanelProps) {
  const [localCity, setLocalCity] = useState(selectedCity);
  const [localSpecialty, setLocalSpecialty] = useState(selectedSpecialty);
  const [localSortBy, setLocalSortBy] = useState(sortBy);

  const handleApply = () => {
    onApply({ city: localCity, specialty: localSpecialty, sortBy: localSortBy });
  };

  const handleReset = () => {
    setLocalCity('');
    setLocalSpecialty('');
    setLocalSortBy('rating');
    onReset();
  };

  const selectClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Фильтры мастеров</h3>
        <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
          Сбросить все
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Город */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Город</label>
          <select value={localCity} onChange={(e) => setLocalCity(e.target.value)} className={selectClass}>
            <option value="">Все города</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* Специальность */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Специальность</label>
          <select value={localSpecialty} onChange={(e) => setLocalSpecialty(e.target.value)} className={selectClass}>
            <option value="">Все специальности</option>
            {MASTER_SPECIALTIES.map((spec) => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        {/* Сортировка */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Сортировка</label>
          <select value={localSortBy} onChange={(e) => setLocalSortBy(e.target.value as 'rating' | 'experience' | 'price')} className={selectClass}>
            <option value="rating">По рейтингу</option>
            <option value="experience">По опыту</option>
            <option value="price">По цене</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleApply}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Применить
        </button>
      </div>
    </div>
  );
}
