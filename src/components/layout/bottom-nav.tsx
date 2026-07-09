'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, User, Play, Shield, MessageCircle } from 'lucide-react';
import { useAuthState } from '@/components/providers/guest-provider';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

export function BottomNavigation() {
  const pathname = usePathname();
  const { role } = useAuthState();
  const unreadMessages = useUnreadMessages();

  const items = [
    { href: '/', icon: Home, label: 'Главная' },
    { href: '/search', icon: Search, label: 'Поиск' },
    { href: '/create', icon: Plus, label: 'Создать' },
    { href: '/explore', icon: Play, label: 'Лента' },
    //{ href: '/messages', icon: MessageCircle, label: 'Чаты' },
    ...(role === 'admin' ? [{ href: '/admin', icon: Shield, label: 'Админ' }] : []),
    { href: '/profile', icon: User, label: 'Профиль' },
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
              {item.href === '/messages' && unreadMessages > 0 && (
                <span className="absolute top-2 left-9 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
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
