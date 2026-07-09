'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/api';
import { useAuthState } from '@/components/providers/guest-provider';

/**
 * Notification bell icon — links to /notifications hub page.
 * Badge shows unread count from RQ cache (zero extra API calls).
 */
export function NotificationBell() {
  const { token, isGuest } = useAuthState();
  const { data: notifs = [] } = useNotifications();
  const unread = notifs.length;

  if (!token || isGuest) return null;

  return (
    <Link
      href="/notifications"
      aria-label={`Уведомления${unread > 0 ? ` (${unread})` : ''}`}
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
