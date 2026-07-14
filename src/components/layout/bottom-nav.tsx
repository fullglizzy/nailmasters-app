'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, User, Bell, Shield } from 'lucide-react';
import { useAuthState } from '@/components/providers/guest-provider';
import { useNotifications } from '@/hooks/api';

export function BottomNavigation() {
  const pathname = usePathname();
  const { role } = useAuthState();
  const { data: notifs = [] } = useNotifications();
  const unread = notifs.filter((n) => !n.isRead).length;

  const items = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/create', icon: Plus, label: 'Create' },
    { href: '/notifications', icon: Bell, label: 'Alerts' },
    ...(role === 'admin' ? [{ href: '/admin', icon: Shield, label: 'Admin' }] : []),
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  const hideOn = ['/explore'];
  if (hideOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/85 backdrop-blur-md safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
              {item.href === '/notifications' && unread > 0 && (
                <span className="absolute top-2 left-9 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
