'use client';

import Link from 'next/link';
import { Star, MapPin, Award, Shield, Sparkles, Clock } from 'lucide-react';
import { DistanceBadge } from '@/components/shared/distance-badge';

export interface MasterCardData {
  userId: string;
  id?: string;
  fullName: string;
  username?: string;
  description?: string | null;
  city?: string | null;
  rating: string;
  totalOrders?: number;
  reviewsCount?: number;
  specialties?: string[] | null;
  startingPrice?: string | null;
  experience?: string | null;
  workFormat?: string[] | null;
  sterilization?: boolean;
  disposableTools?: boolean;
  avatarUrl?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface MasterCardProps {
  master: MasterCardData;
  delay?: number;
  clientLat?: number | null;
  clientLon?: number | null;
}

export function MasterCard({ master, delay, clientLat, clientLon }: MasterCardProps) {
  const id = master.userId || master.id || '';
  const hasHygiene = master.sterilization || master.disposableTools;
  const getNum = (v: number | string | null | undefined): number | undefined => {
    if (v == null) return undefined;
    return typeof v === 'string' ? parseFloat(v) : v;
  };

  return (
    <Link
      href={`/masters/${id}`}
      className="group relative flex flex-col rounded-2xl border border-border/40 bg-card p-5 hover:shadow-lg hover:border-border transition-all duration-300 animate-reveal"
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      {/* ── Header: avatar + name + rating ── */}
      <div className="flex items-start gap-4">
        {/* Avatar with accent ring */}
        <div className="relative shrink-0">
          {master.avatarUrl ? (
            <img src={master.avatarUrl} alt="" className="h-[52px] w-[52px] rounded-full object-cover ring-2 ring-primary/[0.08] group-hover:ring-primary/20 transition-all duration-300 shrink-0" />
          ) : (
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary/[0.06] ring-2 ring-primary/[0.08] group-hover:ring-primary/20 transition-all duration-300 shrink-0">
              <span className="font-display text-xl text-primary">{master.fullName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          {hasHygiene && (
            <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-white shadow-sm" title="Стерилизация и гигиена">
              <Shield className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Name + rating */}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="font-semibold text-[15px] leading-tight truncate group-hover:text-primary transition-colors">
            {master.fullName}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-current text-gold" />
              <span className="text-sm font-semibold text-gold">{master.rating}</span>
            </div>
            {master.reviewsCount !== undefined && master.reviewsCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({master.reviewsCount} {pluralize(master.reviewsCount, 'отзыв', 'отзыва', 'отзывов')})
              </span>
            )}
            <DistanceBadge
              masterLat={getNum(master.latitude)}
              masterLon={getNum(master.longitude)}
              clientLat={clientLat}
              clientLon={clientLon}
            />
          </div>
        </div>
      </div>

      {/* ── Description ── */}
      {master.description && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {master.description}
        </p>
      )}

      {/* ── Info row ── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {master.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 opacity-60" />
            {master.city}
          </span>
        )}
        {master.experience && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0 opacity-60" />
            {master.experience}
          </span>
        )}
        {master.workFormat && master.workFormat.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Award className="h-3 w-3 shrink-0 opacity-60" />
            {master.workFormat.map(f => f === 'salon' ? 'Салон' : f === 'home' ? 'На дому' : f).join(' · ')}
          </span>
        )}
        {hasHygiene && (
          <span className="inline-flex items-center gap-1 font-medium text-secondary">
            <Sparkles className="h-3 w-3 shrink-0" />
            Стерильно
          </span>
        )}
      </div>

      {/* ── Specialties ── */}
      {master.specialties && master.specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {master.specialties.slice(0, 3).map(s => (
            <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground/80">
              {s}
            </span>
          ))}
          {master.specialties.length > 3 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              +{master.specialties.length - 3}
            </span>
          )}
        </div>
      )}

      {/* ── Price CTA ── */}
      <div className="mt-auto pt-4">
        {master.startingPrice ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Стартовая цена</span>
            <span className="rounded-full bg-primary/[0.06] px-3 py-1 text-sm font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              от {parseInt(master.startingPrice).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            <span className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-all duration-300">
              Цена договорная
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
