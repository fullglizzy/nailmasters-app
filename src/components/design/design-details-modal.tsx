'use client';

import { X, Clock, Palette, Scissors, Tag, Calendar, Sparkles, Gem, Heart, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import type { FeedDesign } from '@/lib/types';

interface Props { design: FeedDesign | { id: string; title: string; images: string[]; description?: string | null; likesCount?: number; color?: string | null; length?: string | null; season?: string | null; shape?: string | null; tags?: string[]; techniques?: string[]; materials?: string[]; decorTags?: string[]; moodTags?: string[]; source?: string | null; type?: string | null; durationMinutes?: number | null; videoUrl?: string | null; }; open: boolean; onClose: () => void; }

const SHAPE_LABELS: Record<string, string> = {
  square: 'Квадрат', soft_square: 'Мягкий квадрат', almond: 'Миндаль',
  oval: 'Овал', stiletto: 'Стилет', ballerina: 'Балерина', round: 'Круг',
};
const LENGTH_LABELS: Record<string, string> = { short: 'Короткие', medium: 'Средние', long: 'Длинные' };
const SEASON_LABELS: Record<string, string> = { spring: 'Весна', summer: 'Лето', fall: 'Осень', winter: 'Зима' };

export function DesignDetailsModal({ design, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div role="dialog" aria-modal="true" aria-label={design.title || 'Детали дизайна'} className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-xl modal-enter" onClick={e => e.stopPropagation()}>

        {/* Cover image */}
        {design.images?.[0] && (
          <div className="relative h-48 sm:h-56 overflow-hidden rounded-t-2xl">
            <Image src={design.images[0]} alt={design.title} fill sizes="(max-width: 768px) 100vw, 512px" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-black/60">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className={design.images?.[0] ? '-mt-12 relative z-10' : 'pt-4'}>
          {!design.images?.[0] && (
            <div className="flex items-center justify-between px-6 pt-4">
              <h2 className="font-bold text-xl">{design.title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50"><X className="h-5 w-5" /></button>
            </div>
          )}

          <div className="px-6 pb-6 space-y-5">
            {design.images?.[0] && <h2 className="font-bold text-xl text-white">{design.title}</h2>}

            {/* Description */}
            {design.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{design.description}</p>
            )}

            {/* Quick stats */}
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5"><Heart className="h-4 w-4 text-red-500" /> {design.likesCount} лайков</span>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              {design.color && (
                <MetaBlock icon={Palette} label="Цвет" value={design.color} />
              )}
              {design.length && (
                <MetaBlock icon={Scissors} label="Длина" value={LENGTH_LABELS[design.length] || design.length} />
              )}
              {design.season && (
                <MetaBlock icon={Calendar} label="Сезон" value={SEASON_LABELS[design.season] || design.season} />
              )}
            </div>

            {/* Techniques */}
            {design.techniques && design.techniques.length > 0 && (
              <MetaSection icon={Sparkles} title="Техники">
                <div className="flex flex-wrap gap-1.5">
                  {design.techniques.map(t => (
                    <span key={t} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">{t}</span>
                  ))}
                </div>
              </MetaSection>
            )}

            {/* Materials */}
            {design.materials && design.materials.length > 0 && (
              <MetaSection icon={Gem} title="Материалы">
                <div className="flex flex-wrap gap-1.5">
                  {design.materials.map(m => (
                    <span key={m} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">{m}</span>
                  ))}
                </div>
              </MetaSection>
            )}

            {/* Tags */}
            {design.tags && design.tags.length > 0 && (
              <MetaSection icon={Tag} title="Теги">
                <div className="flex flex-wrap gap-1.5">
                  {design.tags.map(t => (
                    <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs">#{t}</span>
                  ))}
                </div>
              </MetaSection>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaBlock({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-accent/50 p-3">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function MetaSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}
