'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, Play, ShoppingBag, Clock } from 'lucide-react';
import { useLike } from '@/hooks/use-like';

interface DesignCardProps {
  design: {
    id: string; title: string;
    images?: string[]; videoUrl?: string | null;
    likesCount?: number; ordersCount?: number;
    _masterPrice?: string | number | null;
    _masterDuration?: string | number | null;
  };
  /** Passed from parent via batch check (useLikedIds) — never default to false */
  isLiked?: boolean;
  rank?: number;
  href?: string;
  delay?: number;
}

export function DesignCard({ design, isLiked: isLikedProp, rank, href, delay }: DesignCardProps) {
  const { isLiked, likesCount, handleLike, isLoading } = useLike({
    designId: design.id,
    initialLikesCount: design.likesCount || 0,
    initialIsLiked: isLikedProp ?? false,
  });

  const hasVideo = design.videoUrl && design.videoUrl.trim() !== '';
  const hasImages = design.images && design.images.length > 0;
  const link = href || `/explore/${design.id}`;
  const price = design._masterPrice ? parseInt(String(design._masterPrice)).toLocaleString('ru-RU') : null;
  const duration = design._masterDuration ? parseInt(String(design._masterDuration)) : null;

  return (
    <Link
      href={link}
      className="group gloss-highlight relative overflow-hidden rounded-2xl border border-border/40 bg-card hover:shadow-lg transition-all duration-300 animate-reveal"
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      {/* Price/duration overlay — only on master page */}
      {(price || duration) && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {price && (
            <span className="rounded-full bg-background/85 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-primary shadow-sm border border-border/40">
              {price} ₽
            </span>
          )}
          {duration && (
            <span className="rounded-full bg-background/85 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm border border-border/40 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />{duration}м
            </span>
          )}
        </div>
      )}
      {/* Media */}
      <div className="aspect-[4/5] overflow-hidden bg-muted/40 relative">
        {hasImages ? (
          <Image
            src={design.images![0]}
            alt={design.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : hasVideo ? (
          <video
            src={design.videoUrl!}
            className="h-full w-full object-cover pointer-events-none"
            muted loop playsInline preload="metadata"
            onLoadedMetadata={e => { e.currentTarget.currentTime = 0.1; }}
          />
        ) : (
          <Image src="/placeholder.svg" alt={design.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
        )}

        {hasVideo && (
          <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <Play className="h-3 w-3 fill-white" />
          </div>
        )}
      </div>

      {/* Rank badge (trending only) */}
      {rank && (
        <div className="absolute top-3 left-3 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-white shadow-md">
          #{rank}
        </div>
      )}

      {/* Like overlay — always visible on mobile to avoid double-tap hover trap */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLike(); }}
        disabled={isLoading}
        className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
      >
        <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-primary text-primary' : ''}`} />
        <span>{likesCount}</span>
      </button>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{design.title}</h3>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{likesCount}</span>
          {design.ordersCount !== undefined && (
            <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{design.ordersCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
}