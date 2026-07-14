'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { X, Camera, Plus, Shield, Home, MapPin, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { useProfile, profileKeys } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';
import { MASTER_SPECIALTIES, CITIES } from '@/data/specialties';
import { shortenAddress } from '@/lib/utils';
import { logger } from '@/lib/logger';

/* ── Types ──────────────────────────────────────────────── */

interface Props { open: boolean; onClose: () => void; onSaved: () => void; }

interface GeoResult { latitude: number; longitude: number; displayName: string; }

interface Suggestion { displayName: string; lat: string; lon: string; }

/* ═════════════════════════════════════════════════════════
   Component
   ═════════════════════════════════════════════════════════ */

export function EditProfileModal({ open, onClose, onSaved }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const { data: profile, isLoading: loading } = useProfile();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  /* ── Form state ─────────────────────────────────────── */

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [workFormat, setWorkFormat] = useState<string[]>([]);
  const [sterilization, setSterilization] = useState(false);
  const [disposableTools, setDisposableTools] = useState(false);

  /* ── Geo ────────────────────────────────────────────── */

  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [geoError, setGeoError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestSeqRef = useRef(0); // race-condition guard

  const initialLocation = useRef('');
  const initialCity = useRef('');

  /* ── Populate form on open ──────────────────────────── */

  const prevOpen = useRef(false);
  useEffect(() => {
    if (!open || !profile || loading) return;
    if (!prevOpen.current) {
      const p = profile;
      setFullName(p.fullName || '');
      setAge(p.age ? String(p.age) : '');
      setLocation(p.address || '');
      setDescription(p.description || '');
      setExperience(p.experience || '');
      setCity(p.city || '');
      setSpecialties(p.specialties || []);
      setWorkFormat(p.workFormat || []);
      setSterilization(p.sterilization || false);
      setDisposableTools(p.disposableTools || false);
      initialLocation.current = p.address || '';
      initialCity.current = p.city || '';
      if (p.latitude && p.longitude && p.address) {
        setGeoResult({
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          displayName: [p.city, p.address].filter(Boolean).join(', '),
        });
      }
    }
    prevOpen.current = open;
  }, [open, profile, loading]);

  const isMaster = profile?.role === 'nailmaster';

  /* ── Address autocomplete with race-condition guard ─── */

  const fetchSuggestions = useCallback(async (query: string, seq: number) => {
    if (query.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    setSuggestionsLoading(true);
    try {
      const fullQuery = city ? `${city}, ${query}` : query;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=5&accept-language=ru`;
      const res = await fetch(url, { headers: { 'User-Agent': 'NailMasters/2.0' } });
      const data = await res.json();

      // Discard if a newer request was already fired
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
  }, [city]);

  const handleAddressChange = (value: string) => {
    setLocation(value);
    setGeoResult(null);
    setGeoError('');
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const seq = ++suggestSeqRef.current;
    suggestTimer.current = setTimeout(() => fetchSuggestions(value, seq), 350);
  };

  const selectSuggestion = (s: Suggestion) => {
    const short = shortenAddress(s.displayName);
    setLocation(short);
    setShowSuggestions(false);
    setSuggestions([]);
    setGeoResult({ latitude: parseFloat(s.lat), longitude: parseFloat(s.lon), displayName: short });
    setGeoError('');
  };

  /* ── Validation ─────────────────────────────────────── */

  const addressChanged = location !== initialLocation.current || city !== initialCity.current;

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Введите имя';
    const ageNum = parseInt(age);
    if (age && (isNaN(ageNum) || ageNum < 14 || ageNum > 120)) return 'Возраст должен быть от 14 до 120 лет';

    if (isMaster) {
      if (!city) return 'Выберите город';
      if (!location.trim()) return 'Укажите адрес';
      if (addressChanged && !geoResult) return 'Проверьте адрес — дождитесь зелёной галочки';
      if (!experience) return 'Укажите опыт работы';
      if (specialties.length === 0) return 'Выберите хотя бы одну специализацию';
      if (workFormat.length === 0) return 'Выберите формат работы';
    }

    return null; // valid
  };

  /* ── Save ───────────────────────────────────────────── */

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      // Скролл до ошибки на мобильных — иначе её не видно в длинной форме
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return;
    }

    setSaving(true); setError('');
    const token = getToken();
    try {
      const body: Record<string, unknown> = { fullName, age: age ? Number(age) : undefined };

      if (isMaster) {
        Object.assign(body, {
          description, experience, city, specialties, workFormat,
          sterilization, disposableTools, address: location,
          ...(geoResult ? { latitude: geoResult.latitude, longitude: geoResult.longitude } : {}),
        });
      }

      const endpoint = isMaster ? '/api/masters/profile' : '/api/auth/profile';
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { onSaved(); onClose(); }
      else setError(json.error || 'Ошибка сохранения');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  /* ── Avatar upload ──────────────────────────────────── */

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token!}` },
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        queryClient.invalidateQueries({ queryKey: profileKeys.all });
        onSaved();
      }
    } catch (err) { logger.error(err, 'Avatar upload failed'); }
  };

  /* ── Specialties ────────────────────────────────────── */

  const addSpecialty = () => {
    if (specialtyInput && !specialties.includes(specialtyInput)) {
      setSpecialties((prev) => [...prev, specialtyInput]);
    }
    setSpecialtyInput('');
  };

  const toggleWorkFormat = (fmt: string) => {
    setWorkFormat((prev) => prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]);
  };

  /* ── Style ──────────────────────────────────────────── */

  const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all';
  const chipClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface cursor-pointer'
    }`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="Редактировать профиль"
        className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter"
        onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl">Редактировать профиль</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div ref={errorRef} className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            {/* Avatar */}
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <div className="relative h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden ring-2 ring-border/40">
                  {profile?.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <span>{(fullName || '?').charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </label>
            </div>

            {/* Full name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Полное имя *
              </label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Анна Иванова" />
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Возраст</label>
              <input value={age} onChange={(e) => setAge(e.target.value)} type="number" min={14} max={120} className={inputClass} placeholder="25" />
            </div>

            {/* Master fields */}
            {isMaster && (
              <>
                <div className="border-t pt-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />Данные мастера
                  </h3>

                  <div className="space-y-4">
                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">О себе</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} placeholder="Опишите ваш опыт, стиль работы, особенности..." />
                    </div>

                    {/* City + Experience */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Город *</label>
                        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
                          <option value="">Выберите город</option>
                          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Опыт *</label>
                        <input value={experience} onChange={(e) => setExperience(e.target.value)} className={inputClass} placeholder="5 лет" />
                      </div>
                    </div>

                    {/* Address with autocomplete */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Адрес *
                        <span className="font-normal text-muted-foreground/60 ml-1">— улица, дом, салон</span>
                      </label>
                      <div className="relative">
                        <input
                          ref={addressInputRef}
                          value={location}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          className={inputClass}
                          placeholder="Начните вводить адрес..."
                          autoComplete="off"
                        />
                        {geoResult && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Check className="h-4 w-4 text-secondary" />
                          </div>
                        )}
                        {geoError && !showSuggestions && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
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

                      {geoResult && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-secondary/5 px-3 py-2 text-xs text-secondary border border-secondary/20">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{geoResult.displayName}</span>
                        </div>
                      )}
                      {geoError && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {geoError}
                        </p>
                      )}
                    </div>

                    {/* Specialties */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Специализации *
                      </label>
                      <div className="flex gap-2 mb-2">
                        <select
                          value={specialtyInput}
                          onChange={(e) => setSpecialtyInput(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Выберите...</option>
                          {MASTER_SPECIALTIES.filter((s) => !specialties.includes(s)).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button onClick={addSpecialty} disabled={!specialtyInput}
                          className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground disabled:opacity-40 transition-colors">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {specialties.map((s) => (
                            <span key={s} onClick={() => setSpecialties((prev) => prev.filter((x) => x !== s))}
                              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors">
                              {s} <X className="h-3 w-3" />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Work format */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Формат работы *
                      </label>
                      <div className="flex gap-2">
                        {[
                          { key: 'salon', label: 'В салоне' },
                          { key: 'home', label: 'На дому' },
                        ].map((f) => (
                          <button key={f.key} onClick={() => toggleWorkFormat(f.key)} className={chipClass(workFormat.includes(f.key))}>
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
                          type="button" role="switch" aria-checked={sterilization}
                          onClick={() => setSterilization(!sterilization)}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${sterilization ? 'bg-secondary' : 'bg-muted'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${sterilization ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Одноразовые материалы</span>
                        <button
                          type="button" role="switch" aria-checked={disposableTools}
                          onClick={() => setDisposableTools(!disposableTools)}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${disposableTools ? 'bg-secondary' : 'bg-muted'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${disposableTools ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button onClick={onClose} className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
