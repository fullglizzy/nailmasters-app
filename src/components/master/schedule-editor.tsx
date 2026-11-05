'use client';

import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { pluralRu } from '@/lib/utils';
import type { ScheduleSlot } from '@/lib/types';

export type RepeatDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ScheduleBatchValues {
  workDate: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  repeatDays: RepeatDay[];
  weeks: number;
}

export const WEEKDAYS: { key: RepeatDay; label: string }[] = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Вс' },
];

export function defaultScheduleBatchValues(): ScheduleBatchValues {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    workDate: tomorrow.toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    intervalMinutes: 60,
    repeatDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeks: 4,
  };
}

const inputClass = 'rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all w-full';
const chipClass = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
    active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-surface'
  }`;

interface BatchFormProps {
  value: ScheduleBatchValues;
  onChange: (patch: Partial<ScheduleBatchValues>) => void;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string;
  submitLabel?: string;
  showWeeks?: boolean;
  /** Скрыть кнопку отправки — когда слоты уходят в общем запросе создания мастера. */
  hideSubmit?: boolean;
}

export function ScheduleBatchForm({
  value,
  onChange,
  onSubmit,
  submitting,
  error,
  submitLabel = 'Создать слоты',
  showWeeks = true,
  hideSubmit = false,
}: BatchFormProps) {
  const toggleDay = (day: RepeatDay) => {
    onChange({
      repeatDays: value.repeatDays.includes(day)
        ? value.repeatDays.filter((d) => d !== day)
        : [...value.repeatDays, day],
    });
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5 space-y-4">
      {error && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Дата</label>
          <input type="date" value={value.workDate} onChange={(e) => onChange({ workDate: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Недель</label>
          <select
            value={value.weeks}
            onChange={(e) => onChange({ weeks: Number(e.target.value) })}
            className={inputClass}
            disabled={!showWeeks}
          >
            {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Начало</label>
          <input type="time" value={value.startTime} onChange={(e) => onChange({ startTime: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Конец</label>
          <input type="time" value={value.endTime} onChange={(e) => onChange({ endTime: e.target.value })} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Длительность слота</label>
        <div className="flex flex-wrap gap-2">
          {[30, 60, 90, 120].map((m) => (
            <button key={m} type="button" onClick={() => onChange({ intervalMinutes: m })} className={chipClass(value.intervalMinutes === m)}>
              {m} мин
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Повторить по дням</label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => (
            <button key={d.key} type="button" onClick={() => toggleDay(d.key)} className={chipClass(value.repeatDays.includes(d.key))}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {!hideSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {submitting ? 'Создание...' : submitLabel}
        </button>
      )}
    </div>
  );
}

interface ScheduleEditorProps {
  loadSlots: () => Promise<ScheduleSlot[]>;
  addBatch: (values: ScheduleBatchValues) => Promise<unknown>;
  deleteSlot: (slotId: string) => Promise<unknown>;
  showWeeks?: boolean;
}

/**
 * Редактор расписания мастера — общий для ЛК и админки.
 * Источники данных передаются колбэками, поэтому компонент не знает,
 * чьи именно слоты он редактирует.
 */
export function ScheduleEditor({ loadSlots, addBatch, deleteSlot, showWeeks = false }: ScheduleEditorProps) {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [batch, setBatch] = useState<ScheduleBatchValues>(defaultScheduleBatchValues);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    loadSlots()
      .then((data) => { if (active) setSlots(data); })
      .catch((err) => { if (active) setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки расписания'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleBatchAdd = async () => {
    setBatchLoading(true);
    setBatchError('');
    setActionError('');
    try {
      await addBatch(batch);
      setShowAdd(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Ошибка соединения');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setActionError('');
    try {
      await deleteSlot(id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка удаления слота');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
        {loadError}
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} className="ml-2 underline">Повторить</button>
      </div>
    );
  }

  const grouped: Record<string, ScheduleSlot[]> = {};
  slots.forEach((s) => { (grouped[s.workDate] ??= []).push(s); });
  const sortedDates = Object.keys(grouped).sort();
  const statusColor = (status: string) =>
    status === 'booked' ? 'bg-destructive/10 border-destructive/20 text-destructive'
      : status === 'blocked' ? 'bg-muted border-border/40 text-muted-foreground'
        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600';
  const statusDot = (status: string) => status === 'booked' ? '🔴' : status === 'blocked' ? '⚫' : '🟢';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {slots.length} {pluralRu(slots.length, 'слот', 'слота', 'слотов')}
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {showAdd ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showAdd && (
        <ScheduleBatchForm
          value={batch}
          onChange={(patch) => setBatch((prev) => ({ ...prev, ...patch }))}
          onSubmit={handleBatchAdd}
          submitting={batchLoading}
          error={batchError}
          showWeeks={showWeeks}
        />
      )}

      {actionError && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{actionError}</div>}

      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Calendar className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Нет слотов</p>
          <p className="text-xs opacity-60 mt-1">Добавьте слоты, чтобы клиенты могли записаться</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map((date) => {
            const daySlots = grouped[date];
            const dateObj = new Date(date);
            const isToday = date === new Date().toISOString().split('T')[0];
            const label = isToday ? 'Сегодня' : dateObj.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short' });
            const isExpanded = expandedDate === date;

            return (
              <div key={date} className="rounded-xl border border-border/30 bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedDate(isExpanded ? null : date)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors text-left"
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {daySlots.length} {pluralRu(daySlots.length, 'слот', 'слота', 'слотов')}
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-border/20 divide-y divide-border/10">
                    {[...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((s) => (
                      <div key={s.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${statusColor(s.status)}`}>
                        <span className="flex items-center gap-2">
                          <span className="text-[10px]">{statusDot(s.status)}</span>
                          {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                          {s.notes && <span className="text-[11px] opacity-60 ml-2">{s.notes}</span>}
                        </span>
                        {s.status !== 'booked' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                          >
                            {deletingId === s.id ? '...' : 'Удалить'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
