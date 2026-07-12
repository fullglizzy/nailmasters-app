'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Plus, User } from 'lucide-react';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { useAuthState } from '@/components/providers/guest-provider';
import { NotificationBell } from '@/components/shared/notification-bell';

export function AppHeader() {
  const pathname = usePathname();
  const { token, role, isGuest } = useAuthState();

  const isAuthPage = pathname === '/auth';
  const isFeedPage = pathname.startsWith('/explore');

  if (isAuthPage || isFeedPage) return null;

  return (
    <header className="hidden md:block sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        {/* Навигация — centered */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-0.5">
          {[
            { href: '/explore', label: 'Лента' },
            { href: '/trending', label: 'Популярное' },
            { href: '/', label: 'Главная' },
            //{ href: '/client-info', label: 'Для заказчика' },
            ...(role === 'admin' ? [{ href: '/admin' as string, label: 'Админка' }] : []),
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                pathname.startsWith(item.href)
                  ? 'bg-foreground/[0.06] text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Действия — прижаты вправо */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Link
            href="/search"
            aria-label="Поиск"
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>

          {token && (
            <Link
              href="/create"
              aria-label="Создать дизайн"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
            >
              <Plus className="h-[18px] w-[18px]" />
            </Link>
          )}
          {/*{token && !isGuest && (
            <Link
              href="/messages"
              aria-label="Сообщения"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          )}*/}
          {token && !isGuest && <NotificationBell />}
          {token && (
            <Link
              href="/profile"
              aria-label="Профиль"
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                pathname === '/profile'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground'
              }`}
            >
              <User className="h-[18px] w-[18px]" />
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
