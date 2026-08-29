# Деплой NailMasters на VPS

Скрипт `deploy.sh` разворачивает приложение на чистом сервере Ubuntu 22.04/24.04:
Node.js 22, PostgreSQL, Redis, Nginx + Let's Encrypt, PM2, ежедневные бэкапы.
Почта (SMTP/Stalwart) не настраивается.

## Требования

- VPS на Ubuntu 22.04 или 24.04, минимум 1 CPU / 2 GB RAM (рекомендуется 2/4)
- Доступ по SSH от root
- Домен (и `www`) с A-записями — **только если** настраиваете Nginx/SSL

## Первый запуск

### Тест без домена (без Nginx и SSL)

Скрипт можно запустить вообще без аргументов — приложение поднимется на
`http://<IP-сервера>:3000`:

```bash
sudo bash deploy/deploy.sh
# с тестовыми данными:
SEED=1 sudo bash deploy/deploy.sh
```

Nginx и сертификат в этом случае не настраиваются. Домен можно добавить
позже — повторным запуском (см. ниже), `.env` и база сохранятся.

### С доменом и SSL

```bash
# подключитесь к серверу от root
sudo bash deploy/deploy.sh ваш-домен.ru admin@ваш-домен.ru
# e.g.
sudo bash deploy/deploy.sh nailmasters.ru admin@nailmasters.ru
```

Второй аргумент (email) нужен для сертификата Let's Encrypt.

Скрипт сам:
1. ставит пакеты (nginx, postgresql, redis, certbot, node 22, pm2, pnpm);
2. создаёт пользователя `deploy` и каталог `/opt/nailmasters`;
3. клонирует репозиторий (ветка `refactor/v3`, переопределяется через `BRANCH`);
4. создаёт `.env` со сгенерированными секретами (JWT, пароль БД) — **выводит
   `ADMIN_REGISTRATION_SECRET` в консоль**: он нужен для первой регистрации
   администратора в приложении;
5. создаёт роль и базу PostgreSQL, применяет схему (`drizzle-kit push`) и
   tsvector-поиск;
6. собирает production-сборку (Next.js standalone) и запускает под PM2;
7. настраивает Nginx и выпускает SSL-сертификат (если передан домен);
8. ставит ежедневный бэкап в cron (03:00).

### Тестовые данные (опционально)

По умолчанию база создаётся пустой. Чтобы заполнить её тестовыми
аккаунтами/дизайнами при первом деплое:

```bash
SEED=1 sudo bash deploy/deploy.sh ваш-домен.ru admin@ваш-домен.ru
```

Повторный запуск с `SEED=1` на непустой базе сид пропустит.

## Обновление из репозитория

```bash
cd /opt/nailmasters && git pull  # локально — просто сделайте push в main
# на сервере:
sudo bash /opt/nailmasters/deploy/deploy.sh
```

Скрипт подтянет изменения из `origin/refactor/v3`, переустановит зависимости,
применит изменения схемы, пересоберёт standalone и перезапустит PM2.
`.env`, база и загруженные файлы при этом сохраняются.

Деплой другой ветки (например, стабильной): `BRANCH=main sudo bash /opt/nailmasters/deploy/deploy.sh`

Если тестовый деплой был запущен без домена, домен и SSL добавляются тем же
скриптом (повторный запуск не трогает `.env` и базу):

```bash
sudo bash /opt/nailmasters/deploy/deploy.sh ваш-домен.ru admin@ваш-домен.ru
```

## Полезные команды

```bash
sudo -u deploy -H pm2 status                # статус приложения
sudo -u deploy -H pm2 logs nailmasters      # логи
sudo -u deploy -H pm2 restart nailmasters   # перезапуск
sudo -u postgres psql -d nailmasters        # доступ к БД
redis-cli ping                              # проверка Redis
ls /var/backups/nailmasters                 # бэкапы (БД + загрузки)
```

## Куда что кладётся

| Что | Где |
|-----|-----|
| Код | `/opt/nailmasters` |
| `.env` | `/opt/nailmasters/.env` (создаётся один раз) |
| Загруженные файлы | `/opt/nailmasters/public/uploads` (переживают обновления) |
| Бэкапы | `/var/backups/nailmasters` (БД — gzip-дамп, загрузки — tar.gz; хранятся 14 дней) |
| Лог бэкапов | `/var/log/nailmasters-backup.log` |

## Файрвол

Если включён ufw, откройте порты:

```bash
ufw allow 80,443/tcp   # при работе через домен
ufw allow 3000/tcp     # тест без домена (доступ по IP)
```

## SMS (Twilio)

Приложение умеет отправлять коды входа по SMS. По умолчанию (без настройки)
код входа всегда `000000` — так работать в проде нельзя. Чтобы включить Twilio,
отредактируйте `/opt/nailmasters/.env` и раскомментируйте:

```env
SMS_ENABLED="true"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+15551234567"
```

Затем: `sudo -u deploy -H pm2 restart nailmasters`

## Ручное восстановление из бэкапа

```bash
gunzip -c /var/backups/nailmasters/db/nailmasters_*.sql.gz | \
  sudo -u postgres psql -d nailmasters
tar -xzf /var/backups/nailmasters/uploads/uploads_*.tar.gz -C /opt/nailmasters
```
