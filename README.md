# NailMasters v2.0

Платформа каталога и заказа дизайнов маникюра. Full-stack приложение на Next.js 15.

## Стек

| Слой | Технологии |
|------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes, Drizzle ORM, PostgreSQL |
| **Кеш/Поиск** | Redis, PostgreSQL tsvector + GIN индекс |
| **Изображения** | Sharp (оптимизация при загрузке) |

## Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/fullglizzy/nailmasters-app.git
cd nailmasters-app
```

### 2. Установка зависимостей

```bash
pnpm install
```

### 3. Поднять инфраструктуру

```bash
docker-compose up -d
```

Поднимет PostgreSQL 16 и Redis 7.

### 4. Создать таблицы

```bash
pnpm db:push
```

### 5. Добавить поиск

```bash
pnpm db:search
```

Создаёт `search_vector` tsvector колонку, триггер автообновления и GIN индекс.

### 6. Заполнить тестовыми данными

```bash
pnpm db:seed
```

### 7. Запустить dev-сервер

```bash
pnpm dev
```

Открыть [http://localhost:3000](http://localhost:3000).

## Тестовые аккаунты

| Роль | Email | Пароль | Доступ |
|------|-------|--------|--------|
| **Администратор** | `admin@nailmasters.com` | `Admin123!` | `/admin` |
| **Мастер** | `anna@nailmasters.com` | `Master123!` | ЛК мастера |
| **Мастер** | `elena@nailmasters.com` | `Master123!` | |
| **Мастер** | `olga@nailmasters.com` | `Master123!` | |
| **Мастер** | `maria@nailmasters.com` | `Master123!` | |
| **Мастер** | `daria@nailmasters.com` | `Master123!` | |
| **Клиент** | `client@nailmasters.com` | `Client123!` | ЛК клиента |
| **Клиент** | `katya@nailmasters.com` | `Client123!` | |
| **Клиент** | `nastya@nailmasters.com` | `Client123!` | |
| **Клиент** | `sasha@nailmasters.com` | `Client123!` | |

## Данные сида

```
👑 Администраторы: 1
💅 Мастера: 5 (Москва, СПб, Казань)
👤 Клиенты: 4
💅 Дизайны: 15
🔧 Услуги: ~25
📅 Слоты расписания: ~250 (на 2 недели)
📋 Заказы: 25
⭐ Оценки: ~15
❤️ Лайки: ~60
💬 Комментарии: ~20
```

## Структура проекта

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/             # Основные страницы
│   ├── (auth)/             # Авторизация
│   └── api/                # 50+ API эндпоинтов
├── components/             # React компоненты
│   ├── auth/               # Auth guard
│   ├── booking/            # Бронирование
│   ├── design/             # Карточки, модалы, лента
│   ├── layout/             # Header, BottomNav
│   ├── master/             # Карточки мастеров
│   ├── profile/            # Табы ЛК
│   ├── review/             # Отзывы
│   └── shared/             # Общие компоненты
├── db/
│   ├── schema/             # Drizzle ORM (16 таблиц)
│   ├── migrations/         # SQL миграции
│   └── seeds/              # Сиды
├── hooks/                  # useLike, useModal, useTikTokFeed
├── lib/                    # Утилиты (auth, db, search, geo, upload...)
└── data/                   # Константы (цвета, специализации)
```

## Основные возможности

### Клиент
- TikTok-лента дизайнов (свайп, авто-play видео)
- Каталог с фильтрами (цвет, форма, длина, сезон, техника, теги)
- Лайки, комментарии, избранное
- Запись к мастеру (мульти-услуги, выбор даты/времени)
- Отзывы о мастерах
- Гостевой режим (авто-регистрация, локальные лайки)

### Мастер
- Создание дизайнов (изображения + видео, sharp оптимизация)
- Управление услугами и расписанием
- «Я так могу» — привязка любых дизайнов
- Подтверждение/отклонение/завершение заказов
- Статистика и рейтинг
- Авто-блокировка слотов при подтверждении

### Администратор
- Панель `/admin`
- Модерация дизайнов (одобрить/отклонить/удалить)
- Блокировка пользователей
- Просмотр заказов с полной информацией
- Статистика платформы

## Команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Dev-сервер :3000 |
| `pnpm build` | Production сборка |
| `pnpm start` | Production сервер |
| `pnpm db:push` | Применить схему БД |
| `pnpm db:search` | Создать tsvector + GIN |
| `pnpm db:seed` | Заполнить тестовыми данными |
| `pnpm db:studio` | Drizzle Studio (GUI для БД) |
| `pnpm lint` | Проверка кода |
| `pnpm typecheck` | Проверка типов |

## Сброс БД

```bash
docker exec -i nailmasters-db psql -U nailmasters -d postgres -c "DROP DATABASE nailmasters;"
docker exec -i nailmasters-db psql -U nailmasters -d postgres -c "CREATE DATABASE nailmasters;"
pnpm db:push && pnpm db:search && pnpm db:seed
```

## Переменные окружения

Скопировать `.env.example` → `.env.local`:

```env
DATABASE_URL=postgres://nailmasters:nailmasters_secret@localhost:5432/nailmasters
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
ADMIN_REGISTRATION_SECRET=admin_secret_key_2026
```

## Лицензия

MIT
