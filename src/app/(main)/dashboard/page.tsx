'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ShoppingBag, Image, Star, Calendar, Settings } from 'lucide-react';
import { useAdminStats } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth');
  }, [isLoading, isAuthenticated, router]);

  const role = user?.role ?? null;

  const { data: stats, isLoading: statsLoading } = useAdminStats();

  if (isLoading || role === null || (role === 'admin' && statsLoading)) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;
  }

  const iconWrapperClass = 'flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.06]';
  const iconClass = 'h-5 w-5 text-primary';

  if (role === 'admin') {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Администрирование</p>
            <h1 className="font-display text-3xl">Панель управления</h1>
          </div>

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              {[
                { label: 'Пользователи', value: stats.totalUsers, icon: Users },
                { label: 'Мастера', value: stats.totalMasters, icon: Star },
                { label: 'Дизайны', value: stats.totalDesigns, icon: Image },
                { label: 'Заказы', value: stats.totalOrders, icon: ShoppingBag },
                { label: 'Активные', value: stats.activeOrders, icon: Calendar },
                { label: 'Клиенты', value: stats.totalClients, icon: Users },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border/40 bg-card p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                    <s.icon className="h-3.5 w-3.5 text-primary/70" /> {s.label}
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Пользователи', href: '/dashboard/users', icon: Users },
              { label: 'Дизайны (модерация)', href: '/dashboard/designs', icon: Image },
              { label: 'Заказы', href: '/dashboard/orders', icon: ShoppingBag },
              { label: 'Поиск мастеров', href: '/search', icon: Star },
              { label: 'Настройки', href: '/profile', icon: Settings },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-5 hover:shadow-md hover:border-border transition-all duration-200">
                <div className={iconWrapperClass}>
                  <item.icon className={iconClass} />
                </div>
                <span className="font-semibold text-sm">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (role === 'nailmaster') {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Мастер</p>
            <h1 className="font-display text-3xl">Панель мастера</h1>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Мои заказы', href: '/profile?tab=orders', icon: ShoppingBag },
              { label: 'Управление услугами', href: '/profile?tab=services', icon: Settings },
              { label: 'Расписание', href: '/profile?tab=schedule', icon: Calendar },
              { label: 'Мои дизайны', href: '/profile?tab=designs', icon: Image },
              { label: 'Профиль', href: '/profile', icon: Star },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-5 hover:shadow-md hover:border-border transition-all duration-200">
                <div className={iconWrapperClass}>
                  <item.icon className={iconClass} />
                </div>
                <span className="font-semibold text-sm">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Кабинет</p>
          <h1 className="font-display text-3xl">Мой кабинет</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Мои заказы', href: '/profile?tab=orders', icon: ShoppingBag },
            { label: 'Избранное', href: '/profile?tab=favorites', icon: Star },
            { label: 'Мои дизайны', href: '/profile?tab=designs', icon: Image },
            { label: 'Профиль', href: '/profile', icon: Settings },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-5 hover:shadow-md hover:border-border transition-all duration-200">
              <div className={iconWrapperClass}>
                <item.icon className={iconClass} />
              </div>
              <span className="font-semibold text-sm">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
