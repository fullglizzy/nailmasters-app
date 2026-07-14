'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
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
import { useAuth } from '@/components/providers/auth-provider';
import { pluralRu } from '@/lib/utils';
import type { Design, ScheduleSlot } from '@/lib/types';

function ProfileContent() {
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [showMasterConfirm, setShowMasterConfirm] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, logout, refresh, ensureAuth, isLoading: authLoading } = useAuth();

  // Tab state — internal for instant switching, URL param for initial load / shareability
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'overview');

  const { data: profile, isLoading, refetch } = useProfile();

  const handleLogout = () => logout();

  // Лениво создаём гостя при первом заходе в профиль без сессии.
  // Только один раз, только после того как syncSession подтвердил отсутствие сессии.
  const profileEnsured = useRef(false);
  useEffect(() => {
    if (authLoading || profileEnsured.current) return;
    if (profile !== undefined) return; // уже есть профиль
    // useProfile завершился (enabled=false → data=undefined), сессии нет → создаём гостя
    profileEnsured.current = true;
    ensureAuth().then((r) => { if (r) refetch(); });
  }, [authLoading, profile, ensureAuth, refetch]);

  if (isLoading || authLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;
  if (!profile) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;

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
                <div className="relative h-[72px] w-[72px] rounded-full overflow-hidden ring-2 ring-primary/[0.08]">
                  <Image src={profile.avatarUrl} alt="" fill sizes="72px" className="object-cover" />
                </div>
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/[0.06] ring-2 ring-primary/[0.08]">
                  <span className="font-display text-3xl text-primary">{(profile.fullName || profile.username || '').charAt(0).toUpperCase()}</span>
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
            const token = getToken();
            await fetch('/api/masters/schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ workDate: date, startTime: start, endTime: end }),
            });
            setScheduleKey(k => k + 1);
          }} onDelete={async (slotId) => {
            const token = getToken();
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

        {/* Намеренно незаметные ссылки — для тех, кто ищет.
            При соотношении 10 000:1 клиент их не заметит, мастер/владелец аккаунта — найдёт. */}
        {(isGuestUser || (isClient && !isMaster)) && (
          <div className="mt-10 pt-6 border-t border-border/30 text-center space-y-2">
            {isGuestUser && (
              <div>
                <Link href="/auth?mode=login" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  Войти в существующий аккаунт
                </Link>
              </div>
            )}
            {isClient && !isMaster && (
              <div>
                <button
                  onClick={() => {
                    if (profile.isGuest) { router.push('/auth?as=master'); return; }
                    setShowMasterConfirm(true);
                  }}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  Стать мастером на платформе
                </button>
              </div>
            )}
          </div>
        )}
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
                const token = getToken();
                try {
                  const res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ role: 'nailmaster' }),
                  });
                  if (res.ok) {
                    await refresh();
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
        <Sparkles className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Пока нет подходящих дизайнов</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
        В ленте нажимайте <Sparkles className="h-3 w-3 inline text-primary" /> <span className="font-medium text-foreground/70">Я так могу</span> на понравившихся дизайнах — они появятся здесь, и клиенты смогут записаться
      </p>
      <Link href="/explore" className="mt-4 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
        Перейти в ленту
      </Link>
    </div>
  );
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{designList.map((d: Design, i: number) => <DesignCard key={d.id} design={d} delay={Math.min(i * 30, 300)} isLiked={likedIds.has(d.id)} />)}</div>;
}

// Master schedule management tab
function MasterScheduleTab({ onAdd, onDelete }: { onAdd?: (date: string, start: string, end: string) => Promise<void>; onDelete?: (slotId: string) => Promise<void> }) {
  const { getToken } = useAuth();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Batch add state
  const [showAdd, setShowAdd] = useState(false);
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchStart, setBatchStart] = useState('09:00');
  const [batchEnd, setBatchEnd] = useState('17:00');
  const [batchInterval, setBatchInterval] = useState(60);
  const [batchDays, setBatchDays] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch('/api/masters/schedule', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(j => { if (j.success) setSlots(j.data); })
      .finally(() => setLoading(false));
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBatchAdd = async () => {
    const token = getToken();
    if (!token) return;
    setBatchLoading(true);
    setBatchError('');
    try {
      const res = await fetch('/api/masters/schedule/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          workDate: batchDate,
          startTime: batchStart,
          endTime: batchEnd,
          intervalMinutes: batchInterval,
          repeatDays: batchDays.length ? batchDays : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowAdd(false);
        setRefreshKey(k => k + 1);
      } else {
        setBatchError(json.error || `Ошибка: ${res.status}`);
      }
    } catch {
      setBatchError('Ошибка соединения');
    } finally { setBatchLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const token = getToken();
      await fetch(`/api/masters/schedule/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token!}` },
      });
      setRefreshKey(k => k + 1);
    } catch {} finally { setDeletingId(null); }
  };

  const toggleDay = (day: string) => {
    setBatchDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  // Group + sort
  const grouped: Record<string, ScheduleSlot[]> = {};
  slots.forEach((s) => { (grouped[s.workDate] ??= []).push(s); });
  const sortedDates = Object.keys(grouped).sort();
  const statusColor = (status: string) => status === 'booked' ? 'bg-destructive/10 border-destructive/20 text-destructive' : status === 'blocked' ? 'bg-muted border-border/40 text-muted-foreground' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600';
  const statusDot = (status: string) => status === 'booked' ? '🔴' : status === 'blocked' ? '⚫' : '🟢';

  const inputClass = "rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all w-full";
  const chipClass = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-surface'}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{slots.length} {pluralRu(slots.length, 'слот', 'слота', 'слотов')}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            {showAdd ? 'Отмена' : '+ Добавить'}
          </button>
        </div>
      </div>

      {/* Batch add form */}
      {showAdd && (
        <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {batchError && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{batchError}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Дата</label>
              <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} className={inputClass} />
            </div>
            <div></div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Начало</label>
              <input type="time" value={batchStart} onChange={e => setBatchStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Конец</label>
              <input type="time" value={batchEnd} onChange={e => setBatchEnd(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Duration quick-select */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Длительность слота</label>
            <div className="flex gap-2">
              {[30, 60, 90, 120].map(m => (
                <button key={m} onClick={() => setBatchInterval(m)}
                  className={chipClass(batchInterval === m)}>{m} мин</button>
              ))}
            </div>
          </div>

          {/* Repeat days */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Повторить по дням</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'mon', label: 'Пн' }, { key: 'tue', label: 'Вт' }, { key: 'wed', label: 'Ср' },
                { key: 'thu', label: 'Чт' }, { key: 'fri', label: 'Пт' }, { key: 'sat', label: 'Сб' }, { key: 'sun', label: 'Вс' },
              ].map(d => (
                <button key={d.key} onClick={() => toggleDay(d.key)}
                  className={chipClass(batchDays.includes(d.key))}>{d.label}</button>
              ))}
            </div>
          </div>

          <button onClick={handleBatchAdd} disabled={batchLoading}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
            {batchLoading ? 'Создание...' : 'Создать слоты'}
          </button>
        </div>
      )}

      {/* Slots grouped by date */}
      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Calendar className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Нет слотов</p>
          <p className="text-xs opacity-60 mt-1">Добавьте слоты чтобы клиенты могли записаться</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map(date => {
            const daySlots = grouped[date];
            const dateObj = new Date(date);
            const isToday = date === new Date().toISOString().split('T')[0];
            const label = isToday ? 'Сегодня' : dateObj.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short' });
            const isExpanded = expandedDate === date;

            return (
              <div key={date} className="rounded-xl border border-border/30 bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedDate(isExpanded ? null : date)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors text-left"
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{daySlots.length} {pluralRu(daySlots.length, 'слот', 'слота', 'слотов')}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-border/20 divide-y divide-border/10">
                    {daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => (
                      <div key={s.id}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm ${statusColor(s.status)}`}>
                        <span className="flex items-center gap-2">
                          <span className="text-[10px]">{statusDot(s.status)}</span>
                          {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                          {s.notes && <span className="text-[11px] opacity-60 ml-2">{s.notes}</span>}
                        </span>
                        {s.status !== 'booked' && (
                          <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                            {deletingId === s.id ? '...' : 'Удалить'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>}><ProfileContent /></Suspense>;
}
