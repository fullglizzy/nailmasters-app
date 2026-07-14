'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  Users, Palette, ShoppingBag, BarChart3, Shield, Search,
  Star, Clock, TrendingUp
} from 'lucide-react';
import { useAdminStats, useAdminUsers, useAdminDesigns, useAdminOrders } from '@/hooks/api';
import { useMasters } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { AdminUser, Design, OrderEnriched, Master } from '@/lib/types';
import { OrderDetailModal } from './order-detail-modal';

type Tab = 'overview' | 'users' | 'designs' | 'orders' | 'masters';

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, getToken, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedOrder, setSelectedOrder] = useState<OrderEnriched | null>(null);
  const [search, setSearch] = useState('');

  const role = user?.role ?? '';

  // Auth check
  useEffect(() => {
    if (!authLoading && role !== 'admin') { router.push('/auth'); }
  }, [authLoading, role, router]);

  // RQ hooks — auto-fetch when token exists
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users = [] } = useAdminUsers(search);
  const { data: designs = [] } = useAdminDesigns();
  const { data: orders = [] } = useAdminOrders();
  const { data: masters = [] } = useMasters({ limit: 100 });

  const isLoading = statsLoading && role === 'admin';

  const handleBlock = async (userId: string) => {
    const token = getToken();
    await fetch(`/api/admin/users/${userId}/block`, { method: 'PUT', headers: { Authorization: `Bearer ${token!}` } });
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const handleModerate = async (designId: string, approved: boolean) => {
    const token = getToken();
    await fetch(`/api/designs/${designId}/moderate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token!}` }, body: JSON.stringify({ isModerated: approved, isActive: approved }) });
    queryClient.invalidateQueries({ queryKey: ['admin', 'designs'] });
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!confirm('Удалить дизайн навсегда?')) return;
    const token = getToken();
    const res = await fetch(`/api/designs/${designId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token!}` } });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'designs'] });
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /></div>;
  if (role !== 'admin') return null;

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Обзор', icon: BarChart3 },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'designs', label: 'Дизайны', icon: Palette },
    { id: 'orders', label: 'Заказы', icon: ShoppingBag },
    { id: 'masters', label: 'Мастера', icon: Shield },
  ];

  return (<>
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10"><Shield className="h-5 w-5 text-destructive" /></div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Администрирование</p>
            <h1 className="font-display text-3xl">Панель управления</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar mb-6 border-b pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-[1px] transition-colors ${
                tab === t.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Пользователи', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950' },
                { label: 'Мастера', value: stats.totalMasters, icon: Star, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950' },
                { label: 'Клиенты', value: stats.totalClients, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' },
                { label: 'Дизайны', value: stats.totalDesigns, icon: Palette, color: 'text-pink-600 bg-pink-50 dark:bg-pink-950' },
                { label: 'Заказы', value: stats.totalOrders, icon: ShoppingBag, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950' },
                { label: 'Активные', value: stats.activeOrders, icon: Clock, color: 'text-green-600 bg-green-50 dark:bg-green-950' },
                { label: 'Загрузки', value: stats.totalUploads, icon: TrendingUp, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950' },
                { label: 'Выручка', value: `$${(stats.revenue || 0).toLocaleString()}`, icon: BarChart3, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border bg-card p-4">
                  <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.color} mb-2`}><s.icon className="h-4 w-4" /></div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по email или имени..."
                  className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">Пользователь</th><th className="text-left p-3 font-medium">Роль</th><th className="text-left p-3 font-medium">Статус</th><th className="text-right p-3 font-medium">Действия</th></tr></thead>
                <tbody>
                  {users.map((u: AdminUser) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-3"><div className="font-medium">{u.username}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                      <td className="p-3"><span className="capitalize text-xs">{u.role === 'nailmaster' ? 'Мастер' : u.role === 'admin' ? 'Админ' : 'Клиент'}</span></td>
                      <td className="p-3">{u.blocked ? <span className="text-xs text-destructive font-medium">Заблокирован</span> : <span className="text-xs text-emerald-600 font-medium">Активен</span>}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleBlock(u.id)} className={`rounded-full px-3 py-1 text-xs font-medium ${u.blocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}>
                          {u.blocked ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Designs */}
        {tab === 'designs' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {designs.map((d: Design) => (
                <Link key={d.id} href={`/explore/${d.id}`} className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all">
                  <div className="aspect-square relative bg-muted">
                    <Image src={d.images?.[0] || '/placeholder.svg'} alt={d.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="text-sm font-medium truncate">{d.title}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{d.type === 'designer' ? 'Дизайнерский' : 'Базовый'}</span>
                      <span>· {d.source}</span>
                      <span>· ❤️ {d.likesCount}</span>
                    </div>
                    <div className="flex gap-1">
                      {!d.isModerated ? (
                        <>
                          <button onClick={(e) => { e.preventDefault(); handleModerate(d.id, true); }} className="flex-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Одобрить</button>
                          <button onClick={(e) => { e.preventDefault(); handleModerate(d.id, false); }} className="flex-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20">Отклонить</button>
                        </>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">✅ Одобрен</span>
                      )}
                      <button onClick={(e) => { e.preventDefault(); handleDeleteDesign(d.id); }} className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20" title="Удалить">🗑</button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Orders */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">ID</th><th className="text-left p-3 font-medium">Статус</th><th className="text-left p-3 font-medium">Сумма</th><th className="text-left p-3 font-medium">Дата</th></tr></thead>
                <tbody>
                  {orders.map((o: OrderEnriched) => (
                    <tr key={o.id} className="border-t cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedOrder(o)}>
                      <td className="p-3 font-mono text-xs">{o.id.slice(0, 8)}...</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : o.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                      <td className="p-3 font-medium">${parseInt(String(o.price || '0')).toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground">{new Date(o.requestedDateTime).toLocaleDateString('ru')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Masters */}
        {tab === 'masters' && (
          <div className="space-y-4">
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">Мастер</th><th className="text-left p-3 font-medium">Город</th><th className="text-left p-3 font-medium">Рейтинг</th><th className="text-left p-3 font-medium">Заказов</th><th className="text-left p-3 font-medium">Статус</th></tr></thead>
                <tbody>
                  {masters.map((m: Master) => (
                    <tr key={m.userId} className="border-t">
                      <td className="p-3"><Link href={`/masters/${m.userId}`} className="font-medium hover:text-primary hover:underline">{m.fullName}</Link><div className="text-xs text-muted-foreground">{m.phone}</div></td>
                      <td className="p-3">{m.city || '—'}</td>
                      <td className="p-3"><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />{String(m.rating)}</span></td>
                      <td className="p-3">{m.totalOrders}</td>
                      <td className="p-3">{m.isModerated ? <span className="text-xs text-emerald-600 font-medium">✅ Проверен</span> : <span className="text-xs text-amber-600 font-medium">⏳ На проверке</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    <OrderDetailModal order={selectedOrder} open={!!selectedOrder} onClose={() => setSelectedOrder(null)} />
  </>);
}
