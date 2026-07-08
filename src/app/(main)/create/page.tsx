'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Image, Video, Loader2, Sparkles, Check, Plus, Hash, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { isGuest } from '@/components/auth/auth-guard-modal';

/* ── Constants ── */
const SHAPE_LABELS: Record<string, string> = {
  square: 'Квадрат', soft_square: 'Мягкий кв.', almond: 'Миндаль', oval: 'Овал', stiletto: 'Стилет', ballerina: 'Балерина',
};
const LENGTH_LABELS: Record<string, string> = { short: 'Короткие', medium: 'Средние', long: 'Длинные' };
const SEASON_LABELS: Record<string, string> = { spring: 'Весна', summer: 'Лето', fall: 'Осень', winter: 'Зима' };
const HUMAN_LABELS: Record<string, Record<string, string>> = { shapes: SHAPE_LABELS, lengths: LENGTH_LABELS, seasons: SEASON_LABELS };

const CATEGORIES: { key: string; label: string; values: string[] }[] = [
  { key: 'techniques', label: 'Техника', values: ['Френч', 'Омбре', 'Градиент', 'Стемпинг', 'Лепка', 'Роспись', 'Слайдер', 'Фольга', 'Стразы', 'Блестки', 'Втирка', 'Кошачий глаз', 'Мрамор', 'Акварель', 'Nude'] },
  { key: 'shapes', label: 'Форма', values: Object.keys(SHAPE_LABELS) },
  { key: 'lengths', label: 'Длина', values: Object.keys(LENGTH_LABELS) },
  { key: 'seasons', label: 'Сезон', values: Object.keys(SEASON_LABELS) },
  { key: 'moods', label: 'Настроение', values: ['Повседневный', 'Праздничный', 'Свадебный', 'Романтичный', 'Дерзкий', 'Минимализм', 'Гламур', 'Офисный', 'Вечерний', 'Креативный'] },
  { key: 'materials', label: 'Материалы', values: ['Гель', 'Акрил', 'Гель-лак', 'Шеллак', 'Полигель', 'Типсы', 'Накладные'] },
];

const STEPS = [
  { id: 1, title: 'Медиа', desc: 'Фото и видео', icon: Image },
  { id: 2, title: 'Инфо', desc: 'Название и описание', icon: Sparkles },
  { id: 3, title: 'Детали', desc: 'Теги и категории', icon: Hash },
  { id: 4, title: 'Готово', desc: 'Проверка и публикация', icon: Eye },
];

/* ── Main ── */
export default function CreateDesignPage() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { setError('Видео не должно превышать 100 МБ'); return; }
    setUploadingVideo(true); setError('');
    const token = localStorage.getItem('token');
    const fd = new FormData(); fd.append('video', file);
    try {
      const res = await fetch('/api/designs/upload-video', {
        method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd,
      });
      const json = await res.json();
      if (json.success) setVideoUrl(json.data.url);
      else setError(json.error || 'Ошибка загрузки видео');
    } catch { setError('Ошибка соединения'); }
    finally { setUploadingVideo(false); }
  };
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /* ── Image upload ── */
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true); setError('');
    const token = localStorage.getItem('token');
    const fd = new FormData(); Array.from(files).forEach(f => fd.append('images', f));
    try {
      const res = await fetch('/api/designs/upload-images', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const json = await res.json();
      if (json.success) setImages(prev => [...prev, ...json.data.files.map((f: { url: string }) => f.url)]);
      else setError(json.error || 'Ошибка загрузки');
    } catch { setError('Ошибка соединения'); }
    finally { setUploading(false); }
  }, []);

  /* ── Tag input ── */
  const addTag = (t: string) => {
    const trimmed = t.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) setTags(prev => [...prev, trimmed]);
    setTagInput('');
  };
  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags(prev => prev.slice(0, -1));
  };

  /* ── Filters ── */
  const toggleFilter = (cat: string, val: string) => {
    setSelectedFilters(prev => {
      const cur = prev[cat] || [];
      return { ...prev, [cat]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
    });
  };
  const activeFilterCount = Object.values(selectedFilters).reduce((s, a) => s + a.length, 0);

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!title || (!images.length && !videoUrl)) { setError('Название и изображение/видео обязательны'); setStep(1); return; }
    setSubmitting(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(token ? '/api/designs' : '/api/designs/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          title, description: description || undefined, images,
          videoUrl: videoUrl || undefined, tags: tags.length ? tags : undefined,
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
        if (json.data.token) localStorage.setItem('token', json.data.token);
        router.push(`/explore/${json.data.id}`);
      } else setError(json.error || 'Ошибка создания');
    } catch { setError('Ошибка соединения'); }
    finally { setSubmitting(false); }
  };

  const canGoNext = () => {
    if (step === 1) return images.length > 0 || videoUrl.length > 0;
    if (step === 2) return title.trim().length > 0;
    return true; // steps 3 and 4 are optional
  };

  const inputClass = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";
  const chipCls = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'}`;

  if (isGuest()) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="mx-auto max-w-lg text-center pt-20">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gold/10">
            <Sparkles className="h-10 w-10 text-gold" />
          </div>
          <h1 className="font-display text-3xl mb-3">Требуется регистрация</h1>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Создание дизайнов доступно только зарегистрированным пользователям. Зарегистрируйтесь, чтобы публиковать свои работы.
          </p>
          <Link href="/auth" className="inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    );
  }

  return (<>
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <Link href="/designs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> К каталогу
        </Link>

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Новый дизайн</p>
          <h1 className="font-display text-3xl">Создать дизайн</h1>
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-8">
          {/* Desktop: numbered steps with labels */}
          <div className="hidden sm:flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => { if (s.id < step || (s.id > step && canGoNext())) setStep(s.id); }}
                  disabled={s.id > step && !canGoNext()}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                    s.id < step ? 'bg-secondary text-secondary-foreground' :
                    s.id === step ? 'bg-primary text-primary-foreground shadow-sm' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.id < step ? <Check className="h-4 w-4" /> : s.id}
                </button>
                <div>
                  <div className={`text-xs font-semibold ${s.id === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</div>
                  <div className="text-[10px] text-muted-foreground/60">{s.desc}</div>
                </div>
                {i < STEPS.length - 1 && <div className={`w-8 h-px mx-1 ${s.id < step ? 'bg-secondary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {/* Mobile: bar + step label */}
          <div className="sm:hidden space-y-2">
            <div className="flex gap-1.5">
              {STEPS.map(s => (
                <div key={s.id} className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  s.id < step ? 'bg-secondary' : s.id === step ? 'bg-primary' : 'bg-muted'
                }`} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">{STEPS[step - 1].title}</span>
              <span className="text-[11px] text-muted-foreground">{step} / {STEPS.length}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
            <X className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* ── Step 1: Media ── */}
        {step === 1 && (
          <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <StepTitle icon={Image} title="Фото и видео" subtitle="Загрузите изображения дизайна" />

            {/* Image grid */}
            <div className={`grid gap-3 ${images.length > 0 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1'}`}>
              {images.length === 0 && !videoUrl ? (
                /* Big dropzone when empty */
                <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-surface transition-all cursor-pointer py-16 px-4">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Загрузка...</span>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.06]">
                        <Image className="h-7 w-7 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">Добавьте фото дизайна</span>
                      <span className="text-xs text-muted-foreground mt-1">Нажмите или перетащите файлы</span>
                      <span className="text-[10px] text-muted-foreground/60 mt-3">JPG, PNG, WebP — до 10 МБ</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
              ) : (
                /* Thumbnail grid + add button */
                <>
                  {images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted ring-1 ring-border/20 group">
                      <img src={url} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} aria-label="Удалить"
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all">
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Обложка</span>
                      )}
                    </div>
                  ))}
                  <label className={`aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-surface transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <><Plus className="h-5 w-5 text-muted-foreground mb-1" /><span className="text-[10px] text-muted-foreground">Добавить</span></>}
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                </>
              )}
            </div>

            {/* Video upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Видео</label>
              {videoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border/40 bg-muted/20">
                  <video src={videoUrl} controls className="w-full max-h-48 object-contain" />
                  <button onClick={() => setVideoUrl('')}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
                </div>
              ) : uploadingVideo ? (
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border/40 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer py-8 gap-2">
                  <Video className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Нажмите чтобы загрузить видео</span>
                  <span className="text-xs text-muted-foreground/60">MP4, WebM, MOV до 100 МБ</span>
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Info ── */}
        {step === 2 && (
          <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <StepTitle icon={Sparkles} title="Информация" subtitle="Расскажите о вашем дизайне" />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Название *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} placeholder="Нежный френч с цветами" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Описание <span className="font-normal text-muted-foreground/60">({description.length}/500)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500}
                className={inputClass + ' resize-none'} placeholder="Опишите дизайн, технику выполнения, использованные материалы..." />
            </div>
          </div>
        )}

        {/* ── Step 3: Details ── */}
        {step === 3 && (
          <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <StepTitle icon={Hash} title="Теги и категории" subtitle={activeFilterCount > 0 ? `Выбрано: ${activeFilterCount + tags.length}` : 'Помогите найти ваш дизайн'} />

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Теги</label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40 transition-all cursor-text" onClick={() => tagInputRef.current?.focus()}>
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">
                    #{t}
                    <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input ref={tagInputRef} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKey}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={tags.length ? 'Добавить...' : 'Введите теги через Enter'}
                  className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 py-0.5" />
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              {CATEGORIES.map(cat => {
                const selected = selectedFilters[cat.key] || [];
                const labels = HUMAN_LABELS[cat.key];
                const isSmall = cat.values.length <= 4;
                return (
                  <div key={cat.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</label>
                      <span className="text-[10px] text-muted-foreground/60">{cat.values.length}</span>
                    </div>
                    {isSmall ? (
                      <div className={`grid gap-1.5 ${cat.values.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                        {cat.values.map(opt => {
                          const display = labels?.[opt] || opt;
                          const active = selected.includes(opt);
                          return (
                            <button key={opt} type="button" onClick={() => toggleFilter(cat.key, opt)}
                              className={`rounded-xl border-2 p-2.5 text-center text-sm font-medium transition-all ${
                                active ? 'border-primary bg-primary/[0.03] text-primary' : 'border-border/40 hover:border-border hover:bg-surface text-muted-foreground'
                              }`}>{display}</button>
                          );
                        })}
                      </div>
                    ) : (
                      <ExpandableChipList values={cat.values} selected={selected} labels={labels} onToggle={v => toggleFilter(cat.key, v)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <StepTitle icon={Eye} title="Проверка" subtitle="Всё готово к публикации" />

            {/* Preview */}
            <div className="rounded-xl overflow-hidden bg-muted/30 p-4 space-y-4">
              {/* Images preview */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0, 3).map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted relative">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {i === 2 && images.length > 3 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">+{images.length - 3}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Video preview */}
              {videoUrl && (
                <div className="rounded-lg overflow-hidden bg-muted">
                  <video src={videoUrl} controls className="w-full max-h-40 object-contain" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Название</span>
                  <span className="font-semibold">{title || '—'}</span>
                </div>
                {description && (
                  <div className="flex items-start justify-between text-sm">
                    <span className="text-muted-foreground shrink-0 mr-4">Описание</span>
                    <span className="text-right text-muted-foreground line-clamp-2">{description}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Тип</span>
                </div>
                {tags.length > 0 && (
                  <div className="flex items-start justify-between text-sm">
                    <span className="text-muted-foreground shrink-0 mr-4">Теги</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {tags.map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-[11px]">#{t}</span>)}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Категории</span>
                  <span className="font-medium">{activeFilterCount > 0 ? `Выбрано ${activeFilterCount}` : 'Не указаны'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 rounded-full border border-border/60 px-5 py-2.5 text-sm font-medium hover:bg-surface transition-colors">
              <ChevronLeft className="h-4 w-4" />Назад
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canGoNext()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all ml-auto">
              Далее<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting || !title || (!images.length && !videoUrl)}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all ml-auto">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Публикуем...' : 'Опубликовать дизайн'}
            </button>
          )}
        </div>
      </div>
    </div>
  </>);
}

/* ── Sub-components ── */

function StepTitle({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-4 border-b border-border/30">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.06]">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function ExpandableChipList({ values, selected, labels, onToggle }: {
  values: string[]; selected: string[]; labels?: Record<string, string>; onToggle: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
    }`;

  const VISIBLE = 5;
  const hasMore = values.length > VISIBLE;
  const visibleValues = expanded ? values : values.slice(0, VISIBLE);

  return (
    <div>
      <div className={`relative ${!expanded ? 'overflow-hidden' : ''}`}>
        <div className={`${expanded ? 'flex flex-wrap' : 'flex overflow-x-auto hide-scrollbar'} gap-1.5 ${!expanded ? 'pb-1' : ''}`}>
          {visibleValues.map(opt => {
            const display = labels?.[opt] || opt;
            return (
              <button key={opt} type="button" onClick={() => onToggle(opt)} className={chip(selected.includes(opt))}>
                {display}
              </button>
            );
          })}
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground transition-all">
            {expanded ? 'Свернуть' : `+ ещё ${values.length - VISIBLE}`}
          </button>
        </div>
        {/* Fade — now properly positioned */}
        {hasMore && !expanded && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-card to-transparent rounded-r-xl" />
        )}
      </div>
    </div>
  );
}