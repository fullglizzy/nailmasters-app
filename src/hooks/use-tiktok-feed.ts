'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface FeedDesign {
  id: string; title: string; description: string | null;
  images: string[]; videoUrl: string | null;
  likesCount: number; isLiked?: boolean; tags: string[] | null;
  techniques?: string[] | null; materials?: string[] | null;
  color?: string | null; length?: string | null; season?: string | null;
}

interface UseTikTokFeedOptions {
  fetchUrl?: string;
  startId?: string;
}

export function useTikTokFeed({ fetchUrl = '/api/designs?limit=30&sort=popular&includeOwn=true', startId }: UseTikTokFeedOptions = {}) {
  const [designs, setDesigns] = useState<FeedDesign[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaIndex, setMediaIndex] = useState<Record<string, number>>({});
  const [videoPlaying, setVideoPlaying] = useState<Record<string, boolean>>({});
  const [videoMuted, setVideoMuted] = useState<Record<string, boolean>>({});
  const [manualPause, setManualPause] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load designs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(fetchUrl);
        const json = await res.json();
        if (json.success && json.data) {
          const list = Array.isArray(json.data) ? json.data : [];
          setDesigns(list);
          // Init muted state for videos
          const muted: Record<string, boolean> = {};
          list.forEach((d: FeedDesign) => { if (d.videoUrl) muted[d.id] = false; });
          setVideoMuted(muted);

          // Scroll to startId
          if (startId) {
            const idx = list.findIndex((d: FeedDesign) => d.id === startId);
            if (idx >= 0) setCurrentIndex(idx);
          }
        }
      } catch (err) { console.error('Feed load error:', err); }
      finally { setLoading(false); }
    })();
  }, [fetchUrl]);

  // IntersectionObserver for video auto-play
  useEffect(() => {
    if (loading) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const designId = entry.target.getAttribute('data-design-id');
          if (!designId) return;
          const video = videoRefs.current[designId];
          if (!video) return;

          if (!entry.isIntersecting) {
            video.pause();
            video.currentTime = 0;
            setVideoPlaying(p => ({ ...p, [designId]: false }));
            setManualPause(p => ({ ...p, [designId]: false }));
          } else if (!manualPause[designId]) {
            video.currentTime = 0;
            video.play().then(() => setVideoPlaying(p => ({ ...p, [designId]: true }))).catch(() => {});
          }
        });
      },
      { threshold: 0.6 }
    );

    Object.values(videoRefs.current).forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [loading, designs]);

  // Scroll to index
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    const h = containerRef.current.clientHeight;
    containerRef.current.scrollTo({ top: index * h, behavior: 'smooth' });
    setCurrentIndex(index);
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < designs.length - 1) scrollToIndex(currentIndex + 1);
  }, [currentIndex, designs.length, scrollToIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) scrollToIndex(currentIndex - 1);
  }, [currentIndex, scrollToIndex]);

  // Video click: center = toggle play, edges = prev/next media
  const handleVideoClick = useCallback((designId: string, e: React.MouseEvent) => {
    const video = videoRefs.current[designId];
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;

    // Center 40% = play/pause
    if (relX > 0.3 && relX < 0.7) {
      if (video.paused) {
        video.play();
        setVideoPlaying(p => ({ ...p, [designId]: true }));
        setManualPause(p => ({ ...p, [designId]: false }));
      } else {
        video.pause();
        setVideoPlaying(p => ({ ...p, [designId]: false }));
        setManualPause(p => ({ ...p, [designId]: true }));
      }
    } else {
      // Edges = switch media
      const design = designs.find(d => d.id === designId);
      if (!design) return;
      const allMedia = getAllMedia(design);
      if (allMedia.length <= 1) return;
      const cur = mediaIndex[designId] || 0;
      const next = relX > 0.5
        ? (cur + 1) % allMedia.length
        : (cur - 1 + allMedia.length) % allMedia.length;
      setMediaIndex(p => ({ ...p, [designId]: next }));
      video.pause();
      setVideoPlaying(p => ({ ...p, [designId]: false }));
      setManualPause(p => ({ ...p, [designId]: false }));
    }
  }, [designs, mediaIndex]);

  // Image click: left/right to switch media
  const handleImageClick = useCallback((designId: string, e: React.MouseEvent) => {
    const design = designs.find(d => d.id === designId);
    if (!design) return;
    const allMedia = getAllMedia(design);
    if (allMedia.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const cur = mediaIndex[designId] || 0;
    const next = relX > 0.5
      ? (cur + 1) % allMedia.length
      : (cur - 1 + allMedia.length) % allMedia.length;
    setMediaIndex(p => ({ ...p, [designId]: next }));

    // If switching to video, auto-play
    if (allMedia[next]?.type === 'video') {
      setTimeout(() => {
        const video = videoRefs.current[designId];
        if (video) video.play().then(() => setVideoPlaying(p => ({ ...p, [designId]: true }))).catch(() => {});
      }, 100);
    }
  }, [designs, mediaIndex]);

  const toggleSound = useCallback((designId: string) => {
    const video = videoRefs.current[designId];
    if (!video) return;
    video.muted = !video.muted;
    setVideoMuted(p => ({ ...p, [designId]: !p[designId] }));
  }, []);

  const getCurrentMedia = useCallback((designId: string) => {
    const design = designs.find(d => d.id === designId);
    if (!design) return { type: 'image', url: '/placeholder.svg' };
    const allMedia = getAllMedia(design);
    return allMedia[mediaIndex[designId] || 0] || allMedia[0] || { type: 'image', url: '/placeholder.svg' };
  }, [designs, mediaIndex]);

  return {
    designs, currentIndex, loading, containerRef, videoRefs,
    videoPlaying, videoMuted, mediaIndex, manualPause,
    setCurrentIndex, scrollToIndex, goNext, goPrev,
    handleVideoClick, handleImageClick, toggleSound,
    getCurrentMedia, setMediaIndex,
  };
}

// Helper: get all media items for a design (video first, then images)
function getAllMedia(design: FeedDesign): { type: 'video' | 'image'; url: string }[] {
  const media: { type: 'video' | 'image'; url: string }[] = [];
  if (design.videoUrl) media.push({ type: 'video', url: design.videoUrl });
  if (design.images?.length) design.images.forEach(url => media.push({ type: 'image', url }));
  return media;
}
