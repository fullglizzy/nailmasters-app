'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

interface Notification { id: string; type: string; title: string; message: string; createdAt: string; isRead: boolean; }

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(0);

  const fetchNotifs = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const list = json.data || [];
          setNotifications(list);
          setUnreadCount(list.length);
          // Toast for new notifications
          if (list.length > prevCountRef.current) {
            const latest = list[0];
            if (latest) toast(latest.title, { description: latest.message });
          }
          prevCountRef.current = list.length;
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // 15s
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id?: string) => {
    const token = localStorage.getItem('token');
    await fetch('/api/notifications', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token!}` },
      body: JSON.stringify(id ? { id } : {}),
    });
    if (id) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
    setOpen(false);
  };

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
