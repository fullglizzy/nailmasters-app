'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check, ArrowLeft, ShoppingBag, Star, MessageCircle, Sparkles, Clock, Shield, CalendarCheck, XCircle, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, notificationKeys } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { NotificationType, Notification } from '@/lib/types';

// ── Config ───────────────────────────────────────────────

const NOTIF_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  order_created:             { icon: ShoppingBag,    label: 'New order',        color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
  order_confirmed:           { icon: CalendarCheck,  label: 'Order confirmed',  color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
  order_declined:            { icon: XCircle,        label: 'Order declined',   color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  order_cancelled:           { icon: XCircle,        label: 'Order cancelled',  color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  order_completed:           { icon: Check,          label: 'Order completed',  color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
  order_timeout:             { icon: Clock,          label: 'Order timed out',  color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
  alternative_time_proposed: { icon: Clock,          label: 'Time proposed',    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
  new_design_uploaded:       { icon: Sparkles,       label: 'New design',       color: 'text-purple-500 bg-purple-50 dark:bg-purple-950' },
  new_comment:               { icon: MessageCircle,  label: 'New comment',      color: 'text-sky-500 bg-sky-50 dark:bg-sky-950' },
  new_review:                { icon: Star,           label: 'New review',       color: 'text-gold bg-gold/5' },
  master_response:           { icon: MessageCircle,  label: 'Master response',  color: 'text-sky-500 bg-sky-50 dark:bg-sky-950' },
  rating_decreased:          { icon: AlertTriangle,  label: 'Rating drop',      color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  system:                    { icon: Shield,         label: 'System',           color: 'text-muted-foreground bg-muted' },
};
const DEFAULT_CONFIG = { icon: Bell, label: 'Notification', color: 'text-muted-foreground bg-muted' };

/** Map notification type + metadata → sensible navigation target */
function getNotifLink(n: Notification): string | null {
  const meta = n.metadata as Record<string, unknown> | undefined;
  const orderId = n.relatedOrderId;
  const designId = meta?.designId as string | undefined;
  const masterId = meta?.masterId as string | undefined;

  if (n.type.startsWith('order_') || n.type === 'alternative_time_proposed') {
    return '/profile?tab=orders';
  }
  if (n.type === 'new_comment' || n.type === 'master_response') {
    return designId ? `/explore/${designId}` : null;
  }
  if (n.type === 'new_design_uploaded') {
    return designId ? `/explore/${designId}` : null;
  }
  if (n.type === 'new_review' || n.type === 'rating_decreased') {
    return masterId ? `/masters/${masterId}` : '/profile?tab=reviews';
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────

function formatRelative(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

function groupByDate(notifs: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  notifs.forEach((n) => {
    const key = new Date(n.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
    (groups[key] ??= []).push(n);
  });
  return groups;
}

// ── Page ─────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getToken, isLoading: authLoading } = useAuth();
  const { data: notifs = [], isLoading } = useNotifications();
  const [showRead, setShowRead] = useState(false);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;

  const markRead = async (id?: string) => {
    const token = getToken();
    if (!token) return;
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(id ? { id } : {}),
    });
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  };

  const filtered = showRead
    ? (notifs as Notification[])
    : (notifs as Notification[]).filter((n) => !n.isRead);
  const grouped = groupByDate(filtered);
  const unreadCount = (notifs as Notification[]).filter((n) => !n.isRead).length;

  const handleNotifClick = (n: Notification) => {
    // Auto-read on click
    if (!n.isRead) markRead(n.id);
    // Navigate to relevant page
    const link = getNotifLink(n);
    if (link) router.push(link);
  };

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
              <h1 className="font-display text-2xl">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRead(!showRead)} className={`text-xs ${showRead ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {showRead ? 'Unread' : 'All'}
            </button>
            {unreadCount > 0 && (
              <button onClick={() => markRead()} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                Mark all read
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
            <p className="text-sm font-medium text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Orders, reviews, and comments will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1">{date}</p>
                <div className="space-y-1">
                  {items.map((n) => {
                    const cfg = NOTIF_CONFIG[n.type] || DEFAULT_CONFIG;
                    const link = getNotifLink(n);
                    return (
                      <div
                        key={n.id}
                        className={`group flex items-start gap-3 rounded-xl p-4 transition-colors ${!n.isRead ? 'bg-accent/30 border border-border/20' : 'hover:bg-accent/20'}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                          <cfg.icon className="h-5 w-5" />
                        </div>

                        {/* Clickable body → navigate */}
                        <div
                          onClick={() => handleNotifClick(n)}
                          className={`flex-1 min-w-0 ${link ? 'cursor-pointer' : ''}`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold">{cfg.label}</span>
                            {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-sm font-medium mb-0.5">{n.title}</p>
                          {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                        </div>

                        {/* Right column: time + mark-read button */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                          {!n.isRead && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                              title="Mark read"
                            >
                              <Check className="h-3 w-3" /> Read
                            </button>
                          )}
                        </div>
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
