'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Calendar, Clock, Check, X, Timer, Palette, Phone, MapPin, ChevronDown, ChevronUp, MessageSquare, Sparkles, Star } from 'lucide-react';
import { ReviewModal } from '@/components/review/review-modal';
import { useOrders } from '@/hooks/api';
import type { OrderEnriched } from '@/lib/types';

// ── Constants ────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', confirmed: 'Подтверждён', alternative_proposed: 'Предложено время',
  declined: 'Отклонён', completed: 'Завершён', cancelled: 'Отменён',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gold/15 text-gold border-gold/30',
  confirmed: 'bg-secondary/15 text-secondary border-secondary/30',
  alternative_proposed: 'bg-gold/15 text-gold border-gold/30',
  completed: 'bg-primary/10 text-primary border-primary/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
  declined: 'bg-destructive/10 text-destructive border-destructive/30',
};

function actionToStatus(action: string): string | null {
  if (action === 'confirm') return 'confirmed';
  if (action === 'decline') return 'declined';
  if (action === 'complete') return 'completed';
  if (action === 'cancel') return 'cancelled';
  return null;
}

// ── Component ────────────────────────────────────────────

export function BookingsTab() {
  const { data: orders = [], isLoading, refetch } = useOrders();
  const [role, setRole] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewMaster, setReviewMaster] = useState<{ id: string; name: string } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Init role from localStorage
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setRole(user.role || '');
  }, []);

  // Show success after booking→register flow
  useEffect(() => {
    if (sessionStorage.getItem('just_booked')) {
      sessionStorage.removeItem('just_booked');
      setTimeout(() => setBookingSuccess(true), 300);
    }
  }, []);

  // ── Actions ─────────────────────────────────────────

  const handleAction = async (orderId: string, action: string, body?: Record<string, unknown>) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setActingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
    } finally {
      refetch();
      setActingId(null);
    }
  };

  // ── Derived ─────────────────────────────────────────
  const sorted = [...orders].sort((a, b) => new Date(b.requestedDateTime).getTime() - new Date(a.requestedDateTime).getTime());
  const grouped: Record<string, OrderEnriched[]> = {};
  sorted.forEach((o) => {
    const key = new Date(o.requestedDateTime).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
    (grouped[key] ??= []).push(o);
  });

  // ── Render ──────────────────────────────────────────

  if (bookingSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background" onClick={() => setBookingSuccess(false)}>
        <div className="text-center p-8 max-w-sm">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold mb-3">Запись создана!</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">Мастер получит уведомление и подтвердит запись. Вы можете отслеживать статус на этой странице.</p>
          <button onClick={() => setBookingSuccess(false)} className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Понятно</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
          <Calendar className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Нет заказов</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {role === 'nailmaster' ? 'Когда клиенты запишутся к вам, заказы появятся здесь' : 'Запишитесь к мастеру — заказы появятся здесь'}
        </p>
      </div>
    );
  }

  const isMaster = role === 'nailmaster';

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([dateLabel, dayOrders]) => (
        <div key={dateLabel}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1">{dateLabel}</p>
          <div className="space-y-3">
            {dayOrders.map((o) => {
              const isExpanded = expandedId === o.id;
              const status = o.status as string;

              return (
                <div key={o.id} className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all">
                  {/* Header row */}
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                        {o.price && <span className="text-sm font-semibold">{parseInt(String(o.price)).toLocaleString('ru-RU')} ₽</span>}
                        <span className="text-xs text-muted-foreground">{new Date(o.requestedDateTime).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}</span>
                      </div>
                      {/* Counterparty info */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {isMaster && o._client && (
                          <>
                            {o._client.avatar ? (
                              <div className="relative h-6 w-6 rounded-full overflow-hidden shrink-0"><Image src={o._client.avatar} alt="" fill sizes="24px" className="object-cover" /></div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold shrink-0">{(o._client.name || 'К').charAt(0)}</div>
                            )}
                            <span className="text-sm font-medium">{o._client.name}</span>
                          </>
                        )}
                        {!isMaster && o._master && (
                          <>
                            {o._master.avatar ? (
                              <div className="relative h-6 w-6 rounded-full overflow-hidden shrink-0"><Image src={o._master.avatar} alt="" fill sizes="24px" className="object-cover" /></div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold shrink-0">{(o._master.name || 'М').charAt(0)}</div>
                            )}
                            <span className="text-sm font-medium">{o._master.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : o.id)} className="shrink-0 rounded-full p-1 hover:bg-muted/50 transition-colors">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/30 p-4 space-y-3 bg-muted/20">
                      {/* Design */}
                      {o._design && (
                        <div className="flex items-center gap-3 rounded-lg bg-background p-3">
                          <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted relative">
                            <Image src={(o._design.images && o._design.images[0]) || '/placeholder.svg'} alt={o._design.title || ''} fill sizes="56px" className="object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-muted-foreground">Дизайн</div>
                            <div className="text-sm font-medium truncate">{o._design.title}</div>
                          </div>
                          {o.nailDesignId && (
                            <a href={`/explore/${o.nailDesignId}`} className="ml-auto shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/20">Смотреть</a>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {o._master && <Meta icon={Star} label="Мастер" value={o._master.name} />}
                        {o._client && <Meta icon={UserIcon} label="Клиент" value={o._client.name} />}
                        {o._master?.phone && <Meta icon={Phone} label="Телефон" value={o._master.phone} />}
                        {o._client?.phone && <Meta icon={Phone} label="Телефон" value={o._client.phone} />}
                        {o._master?.address && <Meta icon={MapPin} label="Адрес" value={o._master.address} />}
                        {o.requestedDateTime && <Meta icon={Calendar} label="Дата" value={new Date(o.requestedDateTime).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} />}
                        {o.requestedDateTime && <Meta icon={Clock} label="Время" value={new Date(o.requestedDateTime).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} />}
                        {o.price && <Meta icon={Palette} label="Сумма" value={`${parseInt(String(o.price)).toLocaleString('ru-RU')} ₽`} />}
                      </div>
                      {o.clientNotes && <p className="text-xs text-muted-foreground bg-background rounded-lg p-3"><span className="font-medium">Заметки:</span> {o.clientNotes}</p>}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        {status === 'pending' && isMaster && (
                          <>
                            <ActionBtn icon={Check} label="Подтвердить" color="bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={!!actingId} onClick={() => handleAction(o.id, 'confirm')} />
                            <ActionBtn icon={X} label="Отклонить" color="bg-destructive/10 text-destructive hover:bg-destructive/20" disabled={!!actingId} onClick={() => handleAction(o.id, 'decline')} />
                          </>
                        )}
                        {status === 'confirmed' && isMaster && (
                          <ActionBtn icon={Check} label="Завершить" color="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!!actingId} onClick={() => handleAction(o.id, 'complete')} />
                        )}
                        {(status === 'pending' || status === 'confirmed' || status === 'alternative_proposed') && !isMaster && (
                          <ActionBtn icon={X} label="Отменить" color="bg-destructive/10 text-destructive hover:bg-destructive/20" disabled={!!actingId} onClick={() => handleAction(o.id, 'cancel')} />
                        )}
                        {status === 'completed' && !isMaster && o._master && (
                          <button
                            onClick={() => setReviewMaster({ id: o.nailMasterId, name: o._master?.name || '' })}
                            className="flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20 transition-colors"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Оставить отзыв
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {reviewMaster && (
        <ReviewModal
          open={!!reviewMaster}
          onClose={() => setReviewMaster(null)}
          onSubmit={refetch}
          masterId={reviewMaster.id}
          masterName={reviewMaster.name}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────

function ActionBtn({ icon: Icon, label, color, disabled, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${color}`}>
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  );
}

function Meta({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
