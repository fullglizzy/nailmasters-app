'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ArrowLeft, ShoppingBag, Star, MessageCircle, Sparkles, Clock, Shield, CalendarCheck, XCircle, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, notificationKeys } from '@/hooks/api';
import { useAuthState } from '@/components/providers/guest-provider';
import type { NotificationType } from '@/lib/types';

// ── Icon & color mapping ─────────────────────────────────

const NOTIF_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  order_created: { icon: ShoppingBag, label: 'Новый заказ', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
  order_confirmed: { icon: CalendarCheck, label: 'Заказ подтверждён', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
  order_declined: { icon: XCircle, label: 'Заказ отклонён', color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  order_cancelled: { icon: XCircle, label: 'Заказ отменён', color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  order_completed: { icon: Check, label: 'Заказ завершён', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
  order_timeout: { icon: Clock, label: 'Время истекло', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
  alternative_time_proposed: { icon: Clock, label: 'Предложено время', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
  new_design_uploaded: { icon: Sparkles, label: 'Новый дизайн', color: 'text-purple-500 bg-purple-50 dark:bg-purple-950' },
  new_comment: { icon: MessageCircle, label: 'Новый комментарий', color: 'text-sky-500 bg-sky-50 dark:bg-sky-950' },
  new_review: { icon: Star, label: 'Новый отзыв', color: 'text-gold bg-gold/5' },
  master_response: { icon: MessageCircle, label: 'Ответ мастера', color: 'text-sky-500 bg-sky-50 dark:bg-sky-950' },
  rating_decreased: { icon: AlertTriangle, label: 'Снижение рейтинга', color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  system: { icon: Shield, label: 'Системное', color: 'text-muted-foreground bg-muted' },
};

const DEFAULT_CONFIG = { icon: Bell, label: 'Уведомление', color: 'text-muted-foreground bg-muted' };

// ── Helpers ──────────────────────────────────────────────

function formatRelative(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} д`;
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

function groupByDate(notifs: typeof sampleNotifs): Record<string, typeof sampleNotifs> {
  const groups: Record<string, typeof sampleNotifs> = {};
  notifs.forEach((n) => {
    const key = new Date(n.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
    (groups[key] ??= []).push(n);
  });
  return groups;
}

// Dummy type just for the helper — we use the actual Notification type
type sampleNotifs = { id: string; type: string; title: string; message: string; createdAt: string | Date; isRead: boolean }[];

// ── Page ─────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: notifs = [], isLoading } = useNotifications();
  const [showRead, setShowRead] = useState(false);

  // SSE — real-time new notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = () => {
      // Invalidate RQ cache so the list refetches
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    };
    es.onerror = () => { /* EventSource auto-reconnects */ };
    return () => es.close();
  }, [queryClient]);

  const markRead = async (id?: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(id ? { id } : {}),
    });
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  };

  const all = notifs as sampleNotifs;
  const filtered = showRead ? all : all.filter((n) => !n.isRead);
  const grouped = groupByDate(filtered);
  const unreadCount = all.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="rounded-full p-1.5 hover:bg-muted/50 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl">Уведомления</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} непрочитанных</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRead(!showRead)} className={`text-xs ${showRead ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {showRead ? 'Непрочитанные' : 'Все'}
            </button>
            {unreadCount > 0 && (
              <button onClick={() => markRead()} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                Прочитать все
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Нет уведомлений</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Здесь будут появляться заказы, отзывы и комментарии</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1">{date}</p>
                <div className="space-y-1">
                  {items.map((n) => {
                    const cfg = NOTIF_CONFIG[n.type] || DEFAULT_CONFIG;
                    return (
                      <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-colors hover:bg-accent/50 ${!n.isRead ? 'bg-accent/30 border border-border/20' : ''}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                          <cfg.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold">{cfg.label}</span>
                            {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-sm font-medium mb-0.5">{n.title}</p>
                          {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-1">{formatRelative(n.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
