'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles, Plus, X, Upload, Hash, Eye, Play } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

/* ── Constants ──────────────────────────────────────────── */

const SHAPE_LABELS: Record<string, string> = {
  square: 'Квадрат', soft_square: 'Мягкий кв.', almond: 'Миндаль', oval: 'Овал', stiletto: 'Стилет', ballerina: 'Балерина',
};
const LENGTH_LABELS: Record<string, string> = { short: 'Короткие', medium: 'Средние', long: 'Длинные' };
const SEASON_LABELS: Record<string, string> = { spring: 'Весна', summer: 'Лето', fall: 'Осень', winter: 'Зима' };

const CATEGORIES: { key: string; label: string; values: string[] }[] = [
  { key: 'techniques', label: 'Техника', values: ['Френч', 'Омбре', 'Градиент', 'Стемпинг', 'Лепка', 'Роспись', 'Слайдер', 'Фольга', 'Стразы', 'Блестки', 'Втирка', 'Кошачий глаз', 'Мрамор', 'Акварель', 'Nude'] },
  { key: 'shapes', label: 'Форма', values: Object.keys(SHAPE_LABELS) },
  { key: 'lengths', label: 'Длина', values: Object.keys(LENGTH_LABELS) },
  { key: 'seasons', label: 'Сезон', values: Object.keys(SEASON_LABELS) },
  { key: 'moods', label: 'Настроение', values: ['Повседневный', 'Праздничный', 'Свадебный', 'Романтичный', 'Дерзкий', 'Минимализм', 'Гламур', 'Офисный', 'Вечерний', 'Креативный'] },
  { key: 'materials', label: 'Материалы', values: ['Гель', 'Акрил', 'Гель-лак', 'Шеллак', 'Полигель', 'Типсы', 'Накладные'] },
];

const HUMAN_LABELS: Record<string, Record<string, string>> = { shapes: SHAPE_LABELS, lengths: LENGTH_LABELS, seasons: SEASON_LABELS };

/* ── Types ───────────────────────────────────────────────── */

interface MediaItem { url: string; type: 'image' | 'video'; }

/* ═════════════════════════════════════════════════════════
   Page
   ═════════════════════════════════════════════════════════ */

export default function CreateDesignPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const submittingRef = useRef(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const tagInputRef = useRef<HTMLInputElement>(null);

  /* ── Auto-open file picker on mount ─────────────────── */

  useEffect(() => {
    const timer = setTimeout(() => fileInputRef.current?.click(), 400);
    return () => clearTimeout(timer);
  }, []);

  /* ── Upload handler ─────────────────────────────────── */

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const imageFiles: File[] = [];
    const videoFiles: File[] = [];
    Array.from(files).forEach((f) => {
      if (f.type.startsWith('video/')) videoFiles.push(f);
      else imageFiles.push(f);
    });

    setUploading(true);
    setError('');

    const token = getToken();
    try {
      const results: MediaItem[] = [];

      if (imageFiles.length > 0) {
        const fd = new FormData();
        imageFiles.forEach((f) => fd.append('images', f));
        const res = await fetch('/api/designs/upload-images', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const json = await res.json();
        if (json.success) {
          results.push(...json.data.files.map((f: { url: string }) => ({ url: f.url, type: 'image' as const })));
        } else {
          setError(json.error || 'Ошибка загрузки');
        }
      }

      for (const vf of videoFiles) {
        if (vf.size > 100 * 1024 * 1024) {
          setError('Видео не должно превышать 100 МБ');
          continue;
        }
        const fd = new FormData();
        fd.append('video', vf);
        const res = await fetch('/api/designs/upload-video', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const json = await res.json();
        if (json.success) {
          results.push({ url: json.data.url, type: 'video' as const });
        }
      }

      if (results.length > 0) {
        setMedia((prev) => [...prev, ...results]);
        setPreviewMode(true);
        setPreviewIdx(0);
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [getToken]);

  /* ── Tags ────────────────────────────────────────────── */

  const addTag = (t: string) => {
    const trimmed = t.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };
  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags((prev) => prev.slice(0, -1));
  };

  /* ── Filters ─────────────────────────────────────────── */

  const toggleFilter = (cat: string, val: string) => {
    setSelectedFilters((prev) => {
      const cur = prev[cat] || [];
      return { ...prev, [cat]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] };
    });
  };
  const activeFilterCount = Object.values(selectedFilters).reduce((s, a) => s + a.length, 0);

  /* ── Rotate image via Canvas ────────────────────────── */

  const rotateImage = (url: string, degrees: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        // Swap dimensions for 90° / 270° rotations
        const swap = degrees % 180 !== 0;
        canvas.width = swap ? img.naturalHeight : img.naturalWidth;
        canvas.height = swap ? img.naturalWidth : img.naturalHeight;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', 0.9);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  /* ── Submit ──────────────────────────────────────────── */

  const canSubmit = media.length > 0 && title.trim().length >= 3;

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!canSubmit) {
      setError('Добавьте хотя бы одно фото и название (от 3 символов)');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError('');

    const token = getToken();
    try {
      // Rotate images that need rotation, upload rotated versions
      const rotatedUrls: Record<number, string> = {};
      const rotationEntries = Object.entries(rotations).filter(([, deg]) => deg !== 0 && deg !== 360);

      if (rotationEntries.length > 0) {
        setError('Обработка повёрнутых фото...');
        for (const [idxStr, deg] of rotationEntries) {
          const idx = parseInt(idxStr);
          const item = media[idx];
          if (!item || item.type !== 'image') continue;
          try {
            const blob = await rotateImage(item.url, deg);
            const fd = new FormData();
            fd.append('images', blob, `rotated_${idx}.jpg`);
            const uploadRes = await fetch('/api/designs/upload-images', {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: fd,
            });
            const uploadJson = await uploadRes.json();
            if (uploadJson.success && uploadJson.data.files?.[0]) {
              rotatedUrls[idx] = uploadJson.data.files[0].url;
            }
          } catch { /* skip failed rotations, use original */ }
        }
        setError('');
      }

      // Build final media list with rotated URLs
      const images = media.map((m, i) => {
        if (m.type !== 'image') return null;
        return rotatedUrls[i] || m.url;
      }).filter(Boolean) as string[];

      const video = media.find((m) => m.type === 'video');
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          description: description || undefined,
          images: images.length ? images : undefined,
          videoUrl: video?.url || undefined,
          tags: tags.length ? tags : undefined,
          length: selectedFilters.lengths?.[0] || undefined,
          shape: selectedFilters.shapes?.[0] || undefined,
          season: selectedFilters.seasons?.[0] || undefined,
          techniques: selectedFilters.techniques?.length ? selectedFilters.techniques : undefined,
          moodTags: selectedFilters.moods?.length ? selectedFilters.moods : undefined,
          materials: selectedFilters.materials?.length ? selectedFilters.materials : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/explore/${json.data.id}`);
      } else {
        setError(json.error || 'Ошибка создания');
        submittingRef.current = false;
        setSubmitting(false);
      }
    } catch {
      setError('Ошибка соединения');
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /* ── Style ──────────────────────────────────────────── */

  const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all';

  const hasMedia = media.length > 0;

  /* ── Fullscreen preview mode ─────────────────────── */

  if (previewMode && media.length > 0) {
    const cur = media[previewIdx] || media[0];
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button onClick={() => { setPreviewMode(false); setPreviewIdx(0); }} className="text-white/70 hover:text-white text-sm">
            <ArrowLeft className="h-5 w-5 inline mr-1" />Назад
          </button>
          <span className="text-white/50 text-xs">{previewIdx + 1} / {media.length}</span>
          {cur.type === 'image' ? (
            <button
              onClick={() => setRotations((p) => ({ ...p, [previewIdx]: ((p[previewIdx] || 0) + 90) % 360 }))}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" /><path d="M3.5 15.5a9 9 0 1 0 3-13.5L1 10" />
              </svg>
            </button>
          ) : (
            <button onClick={() => setPreviewMode(false)} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors">
              Далее
            </button>
          )}
        </div>

        {/* Media — fullscreen, swipeable */}
        <div
          className="flex-1 relative overflow-hidden"
          onTouchStart={(e) => {
            (e.currentTarget as HTMLElement).dataset.swipeX = String(e.touches[0].clientX);
          }}
          onTouchEnd={(e) => {
            const el = e.currentTarget as HTMLElement;
            const startX = parseFloat(el.dataset.swipeX || '0');
            const dx = startX - e.changedTouches[0].clientX;
            if (Math.abs(dx) > 50) {
              setPreviewIdx((p) => {
                const next = dx > 0 ? p + 1 : p - 1;
                return Math.max(0, Math.min(media.length - 1, next));
              });
            }
            delete el.dataset.swipeX;
          }}
        >
          {/* Swipeable media container */}
          <div
            className="h-full flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${previewIdx * 100}%)` }}
          >
            {media.map((item, i) => (
              <div key={i} className="h-full w-full shrink-0 flex items-center justify-center relative">
                {item.type === 'video' ? (
                  <video
                    ref={(el) => { videoRefs.current.set(item.url, el); }}
                    src={item.url}
                    className="max-h-full max-w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={item.url}
                    alt={`Preview ${i + 1}`}
                    fill
                    sizes="100vw"
                    className="object-contain transition-transform duration-300"
                    style={{ transform: `rotate(${rotations[i] || 0}deg)` }}
                    priority={i === previewIdx}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Swipe arrows */}
          {previewIdx > 0 && (
            <button
              onClick={() => setPreviewIdx((p) => p - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {previewIdx < media.length - 1 && (
            <button
              onClick={() => setPreviewIdx((p) => p + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>

        {/* Dots + Add more */}
        <div className="shrink-0 py-4 px-4 space-y-3">
          <div className="flex justify-center items-center gap-2">
            {media.map((m, i) => (
              <button
                key={i}
                onClick={() => setPreviewIdx(i)}
                className={`transition-all flex items-center ${
                  i === previewIdx ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-70'
                }`}
              >
                {m.type === 'video' ? (
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" className="text-white">
                    <path d="M0 0v12l10-6z" />
                  </svg>
                ) : (
                  <span className={`block rounded-full transition-all ${
                    i === previewIdx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/60'
                  }`} />
                )}
              </button>
            ))}
          </div>

          {/* Add more + Continue */}
          <div className="flex gap-3">
            <label className={`flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors text-center cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Добавить'}
              <input type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={() => setPreviewMode(false)}
              className="flex-[2] rounded-full bg-white py-3 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
            >
              Далее
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Back */}
      <div className="px-4 pt-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4 pb-24">
        {/* ── Media area ── */}
        {hasMedia ? (
          <div className="space-y-4 mb-6">
            {/* Fullscreen-style preview grid */}
            <div className="grid grid-cols-3 gap-2">
              {media.map((item, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted ring-1 ring-border/20 group">
                  {item.type === 'video' ? (
                    <>
                      <video
                        ref={(el) => { videoRefs.current.set(item.url, el); }}
                        src={item.url}
                        className="h-full w-full object-cover cursor-pointer bg-black"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          v.currentTime = 0;
                          v.play().then(() => v.pause()).catch(() => {});
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = videoRefs.current.get(item.url);
                          if (!v) return;
                          if (v.paused) {
                            // Pause any other playing video
                            videoRefs.current.forEach((other, key) => {
                              if (key !== item.url && other) { other.pause(); other.currentTime = 0; }
                            });
                            v.play().catch(() => {});
                            setPlayingVideo(item.url);
                          } else {
                            v.pause();
                            setPlayingVideo(null);
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = videoRefs.current.get(item.url);
                          if (!v) return;
                          if (v.paused) {
                            videoRefs.current.forEach((other, key) => {
                              if (key !== item.url && other) { other.pause(); other.currentTime = 0; }
                            });
                            v.play().catch(() => {});
                            setPlayingVideo(item.url);
                          } else {
                            v.pause();
                            setPlayingVideo(null);
                          }
                        }}
                        className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity ${playingVideo === item.url ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
                      >
                        <div className="rounded-full bg-black/60 p-2">
                          {playingVideo === item.url ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                              <rect x="6" y="4" width="4" height="16" rx="1" />
                              <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                          ) : (
                            <Play className="h-5 w-5 text-white fill-white" />
                          )}
                        </div>
                      </button>
                    </>
                  ) : (
                    <Image
                      src={item.url}
                      alt={`Media ${i + 1}`}
                      fill
                      sizes="33vw"
                      className="object-cover"
                      style={{ transform: `rotate(${rotations[i] || 0}deg)` }}
                    />
                  )}
                  {i === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Обложка</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Remove"
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {/* Add more button */}
              <label className={`aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-surface transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground">Добавить</span>
                  </>
                )}
                <input type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        ) : (
          /* Empty state — full-height drop zone */
          <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-surface transition-all cursor-pointer py-20 px-4 mb-6">
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Загрузка...</span>
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.06]">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <span className="text-sm font-semibold">Добавьте фото и видео</span>
                <span className="text-xs text-muted-foreground mt-1">Нажмите или перетащите файлы</span>
                <span className="text-[10px] text-muted-foreground/60 mt-3">JPG, PNG, WebP, MP4 — фото до 10 МБ, видео до 100 МБ</span>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>
        )}

        {/* ── Form — single view ── */}
        {hasMedia && (
          <div className="space-y-5">
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
                <X className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            {/* Title + Description */}
            <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-4 border-b border-border/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.06]">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Инфо</h3>
                  <p className="text-[11px] text-muted-foreground">Название и описание дизайна</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Название *
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/60 ml-1">({title.length}/100)</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  className={inputClass}
                  placeholder="Нежный френч с цветами"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Описание
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/60 ml-1">({description.length}/500)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  rows={3}
                  maxLength={500}
                  className={inputClass + ' resize-none'}
                  placeholder="Опишите дизайн, технику, материалы..."
                />
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3">
              <div className="flex items-center gap-2.5 pb-4 border-b border-border/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.06]">
                  <Hash className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Теги и категории</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {activeFilterCount + tags.length > 0 ? `Выбрано: ${activeFilterCount + tags.length}` : 'Помогите найти ваш дизайн'}
                  </p>
                </div>
              </div>

              {/* Tag input */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40 transition-all cursor-text" onClick={() => tagInputRef.current?.focus()}>
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">
                    #{t}
                    <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={tags.length ? 'Добавить...' : 'Введите теги через Enter'}
                  className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 py-0.5"
                />
              </div>

              {/* Categories */}
              {CATEGORIES.map((cat) => {
                const selected = selectedFilters[cat.key] || [];
                const labels = HUMAN_LABELS[cat.key];
                const isSmall = cat.values.length <= 4;
                return (
                  <div key={cat.key}>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat.label}</label>
                    {isSmall ? (
                      <div className={`grid gap-1.5 ${cat.values.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                        {cat.values.map((opt) => {
                          const display = labels?.[opt] || opt;
                          const active = selected.includes(opt);
                          return (
                            <button key={opt} type="button" onClick={() => toggleFilter(cat.key, opt)}
                              className={`rounded-xl border-2 p-2.5 text-center text-xs font-medium transition-all ${active ? 'border-primary bg-primary/[0.03] text-primary' : 'border-border/40 hover:border-border hover:bg-surface text-muted-foreground'}`}>
                              {display}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <ExpandableChipList values={cat.values} selected={selected} labels={labels} onToggle={(v) => toggleFilter(cat.key, v)} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Публикация...</>
              ) : (
                'Post'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function ExpandableChipList({ values, selected, labels, onToggle }: {
  values: string[]; selected: string[]; labels?: Record<string, string>; onToggle: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'}`;

  const VISIBLE = 5;
  const hasMore = values.length > VISIBLE;
  const visibleValues = expanded ? values : values.slice(0, VISIBLE);

  return (
    <div>
      <div className={`relative ${!expanded ? 'overflow-hidden' : ''}`}>
        <div className={`${expanded ? 'flex flex-wrap' : 'flex overflow-x-auto hide-scrollbar'} gap-1.5 ${!expanded ? 'pb-1' : ''}`}>
          {visibleValues.map((opt) => {
            const display = labels?.[opt] || opt;
            return (
              <button key={opt} type="button" onClick={() => onToggle(opt)} className={chip(selected.includes(opt))}>{display}</button>
            );
          })}
          {hasMore && (
            <button type="button" onClick={() => setExpanded(!expanded)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground transition-all">
              {expanded ? 'Свернуть' : `+ ещё ${values.length - VISIBLE}`}
            </button>
          )}
        </div>
        {hasMore && !expanded && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-card to-transparent rounded-r-xl" />
        )}
      </div>
    </div>
  );
}
