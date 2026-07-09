'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Star, MapPin, Calendar, Navigation, Clock } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { DistanceBadge } from '@/components/shared/distance-badge';
import { useGeolocation } from '@/hooks/use-geolocation';

interface Master {
  userId: string; fullName: string; rating: string; city: string | null;
  latitude: number | string | null; longitude: number | string | null;
  _price?: string | null; _duration?: number | null;
}
interface Props { designId: string; designTitle: string; open: boolean; onClose: () => void; }

export function MastersListModal({ designId, designTitle, open, onClose }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const { coords: clientCoords, error: geoError, request: requestGeo } = useGeolocation();
  const [clientPlace, setClientPlace] = useState<string>('');

  // Обратный геокодинг: координаты → название места
  useEffect(() => {
    if (!clientCoords) return;
    const { latitude, longitude } = clientCoords;
    // zoom=18 даёт максимальную детализацию (улица + дом)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&accept-language=ru`;
    fetch(url, { headers: { 'User-Agent': 'NailMasters/2.0' } })
      .then(r => r.json())
      .then(data => {
        if (data && data.address) {
          const a = data.address;
          // Собираем от самого конкретного к общему: улица → район → город
          const road = a.road || a.pedestrian || a.path || '';
          const house = a.house_number || '';
          const street = [road, house].filter(Boolean).join(', ');
          const suburb = a.suburb || a.neighbourhood || a.city_district || '';
          const city = a.city || a.town || a.village || '';
          // Приоритет: улица+дом > район+город > просто город
          const place = [street || suburb, city].filter(Boolean).join(', ');
          setClientPlace(place || a.county || a.state || '');
        }
      })
      .catch(() => {});
  }, [clientCoords]);

  // Пробуем геолокацию при открытии. Если браузер заблокирует
  // (нет HTTPS, нет жеста) — покажем кнопку для прямого тапа.
  useEffect(() => {
    if (open) requestGeo();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    console.log('[MastersList] fetching designId=', designId);
    fetch(`/api/designs/${designId}/masters`)
      .then(r => r.json())
      .then(json => { console.log('[MastersList] response:', json); if (json.success) setMasters(json.data || []); })
      .catch(err => console.error('[MastersList] error:', err))
      .finally(() => setLoading(false));
  }, [designId, open]);

  const getNum = (v: number | string | null | undefined): number | null => {
    if (v == null) return null;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) || n === 0 ? null : n;
  };

  if (!open) return null;

  const hasCoords = clientCoords?.latitude != null && clientCoords?.longitude != null;

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

        {/* Показываем откуда считаем расстояние */}
        {hasCoords && masters.length > 0 && !loading && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 rounded-lg bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Расстояние от: <span className="font-medium text-foreground">{clientPlace || 'вас'}</span></span>
            </div>
          </div>
        )}

        {/* Фолбек: если геолокация не получена — кнопка с прямым тапом для iOS Safari */}
        {!hasCoords && !loading && masters.length > 0 && (
          <div className="px-4 pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); requestGeo(); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-accent/30 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/50 transition-all active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" />
              Определить расстояние до мастеров
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : masters.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Пока нет мастеров для этого дизайна</p>
          ) : (
            <div className="space-y-3">
              {masters.map(m => (
                <Link key={m.userId} href={`/masters/${m.userId}?bookDesign=${designId}`}
                  className="flex items-center gap-4 rounded-xl border p-4 hover:bg-accent transition-colors">
                  <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                    {m.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.fullName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {m.rating}</span>
                      {m.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {m.city}</span>}
                      <DistanceBadge
                        masterLat={getNum(m.latitude)}
                        masterLon={getNum(m.longitude)}
                        clientLat={clientCoords?.latitude ?? null}
                        clientLon={clientCoords?.longitude ?? null}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m._price && <span className="text-xs font-bold text-primary">{parseInt(m._price).toLocaleString('ru-RU')} ₽</span>}
                    {m._duration && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3" />{m._duration}м</span>}
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
