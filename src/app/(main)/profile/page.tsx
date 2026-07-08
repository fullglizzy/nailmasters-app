'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, Settings, Heart, Calendar, LogOut, Upload, Star, Clock, ShoppingBag, Grid3X3, Edit, MessageSquare } from 'lucide-react';
import { FavoritesTab } from '@/components/profile/favorites-tab';
import { BookingsTab } from '@/components/profile/bookings-tab';
import { UploadsTab } from '@/components/profile/uploads-tab';
import { ReviewsTab } from '@/components/profile/reviews-tab';
import { EditProfileModal } from '@/components/profile/edit-profile-modal';
import { AddServiceModal } from '@/components/profile/add-service-modal';
import { DesignCard } from '@/components/design/design-card';

interface UserProfile {
  id: string; email: string; username: string; role: string; isGuest: boolean;
  avatarUrl: string | null; fullName: string | null; phone: string | null;
  rating?: string; totalOrders?: number; reviewsCount?: number;
}

function ProfileContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [servicesKey, setServicesKey] = useState(0);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [designsKey, setDesignsKey] = useState(0);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';

  // Horizontal scroll on wheel for tab bar and schedule dates (must be after tab declaration)
  useEffect(() => {
    const addWheel = (el: HTMLDivElement | null) => {
      if (!el) return;
      const fn = (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
      el.addEventListener('wheel', fn, { passive: false });
      return () => el.removeEventListener('wheel', fn);
    };
    const cleanups = [addWheel(tabScrollRef.current)];
    return () => cleanups.forEach(fn => fn?.());
  }, [tab, servicesKey, scheduleKey]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth'); return; }
    fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success) setProfile(json.data);
        else { localStorage.removeItem('token'); router.push('/auth'); }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    ['token', 'refreshToken', 'user', 'guest_created', 'guest_likes'].forEach(k => localStorage.removeItem(k));
    window.dispatchEvent(new Event('auth-change'));
    router.push('/');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;
  if (!profile) return <div className="flex min-h-screen flex-col items-center justify-center"><h1 className="font-display text-2xl mb-2">Необходима авторизация</h1><Link href="/auth" className="text-primary hover:underline font-medium">Войти</Link></div>;

  const isMaster = profile.role === 'nailmaster';
  const isClient = profile.role === 'client';

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: User },
    ...(isMaster ? [
      { id: 'designs', label: 'Я так могу', icon: Grid3X3 },
      { id: 'services', label: 'Услуги', icon: Settings },
      { id: 'schedule', label: 'Расписание', icon: Clock },
    ] : []),
    { id: 'orders', label: 'Записи', icon: ShoppingBag },
    { id: 'favorites', label: 'Избранное', icon: Heart },
    { id: 'uploads', label: 'Загрузки', icon: Upload },
    { id: 'reviews', label: 'Отзывы', icon: MessageSquare },
  ];

  const switchTab = (id: string) => router.push(`/profile?tab=${id}`, { scroll: false });

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative shrink-0">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-primary/[0.08]" />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/[0.06] ring-2 ring-primary/[0.08]">
                  <span className="font-display text-3xl text-primary">{(profile.fullName || profile.username).charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl">{profile.fullName || profile.username}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}{!profile.isGuest && ` · ${profile.email}`}</p>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                <span className="capitalize">{isMaster ? 'Мастер' : isClient ? 'Клиент' : 'Администратор'}</span>
                {profile.phone && <span>· {profile.phone}</span>}
                {isMaster && profile.rating && (
                  <span className="inline-flex items-center gap-1 font-medium text-gold"><Star className="h-3.5 w-3.5 fill-current" />{profile.rating}</span>
                )}
              </div>
              {profile.isGuest && (
                <div className="mt-3 rounded-xl bg-gold/10 border border-gold/20 px-3.5 py-3 text-xs leading-relaxed">
                  <span className="font-semibold">Гостевой аккаунт.</span>{' '}
                  <Link href="/auth" className="underline font-semibold text-primary hover:text-primary/80 transition-colors">Зарегистрируйтесь</Link>
                  , чтобы сохранить данные и получить доступ ко всем функциям.
                </div>
              )}
            </div>
            {!profile.isGuest && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-sm font-medium hover:bg-surface transition-colors">
                  <Edit className="h-4 w-4" /> Редактировать
                </button>
                <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                  <LogOut className="h-4 w-4" /> Выйти
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats (master only) */}
        {isMaster && tab === 'overview' && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { value: profile.totalOrders || 0, label: 'Заказов', icon: ShoppingBag },
              { value: profile.reviewsCount || 0, label: 'Отзывов', icon: MessageSquare },
              { value: profile.rating || '—', label: 'Рейтинг', icon: Star },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/40 bg-card p-4 text-center hover:shadow-sm transition-all">
                <div className="font-display text-2xl text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab navigation — pill style */}
        <div className="min-w-0 flex gap-1 overflow-x-auto hide-scrollbar mb-6 rounded-full border border-border/60 bg-muted/30 p-1" ref={tabScrollRef}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex items-center gap-2 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-background shadow-sm border border-border/30 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[300px]">
          {tab === 'orders' && <BookingsTab />}
          {tab === 'favorites' && <FavoritesTab />}
          {isMaster && tab === 'designs' && <MasterDesignsTab key={designsKey} />}
          {isMaster && tab === 'services' && (
            <MasterServicesTab key={servicesKey} onAdd={() => setServiceModalOpen(true)} onDelete={() => setServicesKey(k => k + 1)} />
          )}
          {isMaster && tab === 'schedule' && <MasterScheduleTab key={scheduleKey} onAdd={async (date, start, end) => {
            const token = localStorage.getItem('token');
            await fetch('/api/masters/schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ workDate: date, startTime: start, endTime: end }),
            });
            setScheduleKey(k => k + 1);
          }} onDelete={async (slotId) => {
            const token = localStorage.getItem('token');
            await fetch(`/api/masters/schedule/${slotId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            setScheduleKey(k => k + 1);
          }} />}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tabs.filter(t => t.id !== 'overview').map(t => (
                <button key={t.id} onClick={() => switchTab(t.id)}
                  className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-5 hover:shadow-md hover:border-border transition-all duration-200 text-left group">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.06] shrink-0 group-hover:bg-primary/10 transition-colors">
                    <t.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm">{t.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.id === 'designs' && 'Ваши созданные дизайны'}
                      {t.id === 'services' && 'Управление услугами и ценами'}
                      {t.id === 'schedule' && 'Настройка времени для записи'}
                      {t.id === 'orders' && 'История заказов и бронирований'}
                      {t.id === 'favorites' && 'Сохраненные дизайны'}
                      {t.id === 'uploads' && 'Загруженные изображения'}
                      {t.id === 'reviews' && 'Оставленные отзывы'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {tab === 'uploads' && <UploadsTab />}
          {tab === 'reviews' && <ReviewsTab />}
        </div>
      </div>

      {/* Edit modal */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token!}` } });
          const json = await res.json();
          if (json.success) setProfile(json.data);
        }}
      />
      {/* Add service modal */}
      <AddServiceModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        onCreated={() => { setServicesKey(k => k + 1); setServiceModalOpen(false); }}
      />
    </div>
  );
}

// Simple master sub-tabs
function MasterDesignsTab() {
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    fetch(`/api/designs/master/${user.id}?source=can-do`, { headers: { Authorization: `Bearer ${token!}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setDesigns(j.data || []); })
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!designs.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
        <Grid3X3 className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Нет созданных дизайнов</p>
      <Link href="/create" className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Создать дизайн</Link>
    </div>
  );
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{designs.map((d: any, i: number) => <DesignCard key={d.id} design={d} delay={Math.min(i * 30, 300)} />)}</div>;
}

function MasterServicesTab({ onAdd, onDelete }: { onAdd?: () => void; onDelete?: () => void }) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/masters/services', { headers: { Authorization: `Bearer ${token!}` } })
      .then(r => r.json()).then(j => { if (j.success) setServices(j.data); })
      .finally(() => setLoading(false));
  }, []);
  const handleDelete = async (id: string) => {
    setDeletingId(null);
    const token = localStorage.getItem('token');
    await fetch(`/api/masters/services/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setServices(prev => prev.filter(s => s.id !== id));
    onDelete?.();
  };
  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{services.length} {services.length === 1 ? 'услуга' : services.length < 5 ? 'услуги' : 'услуг'}</p>
        {onAdd && <button onClick={onAdd} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">+ Добавить</button>}
      </div>
      {!services.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/40 bg-card/50">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
            <Settings className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Нет услуг</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Создайте первую услугу, чтобы клиенты могли записаться</p>
          {onAdd && <button onClick={onAdd} className="mt-4 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">+ Добавить услугу</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((s: any) => (
            <div key={s.id} className="flex justify-between items-center rounded-xl border border-border/40 bg-card px-5 py-4 hover:border-border hover:shadow-sm transition-all duration-200">
              <div className="min-w-0 flex-1 mr-4">
                <div className="font-medium text-sm truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.duration} мин</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary/[0.06] px-3 py-1 text-sm font-bold text-primary">{parseInt(s.price).toLocaleString()} ₽</span>
                {deletingId === s.id ? (
                  <span className="inline-flex items-center gap-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <span className="text-muted-foreground">Удалить?</span>
                    <button onClick={() => handleDelete(s.id)} className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors">Да</button>
                    <button onClick={() => setDeletingId(null)} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium hover:bg-surface transition-colors">Нет</button>
                  </span>
                ) : (
                  <button onClick={() => setDeletingId(s.id)} className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors shrink-0">Удалить</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MasterScheduleTab({ onAdd, onDelete }: { onAdd?: (date: string, start: string, end: string) => Promise<void>; onDelete?: (slotId: string) => Promise<void> }) {
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');

  const load = () => {
    const token = localStorage.getItem('token');
    fetch('/api/masters/schedule', { headers: { Authorization: `Bearer ${token!}` } })
      .then(r => r.json()).then(j => { if (j.success) setSlots(j.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!newDate) return;
    await onAdd?.(newDate, newStart, newEnd);
    setNewDate('');
    setShowAdd(false);
    load();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(null);
    await onDelete?.(id);
    load();
  };

  // Generate next 14 dates for quick pick
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const grouped: Record<string, any[]> = {};
  slots.forEach((s: any) => { (grouped[s.workDate] ??= []).push(s); });

  const inputClass = "rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{slots.length} {slots.length === 1 ? 'слот' : slots.length < 5 ? 'слота' : 'слотов'}</p>
        <button onClick={() => { setShowAdd(!showAdd); setNewDate(''); }} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          {showAdd ? 'Отмена' : '+ Добавить слоты'}
        </button>
      </div>

      {/* ── Add slot form ── */}
      {showAdd && (
        <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Step 1: Pick date */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              <Calendar className="h-3.5 w-3.5 inline mr-1.5" />Выберите дату
            </label>
            <div className="overflow-hidden">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1.5 -mr-5 pr-5" ref={scheduleScrollRef}>
              {dateOptions.map(d => {
                const date = new Date(d);
                const isToday = d === new Date().toISOString().split('T')[0];
                const isTomorrow = d === dateOptions[1];
                const label = isToday ? 'Сегодня' : isTomorrow ? 'Завтра' : date.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
                const weekday = date.toLocaleDateString('ru', { weekday: 'short' });
                return (
                  <button
                    key={d}
                    onClick={() => setNewDate(d)}
                    className={`shrink-0 flex flex-col items-center rounded-xl px-4 py-2.5 text-sm font-medium border transition-all ${
                      newDate === d
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-[10px] uppercase opacity-70">{weekday}</span>
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
            </div>
          </div>

          {/* Step 2: Time range */}
          {newDate && (
            <div className="border-t border-border/30 pt-4 space-y-4 animate-in fade-in duration-200">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                <Clock className="h-3.5 w-3.5 inline mr-1.5" />Выберите время
              </label>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Утро', start: '09:00', end: '12:00' },
                  { label: 'День', start: '12:00', end: '17:00' },
                  { label: 'Вечер', start: '17:00', end: '21:00' },
                  { label: 'Весь день', start: '09:00', end: '21:00' },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setNewStart(p.start); setNewEnd(p.end); }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                      newStart === p.start && newEnd === p.end
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label} ({p.start.slice(0, 5)}–{p.end.slice(0, 5)})
                  </button>
                ))}
              </div>

              {/* Custom time inputs */}
              <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">С</label>
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className={inputClass + ' w-full'} />
                </div>
                <span className="mt-5 text-sm text-muted-foreground font-medium">—</span>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">По</label>
                  <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className={inputClass + ' w-full'} />
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={!newStart || !newEnd || newStart >= newEnd}
                className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Добавить слот {newStart}–{newEnd}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Slot list ── */}
      {!slots.length && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/40 bg-card/50">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
            <Clock className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Нет слотов для записи</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Добавьте время, когда клиенты могут к вам записаться</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).slice(0, 14).map(([date, items]) => (
            <div key={date} className="rounded-xl border border-border/40 bg-card p-4">
              <div className="font-semibold text-sm mb-3">{new Date(date).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div className="flex flex-wrap gap-2">
                {items.map((s: any) => {
                  const isDeleting = deletingId === s.id;
                  return isDeleting ? (
                    <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-medium animate-in fade-in zoom-in-95 duration-150">
                      <span className="text-destructive">Удалить {s.startTime?.slice(0,5)}–{s.endTime?.slice(0,5)}?</span>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] font-medium hover:bg-surface transition-colors"
                      >
                        Нет
                      </button>
                    </span>
                  ) : (
                    <span
                      key={s.id}
                      onClick={() => setDeletingId(s.id)}
                      title="Нажмите чтобы удалить"
                      className={`rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all ${
                        s.status === 'available' ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {s.startTime?.slice(0,5)}–{s.endTime?.slice(0,5)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>}><ProfileContent /></Suspense>;
}
