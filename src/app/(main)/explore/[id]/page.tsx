'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Heart, MessageCircle, Eye, CalendarCheck, Share2, Volume2, VolumeX,
  ChevronUp, ChevronDown, ArrowLeft, Play, Sparkles, X, Check,
} from 'lucide-react';
import { useAuthState } from '@/components/providers/guest-provider';
import { useLike } from '@/hooks/use-like';
import { useDesigns } from '@/hooks/api';
import { useLikedIds } from '@/hooks/use-liked-ids';
import { CommentsModal } from '@/components/design/comments-modal';
import { DesignDetailsModal } from '@/components/design/design-details-modal';
import { MastersListModal } from '@/components/design/masters-list-modal';
import { ShareModal } from '@/components/design/share-modal';
import type { FeedDesign } from '@/lib/types';

/* ── Helpers ────────────────────────────────────────────── */

function getAllMedia(design: FeedDesign): { type: 'video' | 'image'; url: string }[] {
  const m: { type: 'video' | 'image'; url: string }[] = [];
  if (design.videoUrl) m.push({ type: 'video', url: design.videoUrl });
  if (design.images?.length) design.images.forEach((url) => m.push({ type: 'image', url }));
  return m;
}

/** Returns the lowest price among masters offering this design, if known. */
function getMinPrice(design: FeedDesign): number | null {
  const raw = (design as Record<string, unknown>)._minPrice || (design as Record<string, unknown>)._masterPrice;
  if (!raw) return null;
  const n = parseInt(String(raw));
  return n > 0 ? n : null;
}

/* ── Memoized sub-components ────────────────────────────── */

interface LikeButtonProps {
  designId: string;
  likesCount: number;
  isLiked: boolean;
}

const LikeButton = memo(function LikeButton({ designId, likesCount, isLiked: isLikedProp }: LikeButtonProps) {
  const { isLiked, likesCount: count, handleLike } = useLike({
    designId,
    initialLikesCount: likesCount,
    initialIsLiked: isLikedProp,
  });
  return (
    <button onClick={handleLike} className="flex flex-col items-center gap-0 group">
      <div className="transition-all group-hover:scale-110 group-active:scale-95">
        <Heart className={`h-8 w-8 text-white drop-shadow-sm ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
      </div>
      <span className="text-[11px] text-white font-medium">{count}</span>
    </button>
  );
});

interface SideBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subtitle?: string;
  onClick: () => void;
}

const SideBtn = memo(function SideBtn({ icon: Icon, label, subtitle, onClick }: SideBtnProps) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0 group">
      <div className="transition-all group-hover:scale-110 group-active:scale-95">
        <Icon className="h-8 w-8 text-white drop-shadow-sm" />
      </div>
      <span className="text-[11px] text-white font-medium text-center whitespace-nowrap leading-tight">
        {label}
      </span>
      {subtitle && (
        <span className="text-[10px] text-white/70 font-medium">{subtitle}</span>
      )}
    </button>
  );
});

interface NavBtnProps {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}

const NavBtn = memo(function NavBtn({ onClick, disabled, children }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-[50px] h-[50px] rounded-full bg-white/10 backdrop-blur border border-white/20 text-foreground flex items-center justify-center hover:bg-white/20 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
    >
      {children}
    </button>
  );
});

/* ── "Я так могу" modal (lazy-fetched on open) ──────────── */

const CanDoModal = memo(function CanDoModal({ designId, onClose, onChange }: {
  designId: string; onClose: () => void; onChange?: (added: boolean) => void;
}) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/masters/can-do/${designId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAdded(json.data.canDo);
          if (json.data.price) setPrice(String(json.data.price));
          if (json.data.duration) setDuration(String(json.data.duration));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [designId]);

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const body: Record<string, unknown> = {};
      if (price) body.customPrice = String(parseInt(price) || 0);
      if (duration) body.estimatedDuration = parseInt(duration) || 0;
      await fetch(`/api/masters/can-do/${designId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setAdded(true);
      onChange?.(true);
      setSuccess(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/masters/can-do/${designId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdded(false); setPrice(''); setDuration('');
      onChange?.(false);
      onClose();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  /* ── Success screen ──────────────────────────────── */
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
        <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-8 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2">Дизайн добавлен!</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Клиенты увидят этот дизайн в вашем профиле и смогут записаться
          </p>
          <button onClick={onClose} className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Готово
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg">{added ? 'Изменить условия' : 'Я так могу'}</h2>
            <p className="text-xs text-muted-foreground">Укажите цену и время для этого дизайна</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Цена ($)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="10" max="100000" placeholder="30" autoFocus
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Время (мин)</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min="15" max="480" step="15" placeholder="60"
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-6">
          {added && (
            <button onClick={handleRemove} className="flex-1 rounded-full border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20">
              Убрать из моих
            </button>
          )}
          <button onClick={handleSave} disabled={saving || loading} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ═════════════════════════════════════════════════════════
   Page
   ═════════════════════════════════════════════════════════ */

// Number of adjacent cards to preload media for
const PRELOAD_WINDOW = 2;

export default function TikTokFeedPage() {
  const { id: startId } = useParams<{ id: string }>();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const currentIndexRef = useRef(0);
  const urlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasScrolledToStart = useRef(false);
  const rafRef = useRef(0);

  const { role } = useAuthState();

  const { data: designs = [], isLoading } = useDesigns({
    sort: 'popular',
    includeOwn: true,
    limit: 40,
  });

  const likedIds = useLikedIds();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaIdx, setMediaIdx] = useState<Record<string, number>>({});
  const [videoMuted, setVideoMuted] = useState<Record<string, boolean>>({});
  const [videoPlaying, setVideoPlaying] = useState<Record<string, boolean>>({});

  // Modals (one at a time — avoids mounting all)
  const [commentsFor, setCommentsFor] = useState<FeedDesign | null>(null);
  const [detailsFor, setDetailsFor] = useState<FeedDesign | null>(null);
  const [mastersFor, setMastersFor] = useState<FeedDesign | null>(null);
  const [shareFor, setShareFor] = useState<FeedDesign | null>(null);
  const [canDoDesign, setCanDoDesign] = useState<string | null>(null);

  // Track which designs the master already marked "Я так могу"
  const [canDoIds, setCanDoIds] = useState<Set<string>>(new Set());

  // Загружаем can-do дизайны мастера с сервера (переживает перезагрузку)
  useEffect(() => {
    if (role !== 'nailmaster') return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/masters/can-do/ids', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setCanDoIds(new Set(json.data));
        }
      })
      .catch(() => {});
  }, [role]);

  /* ── Init muted state ────────────────────────────────── */
  useEffect(() => {
    if (!designs.length || isLoading) return;
    const muted: Record<string, boolean> = {};
    designs.forEach((d) => {
      if ((d as FeedDesign).videoUrl) muted[d.id] = true;
    });
    setVideoMuted(muted);
  }, [designs, isLoading]);

  /* ── Scroll to start design once ─────────────────────── */
  useEffect(() => {
    if (isLoading || !designs.length || !containerRef.current || hasScrolledToStart.current) return;
    const idx = designs.findIndex((d) => d.id === startId);
    if (idx >= 0) {
      hasScrolledToStart.current = true;
      const h = containerRef.current.clientHeight;
      containerRef.current.scrollTo({ top: idx * h, behavior: 'auto' as ScrollBehavior });
      setCurrentIndex(idx);
      currentIndexRef.current = idx;
    }
  }, [isLoading, designs, startId]);

  /* ── Video: only manage adjacent cards ───────────────── */
  useEffect(() => {
    const idx = currentIndex;
    // Pause all videos outside the visible window, play + unmute current
    designs.forEach((d, i) => {
      const v = videoRefs.current.get(d.id);
      if (!v) return;
      if (i === idx) {
        v.currentTime = 0;
        v.muted = false;
        v.play().catch(() => {});
        setVideoPlaying((p) => ({ ...p, [d.id]: true }));
        setVideoMuted((p) => ({ ...p, [d.id]: false }));
      } else if (Math.abs(i - idx) <= PRELOAD_WINDOW) {
        // Preload adjacent: pause but keep metadata loaded
        v.pause();
        v.muted = true;
        setVideoPlaying((p) => ({ ...p, [d.id]: false }));
        setVideoMuted((p) => ({ ...p, [d.id]: true }));
      } else {
        // Far away: pause + mute (don't need state updates for far cards)
        v.pause();
        v.muted = true;
      }
    });
  }, [currentIndex, designs]);

  /* ── Callbacks (stable references) ───────────────────── */

  const updateIndex = useCallback((idx: number) => {
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
  }, []);

  const scrollToIndex = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    // Instant jump — CSS scroll-snap animates with GPU compositing
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'auto' });
    updateIndex(idx);
  }, [updateIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < designs.length - 1) scrollToIndex(currentIndex + 1);
  }, [currentIndex, designs.length, scrollToIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) scrollToIndex(currentIndex - 1);
  }, [currentIndex, scrollToIndex]);

  const goBack = useCallback(() => {
    const prev = document.referrer;
    if (prev && prev.includes(window.location.host)) router.back();
    else router.push('/');
  }, [router]);

  /* ── Desktop: one-card-at-a-time via wheel ──────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !designs.length) return;

    let cooldown = false;
    const COOLDOWN_MS = 800; // duration of smooth scroll animation

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cooldown) return; // animation in progress, ignore

      const direction = e.deltaY > 0 ? 1 : -1;
      const target = currentIndexRef.current + direction;
      if (target < 0 || target >= designs.length) return;

      cooldown = true;
      el.scrollTo({ top: target * el.clientHeight, behavior: 'auto' });
      updateIndex(target);
      setTimeout(() => { cooldown = false; }, COOLDOWN_MS);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [designs, updateIndex]);

  // Mobile touch: no JS intervention — CSS scroll-snap handles everything natively.
  // GPU-composited, perfectly smooth on iOS and Android.

  /* ── Scroll tracking + URL sync (rAF-throttled) ─────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !designs.length) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!el) return;
        const idx = Math.round(el.scrollTop / el.clientHeight);
        if (idx < 0 || idx >= designs.length) return;
        if (idx === currentIndexRef.current) return;
        updateIndex(idx);

        if (urlTimerRef.current) clearTimeout(urlTimerRef.current);
        urlTimerRef.current = setTimeout(() => {
          const d = designs[idx];
          if (d && typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/explore/${d.id}`);
          }
        }, 500);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (urlTimerRef.current) clearTimeout(urlTimerRef.current);
    };
  }, [designs, updateIndex]);

  /* ── Media interaction callbacks ─────────────────────── */

  const toggleSound = useCallback((designId: string) => {
    const v = videoRefs.current.get(designId);
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted((p) => ({ ...p, [designId]: !p[designId] }));
  }, []);

  const handleVideoClick = useCallback((designId: string, e: React.MouseEvent) => {
    const v = videoRefs.current.get(designId);
    if (!v) return;
    const relX = (e.clientX - v.getBoundingClientRect().left) / v.getBoundingClientRect().width;
    if (relX > 0.3 && relX < 0.7) {
      v.paused ? v.play() : v.pause();
      setVideoPlaying((p) => ({ ...p, [designId]: !v.paused }));
    } else {
      const d = designs.find((x) => x.id === designId);
      if (!d) return;
      const all = getAllMedia(d as FeedDesign);
      if (all.length <= 1) return;
      const cur = mediaIdx[designId] || 0;
      const next = relX > 0.5 ? (cur + 1) % all.length : (cur - 1 + all.length) % all.length;
      setMediaIdx((p) => ({ ...p, [designId]: next }));
      v.pause();
      setVideoPlaying((p) => ({ ...p, [designId]: false }));
    }
  }, [designs, mediaIdx]);

  const handleImageClick = useCallback((designId: string, e: React.MouseEvent) => {
    const d = designs.find((x) => x.id === designId);
    if (!d) return;
    const all = getAllMedia(d as FeedDesign);
    if (all.length <= 1) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const cur = mediaIdx[designId] || 0;
    const next = relX > 0.5 ? (cur + 1) % all.length : (cur - 1 + all.length) % all.length;
    setMediaIdx((p) => ({ ...p, [designId]: next }));
    if (all[next]?.type === 'video') {
      setTimeout(() => {
        const v = videoRefs.current.get(designId);
        v?.play().catch(() => {});
        setVideoPlaying((p) => ({ ...p, [designId]: true }));
      }, 100);
    }
  }, [designs, mediaIdx]);

  /* ── Loading / empty ─────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
      </div>
    );
  }

  if (!designs.length) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center">
        <p className="text-xl mb-4">Нет дизайнов</p>
        <button onClick={goBack} className="text-primary hover:underline">Вернуться</button>
      </div>
    );
  }

  const castDesign = (d: typeof designs[number]): FeedDesign => d as unknown as FeedDesign;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-background">
      {/* Desktop back button */}
      <button onClick={goBack} className="absolute top-4 left-6 z-30 hidden md:flex items-center rounded-full hover:bg-accent transition-colors">
        <ArrowLeft className="h-8 w-8" />
      </button>

      {/* Feed */}
      <div ref={containerRef} className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar" style={{ scrollBehavior: 'smooth' }}>
        {designs.map((d) => {
          const design = castDesign(d);
          const allMedia = getAllMedia(design);
          const curMediaIdx = mediaIdx[design.id] || 0;
          const curMedia = allMedia[curMediaIdx] || allMedia[0] || { type: 'image' as const, url: '/placeholder.svg' };
          const isVideo = curMedia.type === 'video';
          const playing = videoPlaying[design.id] || false;
          const minPrice = getMinPrice(design);

          return (
            <div key={design.id} className="h-full snap-start snap-always flex items-center justify-center p-0 md:p-4">
              <div className="relative overflow-hidden w-full h-full md:w-[55vh] md:h-[95vh] md:rounded-[20px] md:shadow-[0_20px_40px_rgba(0,0,0,0.3)] md:border md:border-border bg-background animate-[fadeIn_0.5s_ease-out]">
                {/* Mobile back */}
                <button onClick={goBack} className="absolute top-3 left-3 z-20 md:hidden rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm">
                  <ArrowLeft className="h-5 w-5" />
                </button>

                {/* Media */}
                <div
                  className="relative w-full h-full"
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    // Store touch origin on the element itself via dataset
                    (e.currentTarget as HTMLElement).dataset.swipeX = String(t.clientX);
                    (e.currentTarget as HTMLElement).dataset.swipeY = String(t.clientY);
                  }}
                  onTouchEnd={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    const startX = parseFloat(el.dataset.swipeX || '0');
                    const startY = parseFloat(el.dataset.swipeY || '0');
                    const dx = startX - e.changedTouches[0].clientX;
                    const dy = startY - e.changedTouches[0].clientY;
                    // Only handle horizontal swipes (ignore vertical — those are for design switching)
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
                      e.stopPropagation(); // Don't let it bubble to vertical scroll
                      const all = getAllMedia(design);
                      if (all.length <= 1) return;
                      const cur = mediaIdx[design.id] || 0;
                      const next = dx > 0 ? (cur + 1) % all.length : (cur - 1 + all.length) % all.length;
                      setMediaIdx((p) => ({ ...p, [design.id]: next }));
                      // Pause video if switching away from one
                      const v = videoRefs.current.get(design.id);
                      if (v) { v.pause(); setVideoPlaying((p) => ({ ...p, [design.id]: false })); }
                    }
                    delete el.dataset.swipeX;
                    delete el.dataset.swipeY;
                  }}
                >
                  {isVideo ? (
                    <>
                      <video
                        ref={(el) => { videoRefs.current.set(design.id, el); }}
                        src={curMedia.url}
                        className="w-full h-full object-cover"
                        loop
                        muted={videoMuted[design.id] ?? false}
                        playsInline
                        data-design-id={design.id}
                        onClick={(e) => handleVideoClick(design.id, e)}
                        preload="metadata"
                        onLoadedMetadata={() => {
                          const v = videoRefs.current.get(design.id);
                          if (!v) return;
                          const idx = designs.findIndex((x) => x.id === design.id);
                          if (idx === currentIndexRef.current) {
                            v.currentTime = 0;
                            v.play().catch(() => {});
                            setVideoPlaying((p) => ({ ...p, [design.id]: true }));
                            setVideoMuted((p) => ({ ...p, [design.id]: false }));
                          } else {
                            v.pause();
                            v.muted = true;
                            setVideoMuted((p) => ({ ...p, [design.id]: true }));
                          }
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className={`rounded-full bg-black/60 p-4 transition-opacity duration-300 ${playing ? 'opacity-0' : 'opacity-100'}`}>
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <Image
                      src={curMedia.url} alt={design.title} fill
                      sizes="(max-width: 768px) 100vw, 55vh"
                      className="object-cover cursor-pointer"
                      onClick={(e) => handleImageClick(design.id, e)}
                      priority
                    />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)' }} />

                  {/* Right sidebar — TikTok-style action buttons */}
                  <div className="absolute right-5 top-[70%] -translate-y-1/2 flex flex-col gap-5 items-center z-20">
                    <LikeButton designId={design.id} likesCount={design.likesCount} isLiked={likedIds.has(design.id)} />
                    <SideBtn icon={MessageCircle} label="Коммент." onClick={() => setCommentsFor(design)} />
                    <SideBtn icon={Eye} label="Подробнее" onClick={() => setDetailsFor(design)} />
                    {role === 'nailmaster' ? (
                      canDoIds.has(design.id) ? (
                        <SideBtn icon={Check} label="Добавлено" onClick={() => setCanDoDesign(design.id)} />
                      ) : (
                        <SideBtn icon={Sparkles} label="Я так могу" onClick={() => setCanDoDesign(design.id)} />
                      )
                    ) : (
                      <SideBtn
                        icon={CalendarCheck}
                        label="Записаться"
                        subtitle={minPrice ? `от $${minPrice.toLocaleString('en-US')}` : undefined}
                        onClick={() => setMastersFor(design)}
                      />
                    )}
                    <SideBtn icon={Share2} label="Поделиться" onClick={() => setShareFor(design)} />
                    {isVideo && (
                      <SideBtn
                        icon={videoMuted[design.id] ? VolumeX : Volume2}
                        label="Звук"
                        onClick={() => toggleSound(design.id)}
                      />
                    )}
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-[80px] p-5 pb-[60px] z-10 text-white">
                    {/* Media indicator dots — above title, videos show play triangle */}
                    {allMedia.length > 1 && (
                      <div className="flex justify-center items-center gap-2 mb-3">
                        {allMedia.map((m, i) =>
                          m.type === 'video' ? (
                            <button
                              key={i}
                              onClick={() => setMediaIdx((p) => ({ ...p, [design.id]: i }))}
                              className={`transition-all flex items-center justify-center ${
                                i === curMediaIdx ? 'opacity-100 scale-110' : 'opacity-50 hover:opacity-80'
                              }`}
                            >
                              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" className="text-white drop-shadow-sm">
                                <path d="M0 0v12l10-6z" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              key={i}
                              onClick={() => setMediaIdx((p) => ({ ...p, [design.id]: i }))}
                              className={`rounded-full transition-all ${
                                i === curMediaIdx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                              }`}
                            />
                          )
                        )}
                      </div>
                    )}
                    <h2 className="text-xl font-bold leading-tight mb-1.5">{design.title}</h2>
                    {design.description && (
                      <p className="text-xs leading-relaxed opacity-70 line-clamp-1 mb-2">{design.description}</p>
                    )}
                    {design.tags && design.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {design.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-full bg-white/10 backdrop-blur border border-white/15 px-2 py-0.5 text-[10px]">#{t}</span>
                        ))}
                        {design.tags.length > 3 && (
                          <span className="rounded-full bg-white/10 backdrop-blur border border-white/15 px-2 py-0.5 text-[10px]">+{design.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop nav arrows */}
      <div className="hidden md:flex fixed right-10 top-1/2 -translate-y-1/2 flex-col gap-4 z-30">
        <NavBtn onClick={goPrev} disabled={currentIndex === 0}>
          <ChevronUp className="h-[35px] w-[35px]" />
        </NavBtn>
        <NavBtn onClick={goNext} disabled={currentIndex >= designs.length - 1}>
          <ChevronDown className="h-[35px] w-[35px]" />
        </NavBtn>
      </div>

      {/* Modals — only one mounted at a time */}
      {commentsFor && (
        <CommentsModal
          designId={commentsFor.id}
          designTitle={commentsFor.title}
          open={!!commentsFor}
          onClose={() => setCommentsFor(null)}
        />
      )}
      {detailsFor && (
        <DesignDetailsModal design={detailsFor} open={!!detailsFor} onClose={() => setDetailsFor(null)} />
      )}
      {mastersFor && (
        <MastersListModal designId={mastersFor.id} designTitle={mastersFor.title} open={!!mastersFor} onClose={() => setMastersFor(null)} />
      )}
      {shareFor && (
        <ShareModal open={!!shareFor} onClose={() => setShareFor(null)} title={shareFor.title} designId={shareFor.id} />
      )}
      {canDoDesign && (
        <CanDoModal
          designId={canDoDesign}
          onClose={() => setCanDoDesign(null)}
          onChange={(added) => {
            setCanDoIds((prev) => {
              const next = new Set(prev);
              added ? next.add(canDoDesign) : next.delete(canDoDesign);
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
