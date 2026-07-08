'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, Clock, Check, X, Timer, User, Palette, Phone, MapPin, ChevronDown, ChevronUp, MessageSquare, Sparkles, Star } from 'lucide-react';
import { ReviewModal } from '@/components/review/review-modal';

interface Order {
  id: string; status: string; price: string; requestedDateTime: string;
  proposedDateTime?: string | null; confirmedDateTime?: string | null;
  masterServiceId: string; serviceIds?: string[] | null; nailMasterId: string; nailDesignId: string | null;
  clientId?: string; description?: string | null; masterNotes?: string | null;
  clientNotes?: string | null; completedAt?: string | null; rating?: number | null;
  _design?: { title: string; images: string[] } | null;
  _client?: { name: string; phone: string; avatar?: string | null } | null;
  _master?: { name: string; phone: string; address?: string; avatar?: string | null } | null;
}

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

export function BookingsTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewMaster, setReviewMaster] = useState<{ id: string; name: string } | null>(null);

  const loadOrders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setRole(user.role || '');
    fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(json => { if (json.success) setOrders(json.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadOrders, [loadOrders]);

  const handleAction = async (orderId: string, action: string, body?: Record<string, unknown>) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/orders/${orderId}/${action}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token!}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) loadOrders();
  };

  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!orders.length) return (
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

  const isMaster = role === 'nailmaster';

  // Group orders by date
  const grouped: Record<string, Order[]> = {};
  const sorted = [...orders].sort((a, b) => new Date(b.requestedDateTime).getTime() - new Date(a.requestedDateTime).getTime());
  sorted.forEach(o => {
    const dateKey = new Date(o.requestedDateTime).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    (grouped[dateKey] ??= []).push(o);
  });

  const todayStr = new Date().toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  return (
    <>
    <div className="space-y-6">
      {Object.entries(grouped).map(([dateLabel, dayOrders]) => (
        <div key={dateLabel}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className={`text-sm font-semibold ${dateLabel === todayStr ? 'text-primary' : ''}`}>
              {dateLabel}
            </h3>
            {dateLabel === todayStr && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Сегодня</span>}
            <span className="text-xs text-muted-foreground">{dayOrders.length} {dayOrders.length === 1 ? 'заказ' : dayOrders.length < 5 ? 'заказа' : 'заказов'}</span>
          </div>
          <div className="space-y-2">
            {dayOrders.map(o => {
        const isExpanded = expandedId === o.id;
        const requestedDate = new Date(o.requestedDateTime);
        const isPast = requestedDate < new Date();

        return (
          <div key={o.id} className="rounded-xl border border-border/40 bg-card overflow-hidden transition-all">
            {/* Header — always visible */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : o.id)}
              className="w-full p-4 text-left hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${STATUS_COLORS[o.status] || 'bg-muted border-border/30'}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {requestedDate.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'long' })}
                      </span>
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{requestedDate.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-primary text-sm">{parseInt(o.price || '0').toLocaleString()} ₽</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4 animate-in slide-in-from-top-1 duration-200">
                {/* Services */}
                {o.description && o.description !== 'null' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{o.description}</span>
                  </div>
                )}
                {/* Client/Master info */}
                {isMaster && o._client && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                    {o._client.avatar ? (
                      <img src={o._client.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold shrink-0">
                        {(o._client.name || 'К').charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{o._client.name}</div>
                      {o._client.phone && (
                        <a href={`tel:${o._client.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                          <Phone className="h-3 w-3" />{o._client.phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {!isMaster && o._master && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                    {o._master.avatar ? (
                      <img src={o._master.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold shrink-0">
                        {(o._master.name || 'М').charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <a href={`/masters/${o.nailMasterId}`} className="text-sm font-medium hover:text-primary hover:underline">{o._master.name}</a>
                      {o._master.address && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{o._master.address}</div>}
                      {o._master.phone && (
                        <a href={`tel:${o._master.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                          <Phone className="h-3 w-3" />{o._master.phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {/* Design thumbnail */}
                {o._design && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                    <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <img src={o._design.images[0] || '/placeholder.svg'} alt={o._design.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Дизайн</div>
                      <div className="text-sm font-medium truncate">{o._design.title}</div>
                    </div>
                    {o.nailDesignId && (
                      <a href={`/designs/${o.nailDesignId}`} className="ml-auto shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/20">Смотреть</a>
                    )}
                  </div>
                )}
                {/* Time details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoBlock label="Запрошено" value={requestedDate.toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
                  {o.proposedDateTime && (
                    <InfoBlock label="Предложено" value={new Date(o.proposedDateTime).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
                  )}
                  {o.confirmedDateTime && (
                    <InfoBlock label="Подтверждено" value={new Date(o.confirmedDateTime).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
                  )}
                  {o.completedAt && (
                    <InfoBlock label="Завершён" value={new Date(o.completedAt).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
                  )}
                </div>

                {/* Notes */}
                {o.clientNotes && (
                  <div className="rounded-lg bg-muted/30 p-3 text-sm">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1"><MessageSquare className="h-3 w-3" />Заметки клиента</span>
                    <p>{o.clientNotes}</p>
                  </div>
                )}
                {o.masterNotes && (
                  <div className="rounded-lg bg-muted/30 p-3 text-sm">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1"><MessageSquare className="h-3 w-3" />Заметки мастера</span>
                    <p>{o.masterNotes}</p>
                  </div>
                )}

                {/* Status description */}
                <div className="rounded-lg bg-muted/30 p-3 text-sm">
                  <span className="font-medium">{STATUS_LABELS[o.status]}</span>
                  <span className="text-muted-foreground"> — {statusDescription(o.status)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {isMaster && o.status === 'pending' && (
                    <>
                      <button onClick={() => handleAction(o.id, 'confirm')} className="flex items-center gap-1.5 rounded-full bg-secondary/10 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/20 transition-colors">
                        <Check className="h-4 w-4" />Подтвердить
                      </button>
                      <button onClick={() => handleAction(o.id, 'decline')} className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors">
                        <X className="h-4 w-4" />Отклонить
                      </button>
                    </>
                  )}
                  {isMaster && o.status === 'confirmed' && !isPast && (
                    <button onClick={() => handleAction(o.id, 'complete')} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                      <Timer className="h-4 w-4" />Завершить
                    </button>
                  )}
                  {!isMaster && ['pending', 'confirmed'].includes(o.status) && (
                    <button onClick={() => handleAction(o.id, 'cancel')} className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors">
                      <X className="h-4 w-4" />Отменить
                    </button>
                  )}
                  {o.status === 'completed' && o.nailDesignId && (
                    <a href={`/designs/${o.nailDesignId}`} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                      <Palette className="h-4 w-4" />Смотреть дизайн
                    </a>
                  )}
                  {!isMaster && o.status === 'completed' && !o.rating && (
                    <button onClick={() => setReviewMaster({ id: o.nailMasterId, name: '' })} className="flex items-center gap-1.5 rounded-full bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
                      <Star className="h-4 w-4" />Оставить отзыв
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
    </div>
    {reviewMaster && (
      <ReviewModal
        open={!!reviewMaster}
        onClose={() => setReviewMaster(null)}
        masterId={reviewMaster.id}
        masterName="мастеру"
        onSubmitted={() => { setReviewMaster(null); loadOrders(); }}
      />
    )}
    </>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function statusDescription(status: string): string {
  switch (status) {
    case 'pending': return 'Мастер ещё не ответил на заказ. Ожидайте подтверждения.';
    case 'confirmed': return 'Заказ подтверждён. Приходите вовремя!';
    case 'alternative_proposed': return 'Мастер предложил другое время. Проверьте и подтвердите.';
    case 'declined': return 'Мастер отклонил заказ. Попробуйте другое время или другого мастера.';
    case 'completed': return 'Заказ выполнен. Спасибо, что выбрали нас!';
    case 'cancelled': return 'Заказ отменён.';
    default: return '';
  }
}
