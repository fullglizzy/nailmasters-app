'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Clock, Loader2 } from 'lucide-react';
import { useAuthState } from '@/components/providers/guest-provider';
import { useMasterDesigns, useAvailableSlots } from '@/hooks/api';
import { DesignDetailsModal } from '@/components/design/design-details-modal';

// ── Types ────────────────────────────────────────────────

interface DesignItem {
  id: string; title: string;
  images: string[];
  _masterPrice?: string | number | null;
  _masterDuration?: string | number | null;
}

interface BookingModalProps {
  masterId: string;
  masterName: string;
  onClose: () => void;
  preselectedDesignId?: string;
}

// ── Helpers ──────────────────────────────────────────────

/** Group slots by date, return sorted unique dates */
function slotDates(slots: { workDate?: string; date?: string }[]): string[] {
  return [...new Set(slots.map((s) => s.workDate || s.date || ''))].filter(Boolean).sort();
}

/** Filter slots for selected date, return sorted times */
function slotTimes(slots: { workDate?: string; date?: string; startTime?: string }[], date: string): string[] {
  return slots
    .filter((s) => (s.workDate || s.date) === date)
    .map((s) => (s.startTime || '').slice(0, 5))
    .filter(Boolean)
    .sort();
}

// ── Component ────────────────────────────────────────────

export function BookingModal({ masterId, masterName, onClose, preselectedDesignId }: BookingModalProps) {
  const router = useRouter();
  const { isGuest, token } = useAuthState();

  // ── RQ hooks: cached, deduplicated, reactive ────────
  const { data: designs = [], isLoading: designsLoading } = useMasterDesigns(masterId);
  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlots(masterId);

  // ── Local UI state ──────────────────────────────────
  const [selectedDesign, setSelectedDesign] = useState<DesignItem | null>(() => {
    if (!preselectedDesignId) return null;
    const found = (designs as DesignItem[]).find((d) => d.id === preselectedDesignId);
    return found || null;
  });
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [previewDesign, setPreviewDesign] = useState<DesignItem | null>(null);

  // ── Derived ─────────────────────────────────────────
  const dates = slotDates(availableSlots);
  const timesForDate = selectedDate ? slotTimes(availableSlots, selectedDate) : [];
  const duration = selectedDesign?._masterDuration ? parseInt(String(selectedDesign._masterDuration)) : 0;
  const price = selectedDesign?._masterPrice ? parseInt(String(selectedDesign._masterPrice)) : 0;

  // ── Book ────────────────────────────────────────────
  const handleBook = async () => {
    if (!selectedDesign || !selectedDate || !selectedTime) {
      setError('Выберите дизайн, дату и время');
      return;
    }

    // Guest → save context, redirect to register (client-side navigation, no full reload!)
    if (!token || isGuest) {
      sessionStorage.setItem('pending_booking', JSON.stringify({
        nailDesignId: selectedDesign.id,
        nailMasterId: masterId,
        requestedDateTime: new Date(`${selectedDate}T${selectedTime}:00`).toISOString(),
        clientNotes: notes || undefined,
        description: selectedDesign.title,
        price: String(price),
      }));
      router.push('/auth?as=client');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nailDesignId: selectedDesign.id,
          nailMasterId: masterId,
          requestedDateTime: new Date(`${selectedDate}T${selectedTime}:00`).toISOString(),
          clientNotes: notes || undefined,
          price: String(price),
        }),
      });
      const json = await res.json();
      if (json.success) {
        sessionStorage.setItem('just_booked', '1');
        setSuccess(true);
      } else {
        setError(json.error || 'Ошибка создания заказа');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-8 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2">Запись создана!</h3>
          <p className="text-sm text-muted-foreground mb-6">{masterName} получит уведомление и подтвердит запись</p>
          <button onClick={onClose} className="rounded-full bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground">Готово</button>
        </div>
      </div>
    );
  }

  // ── Main modal ──────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-bold text-lg">Запись к мастеру</h2>
            <p className="text-sm text-muted-foreground">{masterName}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {/* Step 1: Pick design */}
          <div>
            <h3 className="text-sm font-semibold mb-3">1. Выберите дизайн</h3>
            {designsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : designs.length === 0 ? (
              <p className="text-sm text-muted-foreground">У мастера пока нет дизайнов</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(designs as DesignItem[]).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDesign(d); setSelectedDate(''); setSelectedTime(''); }}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all aspect-square ${selectedDesign?.id === d.id ? 'border-primary shadow-sm' : 'border-border/40 hover:border-border'}`}
                  >
                    <Image src={d.images?.[0] || '/placeholder.svg'} alt={d.title} fill sizes="33vw" className="object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white text-center truncate">{d.title}</div>
                    {(d._masterPrice || d._masterDuration) && (
                      <div className="absolute top-1 right-1 flex gap-0.5">
                        {d._masterPrice && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">{parseInt(String(d._masterPrice)).toLocaleString('ru-RU')} ₽</span>}
                        {d._masterDuration && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">{d._masterDuration}м</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Design preview */}
          {selectedDesign && (
            <div className="flex items-center gap-3 rounded-xl bg-accent/30 p-3">
              <Image src={selectedDesign.images?.[0] || '/placeholder.svg'} alt="" width={56} height={56} className="rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{selectedDesign.title}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {price > 0 && <span className="font-semibold text-primary">{price.toLocaleString('ru-RU')} ₽</span>}
                  {duration > 0 && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />~{duration} мин</span>}
                </div>
              </div>
              <button onClick={() => setPreviewDesign(selectedDesign)} className="text-[10px] text-primary hover:underline shrink-0">Подробнее</button>
            </div>
          )}

          {/* Step 2: Date */}
          {selectedDesign && (
            <div>
              <h3 className="text-sm font-semibold mb-3">2. Выберите дату</h3>
              {slotsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : dates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет доступных дат</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {dates.map((d) => {
                    const date = new Date(d);
                    const isToday = d === new Date().toISOString().split('T')[0];
                    return (
                      <button
                        key={d}
                        onClick={() => { setSelectedDate(d); setSelectedTime(''); }}
                        className={`shrink-0 flex flex-col items-center rounded-xl px-4 py-2 text-sm font-medium border transition-all ${selectedDate === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border/40 hover:bg-accent'}`}
                      >
                        <span className="text-[10px] uppercase opacity-70">{date.toLocaleDateString('ru', { weekday: 'short' })}</span>
                        <span className="font-semibold">{isToday ? 'Сегодня' : date.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Time */}
          {selectedDate && (
            <div>
              <h3 className="text-sm font-semibold mb-3">3. Выберите время</h3>
              {timesForDate.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет свободных слотов</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timesForDate.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`rounded-lg py-2.5 text-sm font-medium border transition-all ${selectedTime === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border/40 hover:bg-accent'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {selectedTime && (
            <div>
              <h3 className="text-sm font-semibold mb-2">4. Пожелания</h3>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Особые пожелания к дизайну..."
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t">
          <button
            onClick={handleBook}
            disabled={loading || !selectedDesign || !selectedDate || !selectedTime}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : price > 0 ? `Записаться · ${price.toLocaleString('ru-RU')} ₽` : 'Записаться'}
          </button>
        </div>
      </div>

      {previewDesign && <DesignDetailsModal design={previewDesign} open={!!previewDesign} onClose={() => setPreviewDesign(null)} />}
    </div>
  );
}
