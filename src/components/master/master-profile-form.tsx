'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, Loader2, MapPin, Plus, Shield, Home, X } from 'lucide-react';
import { MASTER_SPECIALTIES, CITIES } from '@/data/specialties';
import { shortenAddress } from '@/lib/utils';

export interface MasterProfileValues {
  fullName: string;
  age: string;
  description: string;
  city: string;
  experience: string;
  address: string;
  specialties: string[];
  workFormat: string[];
  startingPrice: string;
  sterilization: boolean;
  disposableTools: boolean;
  latitude: number | null;
  longitude: number | null;
}

export function emptyMasterProfileValues(): MasterProfileValues {
  return {
    fullName: '',
    age: '',
    description: '',
    city: '',
    experience: '',
    address: '',
    specialties: [],
    workFormat: [],
    startingPrice: '',
    sterilization: false,
    disposableTools: false,
    latitude: null,
    longitude: null,
  };
}

interface Props {
  value: MasterProfileValues;
  onChange: (patch: Partial<MasterProfileValues>) => void;
  disabled?: boolean;
}

interface Suggestion {
  displayName: string;
  lat: string;
  lon: string;
}

/**
 * Общая форма данных мастера — используется и в ЛК, и в админке.
 * Не сохраняет и не валидирует сама: значения и сохранение — на обёртке.
 */
export function MasterProfileForm({ value, onChange, disabled }: Props) {
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestSeqRef = useRef(0);

  const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all disabled:opacity-60';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5';
  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface cursor-pointer'
    }`;

  const fetchSuggestions = useCallback(async (query: string, seq: number) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const fullQuery = value.city ? `${value.city}, ${query}` : query;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=5&accept-language=ru`;
      const res = await fetch(url, { headers: { 'User-Agent': 'NailMasters/2.0' } });
      const data = await res.json();

      if (seq !== suggestSeqRef.current) return;

      if (Array.isArray(data)) {
        const seen = new Set<string>();
        const items: Suggestion[] = [];
        for (const d of data) {
          const addr = d.address || {};
          const street = addr.road || addr.pedestrian || addr.path || '';
          const house = addr.house_number || addr.building || '';
          const clean = [street, house].filter(Boolean).join(', ');
          const displayName = shortenAddress(clean || d.display_name);
          if (!displayName || seen.has(displayName)) continue;
          seen.add(displayName);
          items.push({ displayName, lat: d.lat, lon: d.lon });
        }
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      }
    } catch {
      if (seq === suggestSeqRef.current) setSuggestions([]);
    } finally {
      if (seq === suggestSeqRef.current) setSuggestionsLoading(false);
    }
  }, [value.city]);

  const handleAddressChange = (address: string) => {
    // Адрес изменился — старые координаты больше не действительны
    onChange({ address, latitude: null, longitude: null });
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const seq = ++suggestSeqRef.current;
    suggestTimer.current = setTimeout(() => fetchSuggestions(address, seq), 350);
  };

  const selectSuggestion = (s: Suggestion) => {
    const short = shortenAddress(s.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
    onChange({
      address: short,
      latitude: parseFloat(s.lat),
      longitude: parseFloat(s.lon),
    });
  };

  const addSpecialty = () => {
    if (specialtyInput && !value.specialties.includes(specialtyInput)) {
      onChange({ specialties: [...value.specialties, specialtyInput] });
    }
    setSpecialtyInput('');
  };

  const toggleWorkFormat = (fmt: string) => {
    onChange({
      workFormat: value.workFormat.includes(fmt)
        ? value.workFormat.filter((f) => f !== fmt)
        : [...value.workFormat, fmt],
    });
  };

  return (
    <div className="space-y-5">
      {/* Full name */}
      <div>
        <label className={labelClass}>Полное имя *</label>
        <input
          value={value.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          className={inputClass}
          placeholder="Анна Иванова"
          disabled={disabled}
        />
      </div>

      {/* Age */}
      <div>
        <label className={labelClass}>Возраст</label>
        <input
          value={value.age}
          onChange={(e) => onChange({ age: e.target.value })}
          type="number"
          min={14}
          max={120}
          className={inputClass}
          placeholder="25"
          disabled={disabled}
        />
      </div>

      <div className="border-t pt-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />Данные мастера
        </h3>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className={labelClass}>О себе</label>
            <textarea
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="Опишите ваш опыт, стиль работы, особенности..."
              disabled={disabled}
            />
          </div>

          {/* City + Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Город *</label>
              <select
                value={value.city}
                onChange={(e) => onChange({ city: e.target.value, latitude: null, longitude: null })}
                className={inputClass}
                disabled={disabled}
              >
                <option value="">Выберите город</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Опыт *</label>
              <input
                value={value.experience}
                onChange={(e) => onChange({ experience: e.target.value })}
                className={inputClass}
                placeholder="5 лет"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Address with autocomplete */}
          <div>
            <label className={labelClass}>
              Адрес *
              <span className="font-normal text-muted-foreground/60 ml-1">— улица, дом, салон</span>
            </label>
            <div className="relative">
              <input
                value={value.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className={inputClass}
                placeholder="Начните вводить адрес..."
                autoComplete="off"
                disabled={disabled}
              />
              {value.latitude != null && value.longitude != null && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="h-4 w-4 text-secondary" />
                </div>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-30 max-h-48 overflow-y-auto">
                  {suggestionsLoading && (
                    <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Поиск адресов...
                    </div>
                  )}
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                      className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border/20 last:border-0 flex items-start gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {value.address && (value.latitude == null || value.longitude == null) && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Координаты будут определены по адресу при сохранении
              </p>
            )}
          </div>

          {/* Starting price */}
          <div>
            <label className={labelClass}>Цена от ($) *</label>
            <input
              value={value.startingPrice}
              onChange={(e) => onChange({ startingPrice: e.target.value })}
              type="number"
              min={1}
              step="0.01"
              className={inputClass}
              placeholder="45"
              disabled={disabled}
            />
          </div>

          {/* Specialties */}
          <div>
            <label className={labelClass}>Специализации *</label>
            <div className="flex gap-2 mb-2">
              <select
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                className={inputClass}
                disabled={disabled}
              >
                <option value="">Выберите...</option>
                {MASTER_SPECIALTIES.filter((s) => !value.specialties.includes(s)).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addSpecialty}
                disabled={!specialtyInput || disabled}
                className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground disabled:opacity-40 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {value.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {value.specialties.map((s) => (
                  <span
                    key={s}
                    onClick={() => !disabled && onChange({ specialties: value.specialties.filter((x) => x !== s) })}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    {s} <X className="h-3 w-3" />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Work format */}
          <div>
            <label className={labelClass}>Формат работы *</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'salon', label: 'В салоне' },
                { key: 'home', label: 'На дому' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => !disabled && toggleWorkFormat(f.key)}
                  className={chipClass(value.workFormat.includes(f.key))}
                >
                  <Home className="h-3.5 w-3.5 inline mr-1" />{f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Стерилизация инструментов</span>
              <button
                type="button"
                role="switch"
                aria-checked={value.sterilization}
                onClick={() => !disabled && onChange({ sterilization: !value.sterilization })}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${value.sterilization ? 'bg-secondary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${value.sterilization ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Одноразовые материалы</span>
              <button
                type="button"
                role="switch"
                aria-checked={value.disposableTools}
                onClick={() => !disabled && onChange({ disposableTools: !value.disposableTools })}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${value.disposableTools ? 'bg-secondary' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${value.disposableTools ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
