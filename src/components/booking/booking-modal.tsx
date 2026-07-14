'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Clock, Loader2, Sparkles, ArrowRight, Search } from 'lucide-react';
import { useAuthState } from '@/components/providers/guest-provider';
import { useMasterDesigns, useAvailableSlots } from '@/hooks/api';
import { DesignDetailsModal } from '@/components/design/design-details-modal';

/* ── Types ──────────────────────────────────────────────── */

interface DesignItem {
  id: string; title: string;
  images: string[];
  _masterPrice?: string | number | null;
  _masterDuration?: string | number | null;
}

interface MasterInfo {
  fullName: string;
  rating: string;
  city?: string | null;
  reviewsCount?: number;
}

interface BookingModalProps {
  masterId: string;
  masterName: string;
  masterInfo?: MasterInfo;
  onClose: () => void;
  preselectedDesignId?: string;
}

/* ── Helpers ────────────────────────────────────────────── */

function slotDates(slots: { workDate?: string; date?: string }[]): string[] {
  return [...new Set(slots.map((s) => s.workDate || s.date || ''))].filter(Boolean).sort();
}

function slotTimes(slots: { workDate?: string; date?: string; startTime?: string }[], date: string): string[] {
  return slots
    .filter((s) => (s.workDate || s.date) === date)
    .map((s) => (s.startTime || '').slice(0, 5))
    .filter(Boolean)
    .sort();
}

function formatDateLabel(d: string): { weekday: string; label: string; isToday: boolean } {
  const date = new Date(d);
  const today = new Date().toISOString().split('T')[0];
  return {
    weekday: date.toLocaleDateString('ru', { weekday: 'short' }),
    label: d === today ? 'Сегодня' : date.toLocaleDateString('ru', { day: 'numeric', month: 'short' }),
    isToday: d === today,
  };
}

/* ── Component ──────────────────────────────────────────── */

export function BookingModal({ masterId, masterName, masterInfo, onClose, preselectedDesignId }: BookingModalProps) {
  const router = useRouter();
  const { isGuest, token } = useAuthState();

  const { data: designs = [], isLoading: designsLoading } = useMasterDesigns(masterId);
  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlots(masterId);

  const [selectedDesign, setSelectedDesign] = useState<DesignItem | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [previewDesign, setPreviewDesign] = useState<DesignItem | null>(null);
  const [designSearch, setDesignSearch] = useState('');
  const [designsVisible, setDesignsVisible] = useState(9);

  // Refs for auto-scrolling to new sections on mobile
  const dateRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  // Double-rAF scroll — guarantees the DOM is painted before we measure
  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const preselectionDone = useRef(false);

  // Preselect design when arriving from TikTok card — once only
  useEffect(() => {
    if (preselectedDesignId && designs.length > 0 && !preselectionDone.current) {
      const found = (designs as DesignItem[]).find((d) => d.id === preselectedDesignId);
      if (found) {
        preselectionDone.current = true;
        setSelectedDesign(found);
        setDesignsVisible((v) => {
          const idx = (designs as DesignItem[]).indexOf(found);
          return Math.max(v, idx + 1);
        });
      }
    }
  }, [preselectedDesignId, designs]);

  // Scroll to newly appeared sections (double-rAF prevents race with DOM commit)
  useEffect(() => { if (selectedDesign) scrollToRef(dateRef); }, [selectedDesign]);
  // Re-scroll when slots finish loading — dates may have expanded the date section
  useEffect(() => { if (selectedDesign && !slotsLoading && availableSlots.length > 0) scrollToRef(dateRef); }, [slotsLoading, selectedDesign, availableSlots.length]);
  useEffect(() => { if (selectedDate) scrollToRef(timeRef); }, [selectedDate]);
  useEffect(() => { if (selectedTime) scrollToRef(notesRef); }, [selectedTime]);

  const dates = slotDates(availableSlots);
  const timesForDate = selectedDate ? slotTimes(availableSlots, selectedDate) : [];
  const duration = selectedDesign?._masterDuration ? parseInt(String(selectedDesign._masterDuration)) : 0;
  const price = selectedDesign?._masterPrice ? parseInt(String(selectedDesign._masterPrice)) : 0;
  const city = masterInfo?.city || '';

  /* ── Book ──────────────────────────────────────────── */

  const handleBook = async () => {
    if (!selectedDesign || !selectedDate || !selectedTime) {
      setError('Выберите дизайн, дату и время');
      return;
    }

    // Guest → save full context for auth page, redirect
    if (!token || isGuest) {
      sessionStorage.setItem('pending_booking', JSON.stringify({
        nailDesignId: selectedDesign.id,
        nailMasterId: masterId,
        requestedDateTime: new Date(`${selectedDate}T${selectedTime}:00`).toISOString(),
        clientNotes: notes || undefined,
        description: selectedDesign.title,
        price: String(price),
        masterName,
        masterCity: city,
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

  /* ── Success screen ────────────────────────────────── */

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-8 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2">Запись создана!</h3>
          <p className="text-sm text-muted-foreground mb-2">
            {masterName} получит уведомление и подтвердит запись
          </p>
          {selectedDesign && (
            <p className="text-xs text-muted-foreground/70 mb-6">
              &laquo;{selectedDesign.title}&raquo;{price > 0 ? ` · $${price.toLocaleString('en-US')}` : ''}
            </p>
          )}

          {/* Post-booking actions */}
          <div className="space-y-2.5">
            <button
              onClick={onClose}
              className="w-full rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Готово
            </button>
           
          </div>
        </div>
      </div>
    );
  }

  /* ── Main modal ────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-bold text-lg">Запись к мастеру</h2>
            <p className="text-sm text-muted-foreground">{masterName}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — compact layout: all steps visible at once */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* Design selection grid — hidden when arriving with preselected design from TikTok */}
          {!preselectedDesignId && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Дизайн</h3>
              {designsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (designs as DesignItem[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">У мастера пока нет дизайнов</p>
              ) : (
                <>
                  {(designs as DesignItem[]).length >= 6 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <input
                        value={designSearch}
                        onChange={(e) => { setDesignSearch(e.target.value); setDesignsVisible(9); }}
                        placeholder="Поиск по названию..."
                        className="w-full rounded-lg border border-border/60 bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  )}
                  <DesignsGrid
                    designs={designs as DesignItem[]}
                    search={designSearch}
                    visible={designsVisible}
                    selectedId={selectedDesign?.id}
                    onSelect={(d) => { setSelectedDesign(d); setSelectedDate(''); setSelectedTime(''); }}
                    onShowMore={() => setDesignsVisible((v) => v + 12)}
                    showMoreCount={Math.max(0, (designs as DesignItem[]).filter((d) =>
                      !designSearch || d.title.toLowerCase().includes(designSearch.toLowerCase())
                    ).length - designsVisible)}
                  />
                </>
              )}
            </div>
          )}

          {/* Loading — preselected design not found yet */}
          {preselectedDesignId && !selectedDesign && designsLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Selected design preview + details */}
          {selectedDesign && (
            <div className="flex items-center gap-3 rounded-xl bg-accent/30 p-3">
              <Image
                src={selectedDesign.images?.[0] || '/placeholder.svg'}
                alt=""
                width={56}
                height={56}
                className="rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{selectedDesign.title}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {price > 0 && (
                    <span className="font-semibold text-primary">${price.toLocaleString('en-US')}</span>
                  )}
                  {duration > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />~{duration} мин
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewDesign(selectedDesign)}
                className="text-[10px] text-primary hover:underline shrink-0"
              >
                Подробнее
              </button>
            </div>
          )}

          {/* Date picker */}
          {selectedDesign && (
            <div ref={dateRef}>
              <h3 className="text-sm font-semibold mb-2">Дата</h3>
              {slotsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : dates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет доступных дат</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {dates.map((d) => {
                    const { weekday, label, isToday } = formatDateLabel(d);
                    return (
                      <button
                        key={d}
                        onClick={() => { setSelectedDate(d); setSelectedTime(''); }}
                        className={`shrink-0 flex flex-col items-center rounded-xl px-4 py-2 text-sm font-medium border transition-all ${
                          selectedDate === d
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border/40 hover:bg-accent'
                        }`}
                      >
                        <span className="text-[10px] uppercase opacity-70">{weekday}</span>
                        <span className="font-semibold">{isToday ? 'Сегодня' : label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Time picker */}
          {selectedDate && (
            <div ref={timeRef}>
              <h3 className="text-sm font-semibold mb-2">Время</h3>
              {timesForDate.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет свободных слотов</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timesForDate.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`rounded-lg py-2.5 text-sm font-medium border transition-all ${
                        selectedTime === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border/40 hover:bg-accent'
                      }`}
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
            <div ref={notesRef}>
              <h3 className="text-sm font-semibold mb-2">Пожелания</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Особые пожелания к дизайну..."
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/50"
              />
            </div>
          )}
        </div>

        {/* Footer — CTA with price */}
        <div className="shrink-0 p-4 border-t">
          <button
            onClick={handleBook}
            disabled={loading || !selectedDesign || !selectedDate || !selectedTime}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Записаться
                {price > 0 && (
                  <span className="opacity-80">· ${price.toLocaleString('en-US')}</span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Design preview sub-modal */}
      {previewDesign && (
        <DesignDetailsModal
          design={previewDesign}
          open={!!previewDesign}
          onClose={() => setPreviewDesign(null)}
        />
      )}
    </div>
  );
}

/* ── Filtered + paginated design grid ───────────────────── */

function DesignsGrid({
  designs, search, visible, selectedId, onSelect, onShowMore, showMoreCount,
}: {
  designs: DesignItem[];
  search: string;
  visible: number;
  selectedId?: string;
  onSelect: (d: DesignItem) => void;
  onShowMore: () => void;
  showMoreCount: number;
}) {
  const filtered = search
    ? designs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    : designs;

  if (filtered.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Ничего не найдено</p>;
  }

  const shown = filtered.slice(0, visible);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {shown.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d)}
            className={`relative overflow-hidden rounded-xl border-2 transition-all aspect-square ${
              selectedId === d.id
                ? 'border-primary shadow-sm ring-2 ring-primary/15'
                : 'border-border/40 hover:border-border'
            }`}
          >
            <Image
              src={d.images?.[0] || '/placeholder.svg'}
              alt={d.title}
              fill
              sizes="33vw"
              className="object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white text-center truncate">
              {d.title}
            </div>
            {(d._masterPrice || d._masterDuration) && (
              <div className="absolute top-1 right-1 flex gap-0.5">
                {d._masterPrice && (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    ${parseInt(String(d._masterPrice)).toLocaleString('en-US')}
                  </span>
                )}
                {d._masterDuration && (
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
                    {d._masterDuration}м
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
      {showMoreCount > 0 && (
        <button
          onClick={onShowMore}
          className="w-full mt-2 rounded-lg border border-border/40 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Показать ещё ({showMoreCount})
        </button>
      )}
    </>
  );
}
