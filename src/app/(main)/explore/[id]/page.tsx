'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart, MessageCircle, Eye, CalendarCheck, Share2, Volume2, VolumeX,
  ChevronUp, ChevronDown, ArrowLeft, Play, Sparkles,
} from 'lucide-react';
import { useLike } from '@/hooks/use-like';
import { CommentsModal } from '@/components/design/comments-modal';
import { DesignDetailsModal } from '@/components/design/design-details-modal';
import { MastersListModal } from '@/components/design/masters-list-modal';
import { ShareModal } from '@/components/design/share-modal';

interface FeedDesign {
  id: string; title: string; description: string | null;
  images: string[]; videoUrl: string | null;
  likesCount: number; tags: string[] | null;
}

export default function TikTokFeedPage() {
  const { id: startId } = useParams<{ id: string }>();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const [designs, setDesigns] = useState<FeedDesign[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaIdx, setMediaIdx] = useState<Record<string, number>>({});
  const [videoMuted, setVideoMuted] = useState<Record<string, boolean>>({});
  const [videoPlaying, setVideoPlaying] = useState<Record<string, boolean>>({});
  const currentIndexRef = useRef(0);
  const urlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [commentsFor, setCommentsFor] = useState<FeedDesign | null>(null);
  const [detailsFor, setDetailsFor] = useState<FeedDesign | null>(null);
  const [mastersFor, setMastersFor] = useState<FeedDesign | null>(null);
  const [shareFor, setShareFor] = useState<FeedDesign | null>(null);

  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/'));

  // 1. Load designs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/designs?limit=40&sort=popular&includeOwn=true');
        const json = await res.json();
        const list = (json.success && json.data) ? (Array.isArray(json.data) ? json.data : []) : [];
        setDesigns(list);

        // Init muted: all videos start muted, only current card unmutes
        const muted: Record<string, boolean> = {};
        list.forEach((d: FeedDesign) => { if (d.videoUrl) muted[d.id] = true; });
        setVideoMuted(muted);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. Video management: pause all except active, restart from beginning, unmute only active
  useEffect(() => {
    designs.forEach((d, i) => {
      const v = videoRefs.current[d.id];
      if (!v) return;
      if (i === currentIndex) {
        v.currentTime = 0;
        v.play().catch(() => {});
        setVideoPlaying(p => ({ ...p, [d.id]: true }));
        setVideoMuted(p => ({ ...p, [d.id]: false }));
      } else {
        v.pause();
        setVideoPlaying(p => ({ ...p, [d.id]: false }));
        setVideoMuted(p => ({ ...p, [d.id]: true }));
      }
    });
  }, [currentIndex, designs]);

  // 3. Scroll to startId after DOM is ready
  useEffect(() => {
    if (loading || !designs.length || !containerRef.current) return;
    const idx = designs.findIndex((d) => d.id === startId);
    if (idx >= 0) {
      const h = containerRef.current.clientHeight;
      containerRef.current.scrollTo({ top: idx * h, behavior: 'instant' as ScrollBehavior });
      setCurrentIndex(idx);
      currentIndexRef.current = idx;
    }
  }, [loading, designs, startId]);

  // Helper: update ref only (no state change on scroll = no re-render)
  const updateIndex = useCallback((idx: number) => {
    currentIndexRef.current = idx;
    setCurrentIndex(idx); // still update state for UI arrows, but it won't cause full re-render
  }, []);

  // Helpers
  const scrollToIndex = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' });
    updateIndex(idx);
  }, [updateIndex]);

  const goNext = () => { if (currentIndex < designs.length - 1) scrollToIndex(currentIndex + 1); };
  const goPrev = () => { if (currentIndex > 0) scrollToIndex(currentIndex - 1); };

  // 3. One-card-at-a-time scroll: intercept wheel + touch to prevent skipping
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !designs.length) return;

    let wheelAccum = 0;
    const THRESHOLD = 50; // px of wheel delta before triggering a card change
    let scrolling = false;

    // Wheel: accumulate delta, fire one card at a time
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (scrolling) return;
      wheelAccum += e.deltaY;

      if (Math.abs(wheelAccum) >= THRESHOLD) {
        scrolling = true;
        const direction = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        const target = currentIndexRef.current + direction;
        if (target >= 0 && target < designs.length) {
          scrollToIndex(target);
        }
        // Lock for animation duration
        setTimeout(() => { scrolling = false; }, 600);
      }
    };

    // Touch: track start/end, swipe if enough distance
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      if (scrolling) return;
      const diff = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(diff) < 40) return; // too small — ignore
      scrolling = true;
      const direction = diff > 0 ? 1 : -1;
      const target = currentIndexRef.current + direction;
      if (target >= 0 && target < designs.length) {
        scrollToIndex(target);
      }
      setTimeout(() => { scrolling = false; }, 600);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [designs, scrollToIndex]);

  // 4. Scroll tracking + seamless URL sync (native history API = no re-render)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !designs.length) return;

    const onScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      if (idx < 0 || idx >= designs.length) return;
      if (idx === currentIndexRef.current) return;

      updateIndex(idx);

      // Use native history.replaceState — does NOT trigger React/Next.js re-render
      if (urlTimerRef.current) clearTimeout(urlTimerRef.current);
      urlTimerRef.current = setTimeout(() => {
        const d = designs[idx];
        if (d && typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/explore/${d.id}`);
        }
      }, 500);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (urlTimerRef.current) clearTimeout(urlTimerRef.current);
    };
  }, [designs, updateIndex]);

  const toggleSound = (designId: string) => {
    const v = videoRefs.current[designId];
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted((p) => ({ ...p, [designId]: !p[designId] }));
  };

  const handleVideoClick = (designId: string, e: React.MouseEvent) => {
    const v = videoRefs.current[designId];
    if (!v) return;
    const relX = (e.clientX - v.getBoundingClientRect().left) / v.getBoundingClientRect().width;

    if (relX > 0.3 && relX < 0.7) {
      // Center = play/pause
      v.paused ? v.play() : v.pause();
      setVideoPlaying((p) => ({ ...p, [designId]: !v.paused }));
    } else {
      // Edges = prev/next media
      const d = designs.find((x) => x.id === designId);
      if (!d) return;
      const all = getAllMedia(d);
      if (all.length <= 1) return;
      const cur = mediaIdx[designId] || 0;
      const next = relX > 0.5 ? (cur + 1) % all.length : (cur - 1 + all.length) % all.length;
      setMediaIdx((p) => ({ ...p, [designId]: next }));
      v.pause();
      setVideoPlaying((p) => ({ ...p, [designId]: false }));
    }
  };

  const handleImageClick = (designId: string, e: React.MouseEvent) => {
    const d = designs.find((x) => x.id === designId);
    if (!d) return;
    const all = getAllMedia(d);
    if (all.length <= 1) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const cur = mediaIdx[designId] || 0;
    const next = relX > 0.5 ? (cur + 1) % all.length : (cur - 1 + all.length) % all.length;
    setMediaIdx((p) => ({ ...p, [designId]: next }));
    // Auto-play if switched to video
    if (all[next]?.type === 'video') {
      setTimeout(() => {
        const v = videoRefs.current[designId];
        v?.play().catch(() => {});
        setVideoPlaying((p) => ({ ...p, [designId]: true }));
      }, 100);
    }
  };

  if (loading) {
    return <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
    </div>;
  }
  if (!designs.length) {
    return <div className="fixed inset-0 bg-background flex flex-col items-center justify-center">
      <p className="text-xl mb-4">Нет дизайнов</p>
      <button onClick={goBack} className="text-primary hover:underline">Вернуться</button>
    </div>;
  }

  const current = designs[currentIndex];

  return (
    <div className="fixed inset-0 bg-background">
      <button onClick={goBack} className="absolute top-4 left-6 z-30 hidden md:flex items-center rounded-full hover:bg-accent transition-colors">
        <ArrowLeft className="h-8 w-8" />
      </button>

      {/* Feed */}
      <div ref={containerRef} className="h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar" style={{ scrollBehavior: 'smooth' }}>
        {designs.map((design) => {
          const allMedia = getAllMedia(design);
          const curMediaIdx = mediaIdx[design.id] || 0;
          const curMedia = allMedia[curMediaIdx] || allMedia[0] || { type: 'image' as const, url: '/placeholder.svg' };
          const isVideo = curMedia.type === 'video';
          const playing = videoPlaying[design.id] || false;

          return (
            <div key={design.id} className="h-full snap-start flex items-center justify-center p-0 md:p-4">
              <div className="relative overflow-hidden w-full h-full md:w-[55vh] md:h-[95vh] md:rounded-[20px] md:shadow-[0_20px_40px_rgba(0,0,0,0.3)] md:border md:border-border bg-background animate-[fadeIn_0.5s_ease-out]">
                {/* Mobile back */}
                <button onClick={goBack} className="absolute top-3 left-3 z-20 md:hidden rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm">
                  <ArrowLeft className="h-5 w-5" />
                </button>

                {/* Media */}
                <div className="relative w-full h-full">
                  {isVideo ? (
                    <>
                      <video
                        ref={(el) => { videoRefs.current[design.id] = el; }}
                        src={curMedia.url}
                        className="w-full h-full object-cover"
                        loop muted={videoMuted[design.id] ?? false}
                        playsInline data-design-id={design.id}
                        onClick={(e) => handleVideoClick(design.id, e)}
                        onLoadedMetadata={() => {
                          const v = videoRefs.current[design.id];
                          if (!v) return;
                          const idx = designs.findIndex(d => d.id === design.id);
                          if (idx === currentIndexRef.current) {
                            v.currentTime = 0;
                            v.play().catch(() => {});
                            setVideoPlaying(p => ({ ...p, [design.id]: true }));
                            setVideoMuted(p => ({ ...p, [design.id]: false }));
                          } else {
                            // Preload but don't play; ensure paused and muted
                            v.pause();
                            v.muted = true;
                            setVideoMuted(p => ({ ...p, [design.id]: true }));
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
                    <img src={curMedia.url} alt={design.title} className="w-full h-full object-cover cursor-pointer"
                      onClick={(e) => handleImageClick(design.id, e)} />
                  )}

                  {/* Gradient */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)' }} />

                  {/* Sidebar */}
                  <div className="absolute right-5 top-[70%] -translate-y-1/2 flex flex-col gap-5 items-center z-20">
                    <LikeButton designId={design.id} likesCount={design.likesCount} />
                    <CommentButton designId={design.id} onClick={() => setCommentsFor(design)} />
                    <SideBtn icon={Eye} label="Подробнее" onClick={() => setDetailsFor(design)} />
                    <CanDoButton designId={design.id} />
                    <SideBtn icon={CalendarCheck} label="Записаться" onClick={() => setMastersFor(design)} />
                    <SideBtn icon={Share2} label="Поделиться" onClick={() => setShareFor(design)} />
                    {isVideo && <SideBtn icon={videoMuted[design.id] ? VolumeX : Volume2} label="Звук" onClick={() => toggleSound(design.id)} />}
                  </div>

                  {/* Bottom info — compact */}
                  <div className="absolute bottom-0 left-0 right-[80px] p-5 pb-[60px] z-10 text-white">
                    <h2 className="text-xl font-bold leading-tight mb-1.5">{design.title}</h2>
                    {design.description && <p className="text-xs leading-relaxed opacity-70 line-clamp-1 mb-2">{design.description}</p>}
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

                  {/* Media dots */}
                  {allMedia.length > 1 && (
                    <div className="hidden md:flex absolute bottom-5 left-5 right-5 z-20 justify-center gap-2">
                      {allMedia.map((_, i) => (
                        <button key={i} onClick={() => setMediaIdx((p) => ({ ...p, [design.id]: i }))}
                          className={`rounded-full transition-all ${i === curMediaIdx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nav arrows */}
      <div className="hidden md:flex fixed right-10 top-1/2 -translate-y-1/2 flex-col gap-4 z-30">
        <NavBtn onClick={goPrev} disabled={currentIndex === 0}><ChevronUp className="h-[35px] w-[35px]" /></NavBtn>
        <NavBtn onClick={goNext} disabled={currentIndex >= designs.length - 1}><ChevronDown className="h-[35px] w-[35px]" /></NavBtn>
      </div>

      {/* Modals */}
      {commentsFor && <CommentsModal designId={commentsFor.id} designTitle={commentsFor.title} open={!!commentsFor} onClose={() => setCommentsFor(null)} />}
      {detailsFor && <DesignDetailsModal design={detailsFor} open={!!detailsFor} onClose={() => setDetailsFor(null)} />}
      {mastersFor && <MastersListModal designId={mastersFor.id} designTitle={mastersFor.title} open={!!mastersFor} onClose={() => setMastersFor(null)} />}
      {shareFor && <ShareModal open={!!shareFor} onClose={() => setShareFor(null)} title={shareFor.title} designId={shareFor.id} />}
    </div>
  );
}

// Sub-components
function LikeButton({ designId, likesCount: initial }: { designId: string; likesCount: number }) {
  const { isLiked, likesCount, handleLike } = useLike({ designId, initialLikesCount: initial, initialIsLiked: false });
  return (
    <button onClick={handleLike} className="flex flex-col items-center gap-0 group">
      <div className="transition-all group-hover:scale-110 group-active:scale-95">
        <Heart className={`h-8 w-8 text-white ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
      </div>
      <span className="text-[11px] text-white font-medium">{likesCount}</span>
    </button>
  );
}

function CommentButton({ designId, onClick }: { designId: string; onClick: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    fetch(`/api/designs/${designId}/comments?count=1`)
      .then(r => r.json())
      .then(json => { if (json.success && json.data) setCount(json.data.total || 0); })
      .catch(() => {});
  }, [designId]);
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0 group">
      <div className="transition-all group-hover:scale-110 group-active:scale-95">
        <MessageCircle className="h-8 w-8 text-white" />
      </div>
      <span className="text-[11px] text-white font-medium">{count}</span>
    </button>
  );
}

function CanDoButton({ designId }: { designId: string }) {
  const [role, setRole] = useState('');
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setRole(user.role || '');
    if (user.role === 'nailmaster') {
      const token = localStorage.getItem('token');
      fetch(`/api/masters/can-do/${designId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(json => { if (json.success) setAdded(json.data.canDo); })
        .catch(() => {});
    }
  }, [designId]);

  if (role !== 'nailmaster') return null;

  const toggle = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      if (added) {
        await fetch(`/api/masters/can-do/${designId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setAdded(false);
      } else {
        await fetch(`/api/masters/can-do/${designId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        setAdded(true);
      }
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <button onClick={toggle} disabled={loading} className="flex flex-col items-center gap-0 group">
      <div className={`transition-all group-hover:scale-110 group-active:scale-95 ${added ? 'text-gold' : 'text-white'}`}>
        <Sparkles className={`h-8 w-8 ${added ? 'text-gold/30' : ''}`} />
      </div>
      <span className="text-[9px] text-white/80 font-medium text-center leading-tight max-w-[60px]">
        {added ? 'В моих' : 'Я так могу'}
      </span>
    </button>
  );
}

function SideBtn({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0 group">
      <div className="transition-all group-hover:scale-110 group-active:scale-95">
        <Icon className="h-8 w-8 text-white" />
      </div>
      <span className="text-[11px] text-white font-medium text-center whitespace-nowrap">{label}</span>
    </button>
  );
}

function NavBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-[50px] h-[50px] rounded-full bg-white/10 backdrop-blur border border-white/20 text-foreground flex items-center justify-center hover:bg-white/20 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg">
      {children}
    </button>
  );
}

function getAllMedia(design: FeedDesign): { type: 'video' | 'image'; url: string }[] {
  const m: { type: 'video' | 'image'; url: string }[] = [];
  if (design.videoUrl) m.push({ type: 'video', url: design.videoUrl });
  if (design.images?.length) design.images.forEach((url) => m.push({ type: 'image', url }));
  return m;
}
