'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Service } from '@/lib/types';
import type { CreateServiceInput } from '@/lib/validators';

interface ServicesEditorProps {
  services: Service[];
  onAdd: (input: CreateServiceInput) => Promise<void> | void;
  onUpdate?: (id: string, input: Partial<CreateServiceInput>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  disabled?: boolean;
}

const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all';
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5';

/**
 * Список услуг мастера с добавлением/редактированием/удалением.
 * Не знает про API — действия приходят колбэками.
 */
export function ServicesEditor({ services, onAdd, onUpdate, onDelete, disabled }: ServicesEditorProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setDuration('');
    setError('');
  };

  const startAdd = () => {
    resetForm();
    setEditingId('new');
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description ?? '');
    setPrice(String(service.price));
    setDuration(String(service.duration));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!name.trim()) { setError('Введите название услуги'); return; }
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) { setError('Введите корректную цену'); return; }
    const durationNum = Number(duration);
    if (!duration || !Number.isInteger(durationNum) || durationNum <= 0) { setError('Введите корректную длительность в минутах'); return; }

    setSaving(true);
    setError('');
    const payload: CreateServiceInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: priceNum,
      duration: durationNum,
    };

    try {
      if (editingId && editingId !== 'new' && onUpdate) {
        await onUpdate(editingId, payload);
      } else {
        await onAdd(payload);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения услуги');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: Service) => {
    if (!onDelete) return;
    if (!confirm(`Удалить услугу «${service.name}»?`)) return;
    setError('');
    try {
      await onDelete(service.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления услуги');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {services.length} {services.length === 1 ? 'услуга' : services.length < 5 && services.length > 0 ? 'услуги' : 'услуг'}
        </p>
        <button
          type="button"
          onClick={startAdd}
          disabled={disabled || editingId === 'new'}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          + Добавить услугу
        </button>
      </div>

      {error && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{editingId === 'new' ? 'Новая услуга' : 'Редактировать услугу'}</h4>
            <button type="button" onClick={resetForm} aria-label="Закрыть" className="rounded-full p-1 hover:bg-muted/50">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className={labelClass}>Название *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Маникюр с покрытием" />
          </div>

          <div>
            <label className={labelClass}>Описание</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} placeholder="Что входит в услугу" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Цена ($) *</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={1} step="0.01" className={inputClass} placeholder="45" />
            </div>
            <div>
              <label className={labelClass}>Длительность (мин) *</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min={1} step={1} className={inputClass} placeholder="60" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={resetForm} className="flex-1 rounded-full border py-2 text-sm font-medium hover:bg-accent transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Сохранение...' : editingId === 'new' ? 'Добавить' : 'Сохранить'}
            </button>
          </div>
        </form>
      )}

      {services.length === 0 && editingId === null ? (
        <div className="rounded-2xl border border-dashed border-border/50 py-10 text-center text-muted-foreground">
          <p className="text-sm">У мастера пока нет услуг</p>
          <p className="text-xs opacity-70 mt-1">Добавьте хотя бы одну — она понадобится для записи</p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service) => (
            <div key={service.id} className="rounded-xl border border-border/40 bg-card p-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium truncate">{service.name}</p>
                  {!service.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">скрыта</span>
                  )}
                </div>
                {service.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{service.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  ${Number(service.price).toLocaleString()} · {service.duration} мин
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {onUpdate && (
                  <button type="button" onClick={() => startEdit(service)} aria-label="Редактировать услугу" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button type="button" onClick={() => handleDelete(service)} aria-label="Удалить услугу" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
