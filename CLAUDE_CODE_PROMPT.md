# NailMasters v3.0 — Полная переработка

Ты работаешь над проектом NailMasters (Next.js full-stack, App Router, Drizzle ORM + PostgreSQL, Tailwind, React Query).
Твоя задача — методично выполнить план ниже, шаг за шагом. Каждый шаг описан конкретно с путями к файлам.

**Правила:**
- Не удаляй файлы пока не убедишься что они действительно мёртвые (grep по всему src)
- После каждого шага проверяй `pnpm typecheck` и `pnpm build`
- Коммить после каждого логического блока

---

## Шаг 1: Удаление мёртвого кода

### 1.1 Удалить файлы целиком (предварительно проверив grep что нет импортов)

```bash
# Проверить перед удалением:
grep -rn "server\.ts\|use-websocket\|RegisterGuard\|useGuestGuard\|guest-like\|comments/guest" src/ --include="*.ts" --include="*.tsx"
```

Удалить:
- `server.ts` — кастомный сервер, WebSocket не используется
- `src/hooks/use-websocket.ts` — 0 импортов
- `src/components/shared/register-guard.tsx` — RegisterGuard и useGuestGuard нигде не используются
- `src/app/api/designs/[id]/guest-like/route.ts` — фронтенд вызывает `/api/designs/${id}/like` с JWT гостя
- `src/app/api/designs/[id]/comments/guest/route.ts` — фронтенд вызывает `/api/designs/${id}/comments`

### 1.2 Удалить мёртвые функции из используемых файлов

В `src/lib/api-middleware.ts`:
- Удалить `withValidation` (строки 130-145) — нигде не используется
- Удалить `composeMiddleware` (строки 150-155) — нигде не используется

В `src/lib/errors.ts`:
- Удалить `handleApiError` (строки 57-75) — нигде не импортируется

В `src/lib/api.ts`:
- Удалить `isGuest()` (строки 32-36) — нигде не используется
- Удалить `isAuthenticated()` (строки 38-40) — нигде не используется
- Удалить реэкспорт `{ getAuthToken, isGuest, isAuthenticated }` из `src/components/auth/auth-guard-modal.tsx:57`

В `src/lib/validators.ts`:
- Удалить `registerGuestSchema` (строка 21-23) — пустой z.object({}), нигде не используется

### 1.3 Удалить мёртвые зависимости (11 пакетов с 0 импортов)

Эти пакеты установлены в `package.json` но **ни разу не импортируются** в коде (проверено grep-ом по всему src/):

Удалить из `dependencies`:
- `pino`, `pino-pretty` — логгер написан вручную
- `next-auth` — используется свой JWT
- `dompurify` — не используется
- `slugify` — не используется
- `class-variance-authority` — заготовка под shadcn/ui
- `next-safe` — security headers не настроены
- `embla-carousel-react`, `embla-carousel-autoplay` — карусель не реализована
- `react-day-picker` — календарь не реализован
- `recharts` — графики не реализованы
- `react-hook-form`, `@hookform/resolvers` — формы пишутся вручную
- `ws` — только в server.ts (удалён)

```bash
# После удаления из package.json:
pnpm install
```

### 1.4 Извлечь `sendNotification` из server.ts в отдельный модуль

Проблема: `server.ts` определяет `globalThis.sendNotification` (строки 111-128). 
Это вызывается в 4 роутах заказов:
- `src/app/api/orders/route.ts:157-158`
- `src/app/api/orders/[id]/cancel/route.ts:52-53`
- `src/app/api/orders/[id]/complete/route.ts:53-54`
- `src/app/api/orders/[id]/confirm/route.ts:70-71`

Решение: создать `src/lib/notifications.ts`:

```ts
// Отправка уведомления: пишет в БД + опционально Redis pub/sub
export async function sendNotification(userId: string, notification: { id: string; type: string; title: string; message: string; createdAt: string | Date }) {
  // На будущее: Redis pub/sub для масштабирования между инстансами
  // Пока SSE-полинг покрывает real-time
}
```

И заменить `globalThis.sendNotification(...)` → `sendNotification(...)` с импортом из `@/lib/notifications` в 4 файлах.

После этого можно спокойно удалять `server.ts`.

---

## Шаг 2: Рефакторинг системы аутентификации (BigTech single source of truth)

### Цель
Сейчас auth-состояние размазано: GuestSessionProvider (React Context), localStorage в 20+ файлах, lib/api.ts читает LS напрямую. 
Нужно сделать **единый AuthProvider**, где:
- accessToken хранится в `useRef` (closure), не в state, не в localStorage
- refreshToken — httpOnly cookie (уже так и есть)
- Данные пользователя загружаются с сервера при mount
- ВСЕ компоненты читают auth через `useAuth()` — больше ни одного `localStorage.getItem('token')` в компонентах

### 2.1 Создать новый `src/components/providers/auth-provider.tsx`

Переписать GuestSessionProvider в AuthProvider со следующим контрактом:

```ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (data: { token: string; refreshToken: string; user: User }) => void;
  logout: () => void;
  getToken: () => string | null; // возвращает accessToken из ref
}
```

Логика:
- При mount: если есть refreshToken cookie → GET /api/auth/session для получения профиля
- Гость НЕ создаётся автоматически при заходе на сайт (ленивое создание — см. шаг 2.4)
- accessToken в `useRef` (не в state, чтобы не триггерить ререндеры)
- user, isGuest, isLoading — в state
- `login()` обновляет ref + state
- `logout()` сбрасывает ref + state + вызывает API для удаления cookie
- Слушает `auth-change` event для cross-tab синхронизации

### 2.2 Создать новый эндпоинт `src/app/api/auth/session/route.ts`

```ts
// GET /api/auth/session
// Возвращает профиль текущего пользователя или { user: null }
// Не создаёт гостя — только читает существующую сессию
// Читает токен из Authorization header ИЛИ из refreshToken cookie
```

### 2.3 Обновить `src/app/layout.tsx`

Заменить `import { GuestSessionProvider }` → `import { AuthProvider }`. 
Обновить JSX: `<AuthProvider>` вместо `<GuestSessionProvider>`.

### 2.4 Ленивое создание гостя

Гость создаётся **только при первом действии, требующем идентификации** (лайк, комментарий, бронь). 
Добавить в AuthProvider метод:

```ts
ensureAuth: () => Promise<string | null>
// Если уже есть токен → вернуть его
// Если нет → POST /api/auth/register-guest → login(response) → вернуть токен
```

Обновить `use-like.ts` (и другие места):
- Было: `const token = localStorage.getItem('token'); if (!token) return;`
- Стало: `const token = await authProvider.ensureAuth(); if (!token) return;`

### 2.5 Обновить `auth-guard-modal.tsx`

Файл `src/components/auth/auth-guard-modal.tsx:57` реэкспортит `{ getAuthToken, isGuest, isAuthenticated }` из `@/lib/api`. 
После рефакторинга:
- Убрать строку 57 (реэкспорт)
- В `src/components/design/comments-modal.tsx:6` — заменить `import { AuthGuardModal, getAuthToken }` → `import { AuthGuardModal }`, и `getAuthToken()` на `useAuth().getToken()` (строки 217, 258)
- В `src/components/review/review-modal.tsx:5` — аналогично (строка 26)

### 2.6 Убрать ВСЕ прямые обращения к localStorage для auth

Заменить во всех файлах (список ниже) `localStorage.getItem('token')` / `localStorage.getItem('user')` на вызовы через `useAuth()`:

Файлы для исправления (каждый проверить grep-ом):
- `src/lib/api.ts` — `getAuthToken()` должен брать токен из AuthProvider (через getter или глобальную переменную)
- `src/hooks/use-like.ts:55` 
- `src/hooks/use-unread-messages.ts:13`
- `src/hooks/use-liked-ids.ts`
- `src/components/booking/booking-modal.tsx` 
- `src/components/profile/add-service-modal.tsx:32`
- `src/components/profile/bookings-tab.tsx:54`
- `src/components/profile/edit-profile-modal.tsx:180`
- `src/components/review/review-modal.tsx`
- `src/components/profile/reviews-tab.tsx:19-21`
- `src/components/profile/uploads-tab.tsx:13-15`
- `src/components/profile/favorites-tab.tsx`
- `src/app/(auth)/auth/page.tsx` — множественные обращения
- `src/app/(main)/admin/page.tsx:29-30`
- `src/app/(main)/dashboard/page.tsx:14-17`
- `src/app/(main)/notifications/page.tsx:85`
- `src/app/(main)/explore/[id]/page.tsx` — множественные обращения
- `src/app/(main)/messages-dev/page.tsx` — множественные обращения
- `src/app/(main)/profile/page.tsx` — множественные обращения
- `src/app/(main)/create/page.tsx`

### 2.7 Удалить старый `guest-provider.tsx` и связанные ключи

После полной миграции удалить `src/components/providers/guest-provider.tsx`.
Убедиться что `KEYS` и `clearAllAuth` / `clearAuth` / `persist` перенесены в AuthProvider или удалены.

Удалить все упоминания `guest_created`, `guest_likes` из localStorage (эти ключи больше не используются).
В `src/app/(auth)/auth/page.tsx` убрать `localStorage.removeItem('guest_likes')` и `localStorage.setItem('guest_created', '1')` — вместо этого вызывать `authProvider.login(data)`.

---

## Шаг 3: Исправление дефектов в API-роутах

### 3.1 Добавить try/catch в роуты без обработки ошибок

Файлы где нет try/catch (каждый обернуть, добавить `logger.error`):
- `src/app/api/messages/[id]/route.ts` — PUT и DELETE
- `src/app/api/comments/[commentId]/route.ts` — DELETE и POST toggle
- `src/app/api/designs/[id]/like-status/route.ts`
- `src/app/api/designs/liked/route.ts`
- `src/app/api/designs/[id]/comments/route.ts` — POST handler (строки 41-56)
- `src/app/api/notifications/route.ts`
- `src/app/api/master-rating/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/orders/route.ts`
- `src/app/api/masters/services/route.ts`
- `src/app/api/orders/[id]/confirm/route.ts`
- `src/app/api/orders/[id]/cancel/route.ts`
- `src/app/api/orders/[id]/decline/route.ts`
- `src/app/api/orders/[id]/complete/route.ts`

### 3.2 Добавить Zod-валидацию где её нет

- `src/app/api/messages/route.ts` POST (строка 143-150) — заменить ручную проверку на Zod schema с полями: text (min 1, max 5000), receiverId (uuid), attachments (array, optional), replyToId (uuid, optional)
- `src/app/api/messages/[id]/route.ts` PUT — добавить Zod schema для text
- `src/app/api/orders/route.ts` GET (строка 17-19) — использовать `paginationSchema` для page/limit
- `src/app/api/admin/orders/route.ts` GET — использовать `paginationSchema`
- `src/app/api/admin/users/route.ts` GET — использовать `paginationSchema`
- `src/app/api/masters/search/route.ts` (строка 6-14) — использовать Zod schema для query params
- `src/app/api/orders/[id]/propose-time/route.ts` — валидировать proposedDateTime через Zod
- `src/app/api/master-rating/review/[reviewId]/route.ts` PUT — валидировать ratingNumber, description

### 3.3 Починить empty catch blocks

Заменить пустые catch на `logger.error(error, 'context')`:
- `src/components/shared/notification-bell.tsx:27`
- `src/app/(main)/messages-dev/page.tsx:183-184`
- `src/app/(main)/explore/[id]/page.tsx:126-128, 146`
- `src/hooks/use-unread-messages.ts:12-19`
- `src/components/profile/edit-profile-modal.tsx:226`

---

## Шаг 4: Исправление дефектов на фронтенде

### 4.1 Вынести `plural`/`pluralize` в `src/lib/utils.ts`

Функция дублирована в 4 файлах:
- `src/components/design/comments-modal.tsx:59`
- `src/components/design/masters-list-modal.tsx:332`
- `src/components/master/master-card.tsx:168`
- `src/app/(main)/search/page.tsx:891`

Создать одну функцию `pluralRu` в `src/lib/utils.ts`, импортировать во всех 4 файлах.

### 4.2 Убрать лишние `'use client'`

Файлы которые могут быть Server Components:
- `src/components/shared/user-avatar.tsx:1`
- `src/components/shared/polish-swatch.tsx:1`
- `src/components/shared/distance-badge.tsx:1`
- `src/app/(main)/client-info/page.tsx:1`

Проверить: если нет useState/useEffect/onClick/браузерных API → убрать `'use client'`.

### 4.3 Добавить aria-атрибуты модальным окнам

Добавить `role="dialog"`, `aria-modal="true"`, `aria-label`:
- `src/components/booking/booking-modal.tsx:210-214`
- `src/components/design/comments-modal.tsx:308-310`
- `src/components/design/design-details-modal.tsx:21`
- `src/components/review/review-modal.tsx:59`

### 4.4 Починить logger

`src/lib/logger.ts`:
- Читать `LOG_LEVEL` из process.env
- В production режиме выводить структурированный JSON (JSON.stringify обёртка)
- Добавить timestamp

### 4.5 Добавить недостающий плагин Tailwind

`tailwind.config.ts`: добавить `require('@tailwindcss/forms')` в массив plugins (уже установлен в package.json но не подключен).

---

## Шаг 5: Исправление дефектов БД (только схема Drizzle, не трогаем данные)

### 5.1 Добавить составные primary key

`src/db/schema/designs.ts:67-70` — `clientLikedDesigns`:
```ts
export const clientLikedDesigns = pgTable('client_liked_designs', {
  clientId: uuid('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nailDesignId: uuid('nail_design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.clientId, table.nailDesignId] }),
}));
```

`src/db/schema/comments.ts:23-26` — `commentLikes`:
```ts
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.commentId] }),
}));
```

### 5.2 Добавить FK constraints

`src/db/schema/messages.ts:18` — `replyToId`:
```ts
replyToId: uuid('reply_to_id').references((): AnyPgColumn => messages.id, { onDelete: 'set null' }),
```

`src/db/schema/comments.ts:12` — `parentCommentId`:
```ts
parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
```

### 5.3 Удалить deprecated колонку

`src/db/schema/messages.ts:16` — удалить `attachmentType` (помечена как deprecated).

### 5.4 Добавить `search_vector` в Drizzle схему

`src/db/schema/designs.ts` — добавить колонку:
```ts
searchVector: tsvector('search_vector'),
```
(нужен импорт `tsvector` из drizzle-orm/pg-core)

### 5.5 Починить mismatch дефолтов

`src/lib/validators.ts:46` → `type: z.enum(['basic', 'designer']).optional().default('basic')` 
(было `.default('designer')`, а в БД `default 'basic'`)

---

## Шаг 6: Обновление до Next.js 16

### 6.1 Установить новые версии

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add -D @types/react@latest @types/react-dom@latest
```

### 6.2 Удалить server.ts и обновить скрипты

`server.ts` уже удалён на шаге 1.1.

`package.json` scripts:
```json
"dev": "next dev --port 3000",
"build": "next build --webpack",
"start": "next start --port 3000",
```
(Флаг `--webpack` на build потому что на проекте может быть кастомный webpack-конфиг от плагинов)

### 6.3 Обновить `next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // serverActions выходит из experimental
  serverActions: {
    bodySizeLimit: '100mb',
  },
  // Включаем standalone для Docker
  output: 'standalone',
};

export default nextConfig;
```

Убрать `experimental.serverActions` (теперь на верхнем уровне), проверить точное имя поля в Next.js 16 документации.

### 6.4 Обновить ESLint

Удалить скрипт `"lint": "next lint"` (next lint удалён в v16).

Заменить на:
```json
"lint": "eslint .",
"lint:fix": "eslint --fix ."
```

`.eslintrc.json` → мигрировать на `eslint.config.mjs` (flat config). Минимальный вариант:
```js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import eslintConfigNext from 'eslint-config-next';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
```

### 6.5 Обновить Dockerfile

Заменить `CMD ["node", "server.js"]` на:
```dockerfile
CMD ["node", "node_modules/.bin/next", "start", "--port", "3000"]
```

Убрать строку `COPY --from=builder /app/server.ts ./server.ts`.

### 6.6 Проверить `revalidateTag`

```bash
grep -rn "revalidateTag" src/
```
Если используется — добавить второй аргумент (профиль cacheLife): `revalidateTag('posts', 'max')`.

### 6.7 Проверить `experimental.turbopack`

Если нигде не используется — ничего не делать. Если используется — перенести из `experimental.turbopack` на верхний уровень `turbopack`.

---

## Шаг 7: useMutation для write-операций

Создать мутации в соответствующих hook-файлах. Пример для лайка:

`src/hooks/api/use-designs.ts` — добавить:
```ts
export function useLikeMutation() {
  const queryClient = useQueryClient();
  const { getToken, ensureAuth } = useAuth();
  
  return useMutation({
    mutationFn: async (designId: string) => {
      const token = await ensureAuth();
      return apiPost(`/api/designs/${designId}/like`, undefined, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: designKeys.all });
    },
  });
}
```

Аналогично для:
- `useOrderMutation`, `useCancelOrder`, `useConfirmOrder` — в `use-orders.ts`
- `useCreateComment`, `useDeleteComment` — в `use-designs.ts`
- `useUpdateProfile` — в `use-profile.ts`
- `useCreateService`, `useUpdateService`, `useDeleteService` — в `use-masters.ts`
- `useBookSlot`, `useDeleteSlot` — в `use-masters.ts`
- `useCreateReview` — в `use-masters.ts`

---

## Шаг 8: Финализация

### 8.1 Проверить билд

```bash
pnpm typecheck
pnpm build
pnpm lint
```

### 8.2 Почистить samples/

`samples/` содержит 280 seed-изображений. Их не нужно коммитить.
Добавить `samples/` в `.gitignore` если ещё не там.

### 8.3 Обновить `.env.example`

Добавить недостающие переменные (см. существующий .env.example, добавить PORT, HOSTNAME).

Убрать неиспользуемые: `ENABLE_REQUEST_LOGGING`, `ENABLE_RESPONSE_LOGGING` (нигде не читаются в коде).

### 8.4 Убрать неиспользуемый `registerGuestSchema`

Уже удалён на шаге 1.2.

---

## Приоритет выполнения

```
Высокий (сразу):  Шаг 1 (мёртвый код) + Шаг 6 (Next.js 16)
                  └─ Билд должен проходить после этих двух

Средний (2-3 ч):  Шаг 2 (auth рефакторинг) 
                  Шаг 3 (try/catch + Zod в API)

Низкий (1-2 ч):   Шаг 4 (фронтенд) + Шаг 5 (DB схема)
                  Шаг 7 (useMutation)

Финал:            Шаг 8 (проверка билда, cleanup)
```

---

## ЧТО НЕ ТРОГАТЬ

Следующие вещи НЕ менять в рамках этого промпта (это продакшен-харденинг, не нужно для разработки):

- JWT-секреты (хардкод fallback) — ок для dev
- Redis пароль — ок для dev
- Refresh token rotation — ок для dev
- Rate-limit на всех эндпоинтах — ок для dev
- `remotePatterns: '**'` в next.config — ок для dev
- `public/uploads` — ок для dev
- Индексы в БД — на dev-объёмах не заметно
- `keys()` вместо `SCAN` в Redis — ок для dev
- Загрузка файлов (SVG, path traversal) — ок для dev
- LIKE-инъекция в поиске — ок для dev
- Хардкод credentials БД — ок для dev
