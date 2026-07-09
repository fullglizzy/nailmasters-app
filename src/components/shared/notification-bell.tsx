'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

interface Notification { id: string; type: string; title: string; message: string; createdAt: string; isRead: boolean; }

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef(0);

  const fetchNotifs = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const list: Notification[] = json.data || [];
          setNotifications(list);
          if (list.length > prevCountRef.current) {
            const latest = list[0];
            if (latest) toast(latest.title, { description: latest.message });
          }
          prevCountRef.current = list.length;
        }
      })
      .catch(() => {});
  }, []);

  // Первичная загрузка
  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // SSE: реальное время
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'notification' && msg.data?.id) {
          setNotifications(prev => {
            if (prev.some(n => n.id === msg.data.id)) return prev; // уже есть
            const next = [{ id: msg.data.id, type: msg.data.type, title: msg.data.title, message: msg.data.message, createdAt: msg.data.createdAt, isRead: false }, ...prev];
            if (next.length > prevCountRef.current) {
              toast(msg.data.title || 'Уведомление', { description: msg.data.message || '' });
            }
            prevCountRef.current = next.length;
            return next;
          });
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      // EventSource сам переподключается — ничего не делаем
    };

    return () => es.close();
  }, []);

  const markRead = async (id?: string) => {
    const token = localStorage.getItem('token');
    await fetch('/api/notifications', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token!}` },
      body: JSON.stringify(id ? { id } : {}),
    });
    if (id) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    } else {
      setNotifications([]);
    }
    setOpen(false);
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-card shadow-xl z-50 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-sm font-semibold">Уведомления</span>
              {notifications.length > 0 && (
                <button onClick={() => markRead()} className="text-xs text-muted-foreground hover:text-foreground">Прочитать все</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Нет новых уведомлений</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="w-full text-left p-3 border-b last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-xs font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
