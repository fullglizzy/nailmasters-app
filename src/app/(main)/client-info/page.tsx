'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, User, Users, Shield, Star, ExternalLink, Clipboard, Zap } from 'lucide-react';

export default function ClientInfoPage() {
  return (
    <div className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" /> Документация для заказчика
          </div>
          <h1 className="font-display text-4xl md:text-5xl">Как работает NailMasters</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Полное руководство по платформе — роли, механики, тестирование, развёртывание
          </p>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'Тестовые аккаунты', href: '#accounts' },
            { label: 'Роли', href: '#roles' },
            { label: 'Клиент', href: '#client-flow' },
            { label: 'Мастер', href: '#master-flow' },
            { label: 'Админ', href: '#admin-flow' },
            { label: 'Тех. детали', href: '#tech' },
          ].map(l => (
            <a key={l.href} href={l.href} className="rounded-full border border-border/60 px-4 py-1.5 text-sm hover:bg-accent transition-colors">{l.label}</a>
          ))}
        </div>

        {/* Accounts */}
        <Section id="accounts" icon={Clipboard} title="Тестовые аккаунты">
          <p className="mb-4">Для тестирования всех ролей используйте эти учётные данные:</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { role: 'Администратор', email: 'admin@nailmasters.com', pass: 'Admin123!', note: 'Полный доступ, /admin' },
              { role: 'Мастер', email: 'anna@nailmasters.com', pass: 'Master123!', note: 'Все мастера: пароль Master123!' },
              { role: 'Клиент', email: 'client@nailmasters.com', pass: 'Client123!', note: 'Все клиенты: пароль Client123!' },
            ].map(a => (
              <div key={a.role} className="rounded-xl border border-border/40 bg-card p-4">
                <div className="font-semibold text-sm mb-2">{a.role}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Email: <code className="bg-muted px-1 rounded">{a.email}</code></div>
                  <div>Пароль: <code className="bg-muted px-1 rounded">{a.pass}</code></div>
                  <div className="text-[11px] mt-1 text-muted-foreground/70">{a.note}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Roles */}
        <Section id="roles" icon={Users} title="Роли пользователей">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: User, title: 'Клиент', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950',
                items: ['Просмотр каталога дизайнов', 'TikTok-лента (свайпы)', 'Лайки и комментарии', 'Запись к мастеру', 'Отзывы о мастерах', 'Гостевой режим'],
              },
              {
                icon: Star, title: 'Мастер', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
                items: ['Создание дизайнов', 'Управление услугами', 'Расписание', 'Подтверждение заказов', '«Я так могу» — привязка дизайнов', 'Статистика и рейтинг'],
              },
              {
                icon: Shield, title: 'Администратор', color: 'text-red-600 bg-red-50 dark:bg-red-950',
                items: ['Модерация дизайнов', 'Блокировка пользователей', 'Статистика платформы', 'Просмотр всех заказов', 'Модерация мастеров', 'Панель /admin'],
              },
            ].map(r => (
              <div key={r.title} className="rounded-xl border border-border/40 bg-card p-5">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${r.color} mb-3`}>
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold mb-3">{r.title}</h3>
                <ul className="space-y-1.5">
                  {r.items.map(i => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary mt-1.5 block h-1 w-1 rounded-full shrink-0 bg-primary" />{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Client flow */}
        <Section id="client-flow" icon={User} title="Flow: Клиент">
          <Flow steps={[
            { num: 1, text: 'Заходит на сайт → видит сетку дизайнов' },
            { num: 2, text: 'Кликает на дизайн → TikTok-лента /explore/{id} — вертикальный свайп' },
            { num: 3, text: 'В ленте: лайк ❤️, комментарии 💬, подробнее 👁, записаться 👥' },
            { num: 4, text: '«Записаться» → модал MastersList → выбор мастера → страница мастера' },
            { num: 5, text: 'На странице мастера → кнопка «Записаться» → BookingModal' },
            { num: 6, text: 'Выбор услуг (можно несколько) → дата/время → опционально дизайн → подтверждение' },
            { num: 7, text: 'Заказ создан (pending) → ждёт подтверждения мастера' },
            { num: 8, text: 'Личный кабинет /profile → вкладка «Заказы» → видно все статусы' },
          ]} />
        </Section>

        {/* Master flow */}
        <Section id="master-flow" icon={Star} title="Flow: Мастер">
          <Flow steps={[
            { num: 1, text: 'Регистрируется как nailmaster (phone обязателен)' },
            { num: 2, text: 'Редактирует профиль: описание, специализации, город, стерилизация' },
            { num: 3, text: 'Создаёт услуги (Услуги → + Добавить): название, цена, длительность' },
            { num: 4, text: 'Настраивает расписание (Расписание → + Добавить): дата + интервал' },
            { num: 5, text: 'В TikTok-ленте жмёт «Я так могу» ✓ на дизайнах — добавляет в портфолио' },
            { num: 6, text: 'В заказах видит новые → Подтверждает / Отклоняет / Завершает' },
            { num: 7, text: 'При подтверждении слот в расписании блокируется автоматически' },
            { num: 8, text: 'При завершении слот освобождается, растёт счётчик заказов' },
          ]} />
        </Section>

        {/* Admin flow */}
        <Section id="admin-flow" icon={Shield} title="Flow: Администратор">
          <Flow steps={[
            { num: 1, text: 'Входит под admin@nailmasters.com → /admin' },
            { num: 2, text: 'Обзор: метрики платформы (пользователи, заказы, выручка)' },
            { num: 3, text: 'Пользователи: поиск, блокировка/разблокировка' },
            { num: 4, text: 'Дизайны: одобрить/отклонить (модерация), удалить' },
            { num: 5, text: 'Заказы: таблица всех заказов со статусами' },
            { num: 6, text: 'Мастера: рейтинг, статус проверки, кликабельные профили' },
          ]} />
        </Section>

        {/* Features */}
        <Section id="features" icon={Zap} title="Ключевые механики">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'TikTok-лента', desc: 'CSS snap-scroll, авто-play видео (IntersectionObserver), URL меняется через history.replaceState без перезагрузки. Клик центр видео = пауза, края = переключение медиа.' },
              { title: 'Мульти-услуги', desc: 'Клиент выбирает несколько услуг (чекбоксы). Суммируются цена и длительность. Слоты фильтруются под общую длительность. Один заказ на все услуги.' },
              { title: 'Загрузка медиа', desc: 'Изображения: drag-drop, оптимизация через sharp (4 размера, WebP). Видео: file upload (MP4/WebM/MOV, до 100MB). Magic bytes валидация.' },
              { title: 'Расписание', desc: 'Мастер создаёт слоты (дата + время). Клиент видит только свободные и подходящие по длительности. Авто-блокировка при подтверждении, авто-разблокировка при отмене/завершении.' },
              { title: 'Поиск', desc: 'Полнотекстовый tsvector + GIN индекс (русский язык). Фильтры: тип, источник, цвет (свотчи), теги (чипсы), длина, форма, сезон. Для мастеров: город, рейтинг, доступность.' },
              { title: 'Гостевой режим', desc: 'Авто-регистрация при первом лайке/комментарии. После действия гость получает токен и может продолжить как пользователь.' },
              { title: 'Отзывы и рейтинг', desc: 'Клиент оставляет оценку 1-5 + текст. Средний рейтинг мастера пересчитывается при каждом новом отзыве. Отзывы видны на странице мастера.' },
              { title: 'Админ-панель', desc: '/admin — полный контроль: пользователи, дизайны (модерация + удаление), заказы, мастера. Статистика в реальном времени.' },
            ].map(f => (
              <div key={f.title} className="rounded-xl border border-border/40 bg-card p-4">
                <h4 className="font-bold text-sm mb-1.5">{f.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Tech */}
        <Section id="tech" icon={ExternalLink} title="Технические детали">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <h4 className="font-bold mb-2">Стек</h4>
              <p className="text-muted-foreground">Next.js 15 + React 19 (App Router) · Tailwind CSS · Drizzle ORM · PostgreSQL · Redis · TypeScript · shadcn/ui · Sharp (изображения)</p>
            </div>
            
            
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <h4 className="font-bold mb-2">Структура проекта</h4>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`src/
├── app/           # Next.js App Router (страницы + API)
│   ├── (main)/    # Основные страницы
│   ├── (auth)/    # Авторизация
│   └── api/       # 50+ API эндпоинтов
├── components/    # React компоненты (~80+)
├── hooks/         # Кастомные хуки
├── lib/           # Утилиты (auth, db, search, geo...)
├── db/schema/     # Drizzle ORM схемы (16 таблиц)
└── data/          # Константы (цвета, специализации)`}
              </pre>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <h4 className="font-bold mb-2">База данных</h4>
              <p className="text-muted-foreground">16 таблиц, GIN-индекс для поиска, триггер tsvector, 12+ индексов. Основные: users, nail_designs, orders, master_services, schedules, master_ratings, comments, notifications, client_liked_designs.</p>
            </div>
          </div>
        </Section>

        <div className="text-center pt-8 pb-16 text-sm text-muted-foreground">
          NailMasters v2.0 · Стек: Next.js 15 + Drizzle ORM + PostgreSQL · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Flow({ steps }: { steps: { num: number; text: string }[] }) {
  return (
    <div className="space-y-0">
      {steps.map((s, i) => (
        <div key={s.num} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shrink-0">{s.num}</div>
            {i < steps.length - 1 && <div className="w-px flex-1 bg-border/40 my-1" />}
          </div>
          <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{s.text}</p>
        </div>
      ))}
    </div>
  );
}
