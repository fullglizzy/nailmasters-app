'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Star, MapPin, Calendar } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';

interface Master { userId: string; fullName: string; rating: string; city: string | null; }
interface Props { designId: string; designTitle: string; open: boolean; onClose: () => void; }

export function MastersListModal({ designId, designTitle, open, onClose }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/designs/${designId}/masters`)
      .then(r => r.json())
      .then(json => { if (json.success) setMasters(json.data || []); })
      .finally(() => setLoading(false));
  }, [designId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div className="relative z-10 w-full sm:max-w-md max-h-[75vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background shadow-xl modal-enter" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-bold text-lg">Мастера для этого дизайна</h2>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{designTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : masters.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Пока нет мастеров для этого дизайна</p>
          ) : (
            <div className="space-y-3">
              {masters.map(m => (
                <Link key={m.userId} href={`/masters/${m.userId}`}
                  className="flex items-center gap-4 rounded-xl border p-4 hover:bg-accent transition-colors">
                  <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                    {m.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.fullName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {m.rating}</span>
                      {m.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {m.city}</span>}
                    </div>
                  </div>
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
