import { MapPin } from 'lucide-react';
import { haversineDistance } from '@/lib/geo';

interface DistanceBadgeProps {
  /** Координаты мастера */
  masterLat: number | null | undefined;
  masterLon: number | null | undefined;
  /** Координаты клиента */
  clientLat: number | null | undefined;
  clientLon: number | null | undefined;
  /** Доп. классы */
  className?: string;
}

/**
 * Бейдж с расстоянием от клиента до мастера.
 * Если координат нет — не рендерится.
 */
export function DistanceBadge({ masterLat, masterLon, clientLat, clientLon, className = '' }: DistanceBadgeProps) {
  if (masterLat == null || masterLon == null || clientLat == null || clientLon == null) return null;

  const km = haversineDistance(clientLat, clientLon, masterLat, masterLon);
  const display = km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
      <MapPin className="h-3 w-3" />
      {display}
    </span>
  );
}
