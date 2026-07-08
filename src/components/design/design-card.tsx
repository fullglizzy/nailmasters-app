'use client';

import Link from 'next/link';
import { Heart, Play, ShoppingBag } from 'lucide-react';
import { useLike } from '@/hooks/use-like';

interface DesignCardProps {
  design: {
    id: string; title: string;
    images?: string[]; videoUrl?: string | null;
    likesCount?: number; ordersCount?: number;
  };
  rank?: number;
  href?: string;
  delay?: number;
}

export function DesignCard({ design, rank, href, delay }: DesignCardProps) {
  const { isLiked, likesCount, handleLike, isLoading } = useLike({
    designId: design.id,
    initialLikesCount: design.likesCount || 0,
    initialIsLiked: false,
  });

  const hasVideo = design.videoUrl && design.videoUrl.trim() !== '';
  const hasImages = design.images && design.images.length > 0;
  const link = href || `/explore/${design.id}`;

  return (
    <Link
      href={link}
      className="group gloss-highlight relative overflow-hidden rounded-2xl border border-border/40 bg-card hover:shadow-lg transition-all duration-300 animate-reveal"
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      {/* Media */}
      <div className="aspect-[4/5] overflow-hidden bg-muted/40">
        {hasImages ? (
          <img
            src={design.images![0]}
            alt={design.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : hasVideo ? (
          <video
            src={design.videoUrl!}
            className="h-full w-full object-cover pointer-events-none"
            muted loop playsInline preload="metadata"
            onLoadedMetadata={e => { e.currentTarget.currentTime = 0.1; }}
          />
        ) : (
          <img src="/placeholder.svg" alt={design.title} className="h-full w-full object-cover" loading="lazy" />
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

      {/* Like overlay */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLike(); }}
        disabled={isLoading}
        className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
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