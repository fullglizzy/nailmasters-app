'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, notificationKeys } from '@/hooks/api';
import { useAuthState } from '@/components/providers/guest-provider';

/**
 * Notification bell — global, rendered in header on every page.
 * - Badge shows unread count from RQ cache.
 * - SSE keeps the count live (invalidates RQ when new notifs arrive).
 */
export function NotificationBell() {
  const { token } = useAuthState();
  const { data: notifs = [] } = useNotifications();
  const queryClient = useQueryClient();

  // SSE — live notification count globally
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    };
    es.onerror = () => {};
    return () => es.close();
  }, [token, queryClient]);

  if (!token) return null;

  const unread = notifs.filter((n) => !n.isRead).length;

  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${unread > 0 ? ` (${unread})` : ''}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
    >
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white pointer-events-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
