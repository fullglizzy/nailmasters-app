'use client';

import { X, Calendar, Clock, User, Palette, Sparkles, Star } from 'lucide-react';

interface OrderDetail {
  id: string; status: string; price: string; requestedDateTime: string;
  proposedDateTime?: string | null; confirmedDateTime?: string | null; completedAt?: string | null;
  description?: string | null; clientNotes?: string | null; masterNotes?: string | null;
  clientId: string; nailMasterId: string; masterServiceId: string;
  serviceIds?: string[] | null; nailDesignId?: string | null;
  _design?: { title: string; images: string[] } | null;
  _clientName?: string; _masterName?: string;
}

interface Props { order: OrderDetail | null; open: boolean; onClose: () => void; }

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', confirmed: 'Подтверждён', alternative_proposed: 'Предложено время',
  declined: 'Отклонён', completed: 'Завершён', cancelled: 'Отменён',
};

export function OrderDetailModal({ order, open, onClose }: Props) {
  if (!open || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-xl modal-enter" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
          <div>
            <h2 className="font-bold text-lg">Детали заказа</h2>
            <p className="text-xs text-muted-foreground font-mono">{order.id}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted/50"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + Price */}
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-gold/10 text-gold px-3 py-1 text-sm font-semibold">
              {STATUS_LABELS[order.status] || order.status}
            </span>
            <span className="text-xl font-bold text-primary">{parseInt(order.price || '0').toLocaleString()} ₽</span>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Время</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Запрошено" value={new Date(order.requestedDateTime).toLocaleString('ru')} />
              {order.proposedDateTime && <Info label="Предложено" value={new Date(order.proposedDateTime).toLocaleString('ru')} />}
              {order.confirmedDateTime && <Info label="Подтверждено" value={new Date(order.confirmedDateTime).toLocaleString('ru')} />}
              {order.completedAt && <Info label="Завершён" value={new Date(order.completedAt).toLocaleString('ru')} />}
            </div>
          </div>

          {/* Services */}
          {order.description && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4" />Услуги</h3>
              <p className="text-sm bg-muted/30 rounded-lg p-3">{order.description}</p>
            </div>
          )}

          {/* Design */}
          {order._design && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2"><Palette className="h-4 w-4" />Дизайн</h3>
              <a href={`/explore/${order.nailDesignId}`} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 hover:bg-accent/50 transition-colors">
                <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0">
                  <img src={order._design.images[0] || '/placeholder.svg'} alt="" className="h-full w-full object-cover" />
                </div>
                <span className="text-sm font-medium hover:text-primary">{order._design.title}</span>
              </a>
            </div>
          )}

          {/* Notes */}
          {order.clientNotes && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Пожелания клиента</h3>
              <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3">{order.clientNotes}</p>
            </div>
          )}
          {order.masterNotes && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Заметки мастера</h3>
              <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3">{order.masterNotes}</p>
            </div>
          )}

          {/* Participants */}
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Клиент:</span>
              <span className="font-medium">{order._clientName || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Мастер:</span>
              <a href={`/masters/${order.nailMasterId}`} className="font-medium text-primary hover:underline">{order._masterName || '—'}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium text-sm">{value}</div>
    </div>
  );
}
