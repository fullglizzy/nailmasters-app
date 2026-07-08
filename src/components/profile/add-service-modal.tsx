'use client';

import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

const DURATION_PRESETS = [
  { value: '30', label: '30 мин' },
  { value: '60', label: '1 час' },
  { value: '90', label: '1,5 часа' },
  { value: '120', label: '2 часа' },
  { value: '180', label: '3 часа' },
];

export function AddServiceModal({ open, onClose, onCreated }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !duration) { setError('Заполните обязательные поля'); return; }
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/masters/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: description || undefined, price: Number(price), duration: Number(duration) }),
      });
      const json = await res.json();
      if (json.success) { onCreated(); onClose(); setName(''); setDescription(''); setPrice(''); setDuration('60'); }
      else setError(json.error || 'Ошибка');
    } catch { setError('Ошибка соединения'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  const inputClass = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Новая услуга" className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg">Новая услуга</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Название *</label>
            <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} placeholder="Маникюр с покрытием" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputClass + ' resize-none'} placeholder="Что входит в услугу..." />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Цена (₽) *</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" required className={inputClass} placeholder="2500" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Длительность *</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDuration(p.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                    duration === p.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="h-3 w-3 inline mr-1" />{p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-full border border-border/60 py-2.5 text-sm font-medium hover:bg-surface transition-colors">Отмена</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
