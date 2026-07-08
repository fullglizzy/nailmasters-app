'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, User, Play, Shield } from 'lucide-react';
import { useAuthState } from '@/components/providers/guest-provider';

export function BottomNavigation() {
  const pathname = usePathname();
  const { role } = useAuthState();

  const items = [
    { href: '/', icon: Home, label: 'Главная' },
    { href: '/explore', icon: Play, label: 'Лента' },
    { href: '/create', icon: Plus, label: 'Создать' },
    { href: '/search', icon: Search, label: 'Поиск' },
    ...(role === 'admin' ? [{ href: '/admin', icon: Shield, label: 'Админ' }] : []),
    { href: '/profile', icon: User, label: 'Профиль' },
  ];

  const hideOn = ['/auth', '/explore'];
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
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
