'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { AuthGuardModal } from '@/components/auth/auth-guard-modal';
import { useAuth } from '@/components/providers/auth-provider';

interface Props {
  open: boolean;
  onClose: () => void;
  masterId: string;
  masterName: string;
  onSubmitted: () => void;
}

export function ReviewModal({ open, onClose, masterId, masterName, onSubmitted }: Props) {
  const { getToken } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showAuthGuard, setShowAuthGuard] = useState(false);

  const handleSubmit = async () => {
    if (!rating) { setError('Поставьте оценку'); return; }
    const token = getToken();
    if (!token) { setShowAuthGuard(true); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/master-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ratingNumber: rating, description: text || undefined, nailMasterId: masterId }),
      });
      const json = await res.json();
      if (json.success) { setSuccess(true); onSubmitted(); }
      else setError(json.error || 'Ошибка');
    } catch { setError('Ошибка соединения'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
        <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-8 shadow-xl modal-enter text-center" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-4">⭐</div>
          <h3 className="text-xl font-bold mb-2">Спасибо за отзыв!</h3>
          <p className="text-sm text-muted-foreground mb-6">Ваша оценка поможет другим клиентам</p>
          <button onClick={onClose} className="rounded-full bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground">Готово</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div role="dialog" aria-modal="true" aria-label="Оставить отзыв" className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg">Оставить отзыв</h2>
            <p className="text-xs text-muted-foreground">{masterName}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{error}</div>}

        {/* Stars */}
        <div className="flex justify-center gap-1 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-10 w-10 transition-colors ${
                  i <= (hover || rating) ? 'fill-gold text-gold' : 'text-muted-foreground/30'
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && <p className="text-center text-sm text-muted-foreground mb-4">{['', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'][rating]}</p>}

        <div className="mb-6">
          <label className="block text-xs font-medium mb-1.5">Комментарий</label>
          <textarea
            value={text} onChange={e => setText(e.target.value)} rows={3}
            className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            placeholder="Поделитесь впечатлениями о работе мастера..."
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || !rating}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
        >
          {saving ? 'Отправка...' : 'Отправить отзыв'}
        </button>
      </div>

      <AuthGuardModal open={showAuthGuard} onClose={() => setShowAuthGuard(false)} action="оставить отзыв" />
    </div>
  );
}
