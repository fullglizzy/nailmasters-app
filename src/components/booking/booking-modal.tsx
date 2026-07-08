'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Clock, Check, Star, MapPin, Sparkles, ChevronLeft, Search, Loader2 } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { DesignDetailsModal } from '@/components/design/design-details-modal';
import { AuthGuardModal, getAuthToken } from '@/components/auth/auth-guard-modal';

interface Service { id: string; name: string; description?: string | null; price: string; duration: number; }
interface Design { id: string; title: string; images: string[]; }
interface MasterInfo { fullName: string; rating: string; city: string | null; reviewsCount: number; }

interface BookingModalProps { masterId: string; masterName: string; masterInfo?: MasterInfo; onClose: () => void; }

export function BookingModal({ masterId, masterName, masterInfo, onClose }: BookingModalProps) {
  const { dialogRef, handleKeyDown } = useModal(true, onClose);
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [designsLoading, setDesignsLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const timeScrollRef = useRef<HTMLDivElement>(null);
  const designScrollRef = useRef<HTMLDivElement>(null);

  // Horizontal scroll on wheel
  useEffect(() => {
    const add = (el: HTMLDivElement | null) => {
      if (!el) return;
      const fn = (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
      el.addEventListener('wheel', fn, { passive: false });
      return () => el.removeEventListener('wheel', fn);
    };
    const c = [add(dateScrollRef.current), add(timeScrollRef.current), add(designScrollRef.current)];
    return () => c.forEach(fn => fn?.());
  }, [selectedDate, selectedIds]);
  const [previewDesign, setPreviewDesign] = useState<Design | null>(null);
  const [designSearch, setDesignSearch] = useState('');
  const [designFilterTag, setDesignFilterTag] = useState('');
  const [showAuthGuard, setShowAuthGuard] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/masters/profile/${masterId}`).then(r => r.json()),
      fetch(`/api/designs/master/${masterId}`).then(r => r.json()).catch(() => ({ success: false })),
      fetch(`/api/masters/${masterId}/schedule/available?dates=1`).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([profileJson, designsJson, scheduleJson]) => {
      if (profileJson.success) setServices(profileJson.data?.services || []);
      setServicesLoading(false);
      if (designsJson.success) setDesigns(designsJson.data || []);
      setDesignsLoading(false);
      if (scheduleJson.success && scheduleJson.data) {
        setAvailableDates(scheduleJson.data as string[]);
      }
    });
  }, [masterId]);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    fetch(`/api/masters/${masterId}/schedule/available?date=${selectedDate}`)
      .then(r => r.json()).then(json => { if (json.success) setAvailableSlots(json.data || []); else setAvailableSlots([]); })
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, masterId]);

  const selectedServices = useMemo(() => services.filter(s => selectedIds.has(s.id)), [services, selectedIds]);
  const totalPrice = useMemo(() => selectedServices.reduce((sum, s) => sum + parseInt(s.price), 0), [selectedServices]);
  const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + s.duration, 0), [selectedServices]);

  // Slots that can fit the total duration
  const fittingSlots = useMemo(() => {
    if (!totalDuration) return availableSlots;
    return availableSlots.filter(s => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm) >= totalDuration;
    });
  }, [availableSlots, totalDuration]);

  const toggleService = useCallback((id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  // Design search & filters
  const designTags = useMemo(() => {
    const tags = new Set<string>();
    designs.forEach(d => (d as any).tags?.forEach((t: string) => tags.add(t)));
    designs.forEach(d => (d as any).techniques?.forEach((t: string) => tags.add(t)));
    return [...tags].slice(0, 15);
  }, [designs]);

  const filteredDesigns = useMemo(() => {
    let result = designs;
    if (designSearch.trim()) {
      const q = designSearch.toLowerCase();
      result = result.filter(d => d.title.toLowerCase().includes(q));
    }
    if (designFilterTag) {
      result = result.filter(d =>
        (d as any).tags?.includes(designFilterTag) || (d as any).techniques?.includes(designFilterTag)
      );
    }
    return result;
  }, [designs, designSearch, designFilterTag]);

  const handleBook = async () => {
    if (!selectedIds.size || !selectedDate || !selectedTime) { setError('Выберите услуги, дату и время'); return; }
    const token = getAuthToken();
    if (!token) { setShowAuthGuard(true); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          masterServiceIds: [...selectedIds],
          nailDesignId: selectedDesignId || undefined,
          nailMasterId: masterId,
          requestedDateTime: `${selectedDate}T${selectedTime.slice(0, 5)}:00`,
          clientNotes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) setSuccess(true);
      else setError(json.error || 'Ошибка бронирования');
    } catch { setError('Ошибка соединения'); }
    finally { setLoading(false); }
  };

  // Dates: next 14 days, skip Sundays
  const dates = availableDates;

  const dateLabel = (d: string) => {
    const today = new Date().toISOString().split('T')[0];
    const t = new Date(); t.setDate(t.getDate() + 1); const tomorrow = t.toISOString().split('T')[0];
    if (d === today) return 'Сегодня';
    if (d === tomorrow) return 'Завтра';
    return new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short', weekday: 'short' });
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
        <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-8 shadow-xl modal-enter text-center" onClick={e => e.stopPropagation()}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20"><Check className="h-8 w-8 text-secondary" /></div>
          <h3 className="font-display text-xl mb-2">{selectedIds.size > 1 ? 'Записи созданы!' : 'Запись создана!'}</h3>
          <p className="text-sm text-muted-foreground mb-1">{new Date(selectedDate).toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' })} в {selectedTime.slice(0, 5)}</p>
          <p className="text-sm text-muted-foreground mb-1">{selectedServices.map(s => s.name).join(' + ')}</p>
          <p className="text-lg font-bold text-primary mb-6">{totalPrice.toLocaleString()} ₽ · {totalDuration} мин</p>
          <button onClick={onClose} className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Готово</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Запись к мастеру" className="relative z-10 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-xl modal-enter" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>

        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">{masterName.charAt(0)}</div>
              <div>
                <div className="font-bold text-sm">{masterName}</div>
                {masterInfo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-gold text-gold" />{masterInfo.rating}</span>
                    {masterInfo.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{masterInfo.city}</span>}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors"><X className="h-5 w-5" /></button>
          </div>
          {/* Progress + labels */}
          <div className="mt-4 space-y-1.5">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(s => <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-primary' : 'bg-muted'}`} />)}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className={step >= 1 ? 'text-primary font-semibold' : ''}>Услуги</span>
              <span className={step >= 2 ? 'text-primary font-semibold' : ''}>Время</span>
              <span className={step >= 3 ? 'text-primary font-semibold' : ''}>Дизайн</span>
              <span className={step >= 4 ? 'text-primary font-semibold' : ''}>Запись</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{error}</div>}

          {/* Step 1: Choose services (multi-select) */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Выберите услуги</h3>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">Выбрано: {selectedIds.size} · {totalPrice.toLocaleString()} ₽ · {totalDuration} мин</span>
                )}
              </div>

              {servicesLoading ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-[72px] w-full skeleton rounded-xl" />)}
                </div>
              ) : !services.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">У мастера пока нет услуг</p>
              ) : null}

              {services.map(s => {
                const isSelected = selectedIds.has(s.id);
                return (
                  <button key={s.id} onClick={() => toggleService(s.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all flex items-center gap-4 ${
                      isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/40 hover:bg-accent/30'
                    }`}>
                    <div className={`shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{s.name}</div>
                      {s.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</div>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration} мин</span>
                        <span className="font-medium text-foreground">{parseInt(s.price).toLocaleString()} ₽</span>
                      </div>
                    </div>
                    <div className={`shrink-0 text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isSelected ? 'Выбрано' : 'Выбрать'}
                    </div>
                  </button>
                );
              })}

              <button onClick={() => { if (!selectedIds.size) { setError('Выберите хотя бы одну услугу'); return; } setError(''); setStep(2); }}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                {selectedIds.size ? `Далее: выбор времени · ${totalDuration} мин · ${totalPrice.toLocaleString()} ₽` : 'Далее: выбор времени'}
              </button>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Выберите дату</h3>
                  <span className="text-xs text-muted-foreground">{selectedServices.map(s => s.name).join(' + ')} · {totalDuration} мин</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" ref={dateScrollRef}>
                  {dates.map(d => (
                    <button key={d} onClick={() => { setSelectedDate(d); setSelectedTime(''); }}
                      className={`shrink-0 rounded-xl px-4 py-3 text-sm font-medium border transition-all text-center min-w-[80px] ${
                        selectedDate === d ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border/40 hover:bg-accent'
                      }`}>
                      <div className="text-xs opacity-70">{new Date(d).toLocaleDateString('ru', { weekday: 'short' })}</div>
                      <div className="text-lg font-bold">{new Date(d).getDate()}</div>
                      <div className="text-xs opacity-70">{new Date(d).toLocaleDateString('ru', { month: 'short' })}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedDate && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Выберите время {totalDuration > 60 && <span className="text-xs text-muted-foreground font-normal">(≥ {totalDuration} мин)</span>}</h3>
                  {slotsLoading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
                    </div>
                  ) : fittingSlots.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground rounded-xl border bg-muted/20">
                      <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
                      {availableSlots.length === 0 ? 'Нет слотов на эту дату' : `Нет слотов ≥ ${totalDuration} мин. Попробуйте убрать часть услуг.`}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {fittingSlots.map(s => (
                        <button key={s.startTime} onClick={() => setSelectedTime(s.startTime)}
                          className={`rounded-lg py-2.5 text-sm font-medium border transition-all ${
                            selectedTime === s.startTime ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border/40 hover:bg-accent'
                          }`}>{s.startTime?.slice(0, 5)}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedTime && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setStep(1)} className="flex items-center justify-center gap-1 flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-surface transition-colors"><ChevronLeft className="h-4 w-4" />Услуги</button>
                  <button onClick={() => setStep(3)} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Далее: дизайн</button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Design selection */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Выберите дизайн</h3>
                <span className="text-xs text-muted-foreground">{filteredDesigns.length} из {designs.length}</span>
              </div>

              {designs.length > 0 && (
                <>
                  {/* Search + filters */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        value={designSearch} onChange={e => setDesignSearch(e.target.value)}
                        placeholder="Поиск по названию..."
                        className="w-full rounded-xl border border-border/60 bg-background pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                      />
                    </div>
                    {designTags.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1" ref={timeScrollRef}>
                        {designTags.map(tag => (
                          <button key={tag} onClick={() => setDesignFilterTag(designFilterTag === tag ? '' : tag)}
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium border transition-all ${
                              designFilterTag === tag ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                            }`}>#{tag}</button>
                        ))}
                        {designFilterTag && (
                          <button onClick={() => setDesignFilterTag('')} className="shrink-0 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-3 w-3 inline mr-0.5" />Сбросить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Design grid */}
              {!filteredDesigns.length ? (
                <div className="text-center py-8 text-sm text-muted-foreground rounded-xl border border-dashed border-border/40">
                  {designs.length === 0 ? (
                    <>
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      У мастера пока нет привязанных дизайнов
                    </>
                  ) : (
                    <>
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Ничего не найдено. <button onClick={() => { setDesignSearch(''); setDesignFilterTag(''); }} className="text-primary hover:underline">Сбросить</button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Horizontal scroll: cards */}
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 -mx-6 px-6 snap-x" ref={designScrollRef}>
                    {/* "No design" card */}
                    <button
                      onClick={() => setSelectedDesignId('')}
                      className={`shrink-0 w-[110px] snap-start rounded-xl border-2 flex flex-col items-center justify-center gap-2 text-xs transition-all ${
                        !selectedDesignId ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/20' : 'border-dashed border-border/40 hover:border-border hover:bg-surface'
                      }`}
                      style={{ aspectRatio: '3/4' }}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${!selectedDesignId ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}>
                        {!selectedDesignId ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                      </div>
                      <span className={`font-medium ${!selectedDesignId ? 'text-primary' : 'text-muted-foreground'}`}>Без дизайна</span>
                    </button>

                    {filteredDesigns.map(d => {
                      const selected = selectedDesignId === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDesignId(selected ? '' : d.id)}
                          className={`shrink-0 w-[140px] snap-start rounded-xl overflow-hidden border-2 transition-all group ${
                            selected ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-border/30 hover:border-primary/30'
                          }`}
                          style={{ aspectRatio: '3/4' }}
                        >
                          <div className="relative h-full">
                            <img src={d.images[0] || '/placeholder.svg'} alt={d.title} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute bottom-0 inset-x-0 p-2">
                              <p className="text-xs font-medium text-white truncate">{d.title}</p>
                            </div>
                            {selected && (
                              <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                <Check className="h-3.5 w-3.5 text-primary-foreground" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPreviewDesign(d); }}
                              className="absolute top-2 left-2 h-7 w-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                              title="Посмотреть детали"
                            >
                              <Search className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex items-center justify-center gap-1 flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-surface transition-colors"><ChevronLeft className="h-4 w-4" />Время</button>
                <button onClick={() => setStep(4)} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Далее: подтверждение
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-5">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Check className="h-4 w-4 text-primary" />Подтверждение записи</h3>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Пожелания к заказу</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder="Цвет, форма, особые пожелания..." />
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-accent/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Мастер</span><span className="font-medium">{masterName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Услуги</span><span className="truncate ml-4 text-right max-w-[60%]">{selectedServices.map(s => s.name).join(', ')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Дата и время</span><span className="font-medium">{new Date(selectedDate).toLocaleDateString('ru', { day: 'numeric', month: 'long', weekday: 'short' })} в {selectedTime.slice(0, 5)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Длительность</span><span className="font-medium">{totalDuration} мин</span></div>
                {selectedDesignId && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Дизайн</span><span className="font-medium truncate ml-4 text-right max-w-[60%]">{designs.find(d => d.id === selectedDesignId)?.title}</span></div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border/40">
                  <span>Итого</span><span className="text-primary">{totalPrice.toLocaleString()} ₽</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="flex items-center justify-center gap-1 flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-surface transition-colors"><ChevronLeft className="h-4 w-4" />Дизайн</button>
                <button onClick={handleBook} disabled={loading}
                  className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Создаём запись...' : `Записаться · ${totalPrice.toLocaleString()} ₽`}
                </button>
              </div>
            </div>
          )}

          {/* Design preview modal */}
          {previewDesign && (
            <DesignDetailsModal
              design={{ ...previewDesign, likesCount: 0, videoUrl: null } as any}
              open={!!previewDesign}
              onClose={() => setPreviewDesign(null)}
            />
          )}

          {/* Auth guard */}
          <AuthGuardModal open={showAuthGuard} onClose={() => setShowAuthGuard(false)} action="записаться к мастеру" />
        </div>
      </div>
    </div>
  );
}
