'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, Heart, Calendar, LogOut, Upload, Star, Clock, ShoppingBag, Grid3X3, Edit, MessageSquare, Eye, Sparkles } from 'lucide-react';
import { FavoritesTab } from '@/components/profile/favorites-tab';
import { BookingsTab } from '@/components/profile/bookings-tab';
import { UploadsTab } from '@/components/profile/uploads-tab';
import { ReviewsTab } from '@/components/profile/reviews-tab';
import { EditProfileModal } from '@/components/profile/edit-profile-modal';
import { DesignCard } from '@/components/design/design-card';
import { ScrollableRow } from '@/components/shared/scrollable-row';
import { useProfile, useMasterDesigns } from '@/hooks/api';
import { useLikedIds } from '@/hooks/use-liked-ids';
import { clearAuth } from '@/components/providers/guest-provider';
import type { Design, ScheduleSlot } from '@/lib/types';

function ProfileContent() {
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [showMasterConfirm, setShowMasterConfirm] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state — internal for instant switching, URL param for initial load / shareability
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'overview');

  const { data: profile, isLoading, refetch } = useProfile();

  const handleLogout = () => {
    clearAuth();
    window.dispatchEvent(new Event('auth-change'));
    router.push('/');
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;
  if (!profile) return <div className="flex min-h-screen flex-col items-center justify-center"><h1 className="font-display text-2xl mb-2">Необходима авторизация</h1><Link href="/auth" className="text-primary hover:underline font-medium">Войти</Link></div>;

  const isMaster = profile.role === 'nailmaster';
  const isClient = profile.role === 'client';

  // Проверка заполненности профиля мастера
  const masterMissing: string[] = [];
  if (isMaster) {
    if (!profile.city) masterMissing.push('город');
    if (!profile.address) masterMissing.push('адрес');
    if (!profile.description) masterMissing.push('описание');
    if (!profile.experience) masterMissing.push('опыт');
    if (!profile.specialties?.length) masterMissing.push('специализации');
    if (!profile.startingPrice) masterMissing.push('стартовая цена');
    if (!profile.workFormat?.length) masterMissing.push('формат работы');
  }

  const isGuestUser = profile.isGuest;

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: User },
    ...(isMaster ? [
      { id: 'designs', label: 'Я так могу', icon: Grid3X3 },
      { id: 'schedule', label: 'Расписание', icon: Clock },
    ] : []),
    // Guests: only overview, favorites, uploads — no orders/reviews
    ...(!isGuestUser ? [
      { id: 'orders', label: 'Записи', icon: ShoppingBag },
    ] : []),
    { id: 'favorites', label: 'Избранное', icon: Heart },
    { id: 'uploads', label: 'Загрузки', icon: Upload },
    ...(!isGuestUser ? [
      { id: 'reviews', label: 'Отзывы', icon: MessageSquare },
    ] : []),
  ];

  const switchTab = (id: string) => {
    setTab(id);
    // Sync URL for shareability without triggering navigation
    window.history.replaceState(null, '', `/profile?tab=${id}`);
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative shrink-0">
              {profile.avatarUrl ? (
                <Image src={profile.avatarUrl} alt="" width={72} height={72} className="rounded-full object-cover ring-2 ring-primary/[0.08]" />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/[0.06] ring-2 ring-primary/[0.08]">
                  <span className="font-display text-3xl text-primary">{(profile.fullName || profile.username).charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl">{profile.fullName || profile.username}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                <span className="capitalize">{isMaster ? 'Мастер' : isClient ? 'Клиент' : 'Администратор'}</span>
                {profile.phone && <span>· {profile.phone}</span>}
                {isMaster && profile.rating && (
                  <span className="inline-flex items-center gap-1 font-medium text-gold"><Star className="h-3.5 w-3.5 fill-current" />{profile.rating}</span>
                )}
              </div>

            </div>
            <div className="flex items-center gap-2">
              {/* Я мастер — показываем и гостям, и клиентам */}
              {isClient && !isMaster && (
                <button onClick={() => {
                  if (profile.isGuest) { router.push('/auth?as=master'); return; }
                  setShowMasterConfirm(true);
                }} className="flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 transition-colors" title="Стать мастером">
                  <Sparkles className="h-4 w-4" /> Я мастер
                </button>
              )}
              {isMaster && (
                <Link href={`/masters/${profile.id}`} target="_blank" className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-sm font-medium hover:bg-surface transition-colors" title="Публичный профиль">
                  <Eye className="h-4 w-4" />
                </Link>
              )}
              {!profile.isGuest && (
                <>
                  <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-sm font-medium hover:bg-surface transition-colors">
                    <Edit className="h-4 w-4" /> Редактировать
                  </button>
                  <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-sm font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                    <LogOut className="h-4 w-4" /> Выйти
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Предупреждение о незаполненном профиле */}
        {isMaster && masterMissing.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/5 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">⚠️</span>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Заполните профиль для привлечения клиентов</h3>
                <p className="text-xs text-muted-foreground">
                  Не указаны:{' '}
                  {masterMissing.map((f, i) => (
                    <span key={f}>
                      <span className="font-medium text-foreground underline decoration-gold/50">{f}</span>
                      {i < masterMissing.length - 1 && ', '}
                    </span>
                  ))}
                </p>
                <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90 transition-colors">
                  <Edit className="h-3.5 w-3.5" /> Заполнить
                </button>
              </div>
            </div>
          </div>
        )}

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
        <ScrollableRow className="flex gap-1 mb-6 rounded-full border border-border/60 bg-muted/30 p-1">
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
        </ScrollableRow>

        {/* Tab content */}
        <div className="min-h-[300px]">
          {tab === 'orders' && <BookingsTab />}
          {tab === 'favorites' && <FavoritesTab />}
          {isMaster && tab === 'designs' && <MasterDesignsTab userId={profile.id} />}
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

      {/* Master confirmation modal */}
      {showMasterConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowMasterConfirm(false)}>
          <div className="bg-background rounded-2xl p-6 w-[90vw] max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <Sparkles className="h-10 w-10 mx-auto mb-4 text-gold" />
            <h2 className="text-xl font-bold mb-2">Стать мастером?</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Это действие нельзя отменить. Ваш аккаунт будет навсегда преобразован в аккаунт мастера. Клиентский профиль будет удалён.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowMasterConfirm(false)} className="flex-1 rounded-full border border-border/60 py-2.5 text-sm font-medium hover:bg-surface transition-colors">
                Отмена
              </button>
              <button onClick={async () => {
                setShowMasterConfirm(false);
                const token = localStorage.getItem('token');
                try {
                  const res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ role: 'nailmaster' }),
                  });
                  if (res.ok) {
                    const u = JSON.parse(localStorage.getItem('user') || '{}');
                    u.role = 'nailmaster';
                    localStorage.setItem('user', JSON.stringify(u));
                    window.dispatchEvent(new Event('auth-change'));
                    window.location.reload();
                  }
                } catch {}
              }} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">
                Стать мастером
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => refetch()}
      />
    </div>
  );
}

// Master "Я так могу" tab
function MasterDesignsTab({ userId }: { userId: string }) {
  const { data: designs = [], isLoading } = useMasterDesigns(userId, 'can-do');
  const designList = (designs || []) as Design[];
  const likedIds = useLikedIds();

  if (isLoading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!designList.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
        <Grid3X3 className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Нет созданных дизайнов</p>
      <Link href="/create" className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Создать дизайн</Link>
    </div>
  );
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{designList.map((d: Design, i: number) => <DesignCard key={d.id} design={d} delay={Math.min(i * 30, 300)} isLiked={likedIds.has(d.id)} />)}</div>;
}

// Master schedule management tab
function MasterScheduleTab({ onAdd, onDelete }: { onAdd?: (date: string, start: string, end: string) => Promise<void>; onDelete?: (slotId: string) => Promise<void> }) {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
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

  const grouped: Record<string, ScheduleSlot[]> = {};
  slots.forEach((s) => { (grouped[s.workDate] ??= []).push(s); });

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
              <ScrollableRow className="flex gap-2 pb-1.5" fadeRightOffset="1.25rem" noFade>
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
              </ScrollableRow>
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
                {items.map((s) => {
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
