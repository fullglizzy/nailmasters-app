#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Деплой NailMasters на VPS (Ubuntu 22.04/24.04)
#
# Первый запуск (от root):
#   sudo bash deploy/deploy.sh ваш-домен.ru [email-для-сертификата]
#   e.g.  sudo bash deploy/deploy.sh nailmasters.ru admin@nailmasters.ru
#
# Первичный тест БЕЗ домена (Nginx/SSL не настраиваются, приложение
# доступно по http://<IP-сервера>:3000):
#   sudo bash deploy/deploy.sh
#
# Обновление из репозитория (тот же скрипт, от root):
#   sudo bash deploy/deploy.sh
#
# Переменные окружения (опционально):
#   REPO_URL — адрес репозитория (по умолчанию fullglizzy/nailmasters-app)
#   BRANCH   — ветка для деплоя (по умолчанию main; для текущей разработки
#              можно передать BRANCH=refactor/v3)
#   SEED     — SEED=1 — заполнить БД тестовыми данными при первом деплое
#              (по умолчанию 0 — база создаётся пустой)
#
# Примечания:
#   • При указании домена требуются A-записи (и www) на этот сервер.
#   • Домен и SSL можно добавить позже: повторно запустите скрипт с доменом.
#   • Загруженные файлы хранятся в $APP_DIR/public/uploads (вне standalone,
#     переживают обновления; git-игнорируются).
#   • SMS через Twilio — опционально: раскомментируйте блок SMS_ENABLED/
#     TWILIO_* в .env на сервере. Без него код входа всегда 000000.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-}"
CERTBOT_EMAIL="${2:-}"
REPO_URL="${REPO_URL:-https://github.com/fullglizzy/nailmasters-app.git}"
BRANCH="${BRANCH:-main}"
SEED="${SEED:-0}"
APP_DIR="/opt/nailmasters"
BACKUP_DIR="/var/backups/nailmasters"
LOG_DIR="/var/log/nailmasters"
RUN_USER="deploy"
APP_PORT=3000
DB_USER="nailmasters"
DB_NAME="nailmasters"

if [ "$(id -u)" != "0" ]; then
  echo "Ошибка: запустите от root (sudo bash deploy/deploy.sh ...)" >&2
  exit 1
fi

# ── 1. Пакеты: Node 22, Nginx, PostgreSQL, Redis, certbot, pm2 ──────────────
echo "==> Установка системных пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git nginx postgresql postgresql-client redis-server certbot python3-certbot-nginx ca-certificates curl gnupg

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  echo "==> Установка Node.js 22 LTS"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
npm i -g pm2 pnpm >/dev/null 2>&1 || true

echo "==> Запуск PostgreSQL и Redis"
systemctl enable --now postgresql redis-server

# ── 2. Пользователь deploy и структура каталогов ─────────────────────────────
echo "==> Пользователь $RUN_USER и каталоги"
id -u "$RUN_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$RUN_USER"
mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
chown -R "$RUN_USER:$RUN_USER" "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
# PM2-демон пишет в $HOME/.pm2 — каталог обязан принадлежать deploy
mkdir -p "/home/$RUN_USER/.pm2"
chown -R "$RUN_USER:$RUN_USER" "/home/$RUN_USER/.pm2"

# Все команды под deploy стартуют из / — иначе PM2-демон наследует cwd
# вызывающего (например /root), в который deploy зайти не может (EACCES)
run_as() { sudo -u "$RUN_USER" -H bash -c "cd / && $*"; }

# ── 3. Код: clone (первый раз) или pull (обновление) ────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> Клонирование $BRANCH"
  run_as "cd $APP_DIR && git clone --branch $BRANCH --single-branch $REPO_URL ."
else
  echo "==> Обновление кода ($BRANCH)"
  run_as "cd $APP_DIR && git fetch origin $BRANCH && git checkout $BRANCH && git reset --hard origin/$BRANCH"
fi

echo "==> Установка зависимостей (pnpm)"
run_as "cd $APP_DIR && pnpm install --frozen-lockfile"

# ── 4. .env (создаётся один раз) ─────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  if [ -z "$DOMAIN" ]; then
    echo "==> Внимание: домен не указан — Nginx/SSL не будут настроены;"
    echo "    доступ по http://<IP-сервера>:$APP_PORT"
  fi
  echo "==> Создание .env"
  # hex-пароль — безопасен в URL postgres://
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -hex 32)"
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
  ADMIN_SECRET="$(openssl rand -hex 16)"
  cat > "$APP_DIR/.env" <<EOF
# База данных PostgreSQL
DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
JWT_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Секрет для регистрации первого администратора
ADMIN_REGISTRATION_SECRET="$ADMIN_SECRET"

# Приложение
NODE_ENV="production"
LOG_LEVEL="info"

# Загрузка файлов (каталог относительный — относительно cwd процесса,
# поэтому задаётся симлинком public/uploads в standalone, не менять!)
# MAX_IMAGE_SIZE_MB="10"
# MAX_VIDEO_SIZE_MB="100"
# MAX_AVATAR_SIZE_MB="5"

# SMS (Twilio — опционально). Без этого кода входа всегда 000000.
# SMS_ENABLED="true"
# TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# TWILIO_AUTH_TOKEN="your_auth_token"
# TWILIO_PHONE_NUMBER="+15551234567"
EOF
  chown "$RUN_USER:$RUN_USER" "$APP_DIR/.env"
  echo "    ADMIN_REGISTRATION_SECRET (для первой регистрации админа): $ADMIN_SECRET"
  echo "    Пароль БД $DB_USER (из .env на сервере): $DB_PASSWORD"
else
  echo "==> .env уже существует — пропуск"
fi

# ── 5. База данных: роль, БД, схема, поиск, сид (только при первом деплое) ──
DB_PASSWORD="$(grep '^DATABASE_URL=' "$APP_DIR/.env" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#' | tr -d '"')"

echo "==> Роль и БД PostgreSQL"
psql_postgres() { sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc "$1"; }
if [ "$(psql_postgres "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" != "1" ]; then
  psql_postgres "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';"
  echo "    Роль $DB_USER создана"
else
  echo "    Роль $DB_USER уже существует — пароль НЕ обновляется"
fi
if [ "$(psql_postgres "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" != "1" ]; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  echo "    БД $DB_NAME создана"
else
  echo "    БД $DB_NAME уже существует"
fi

echo "==> Схема и поиск (drizzle-kit push + tsvector)"
# push --force — не спрашивать подтверждения при деструктивных изменениях
run_as "cd $APP_DIR && set -a && . ./.env && set +a && pnpm exec drizzle-kit push --force && node --env-file=.env --import tsx/esm src/db/migrate-search.ts"

FIRST_DEPLOY="no"
if [ "$SEED" = "1" ]; then
  DB_HAS_DATA="$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT 1 FROM users LIMIT 1" 2>/dev/null || true)"
  if [ "$DB_HAS_DATA" != "1" ]; then
    echo "==> Первичное наполнение (seed)"
    run_as "cd $APP_DIR && set -a && . ./.env && set +a && pnpm db:seed"
    FIRST_DEPLOY="yes"
  else
    echo "==> База не пустая — сид пропущен (SEED=1 только для пустой БД)"
  fi
else
  echo "==> Сид пропущен (передайте SEED=1 при первом деплое, чтобы заполнить тестовыми данными)"
fi

# ── 6. Прод-сборка (standalone) ──────────────────────────────────────────────
echo "==> next build (standalone)"
run_as "cd $APP_DIR && NEXT_TELEMETRY_DISABLED=1 pnpm build"

# ── 7. Standalone: .env, симлинк на постоянные загрузки ─────────────────────
echo "==> Подготовка standalone"
STANDALONE="$APP_DIR/.next/standalone"
run_as "cd $APP_DIR && \
  mkdir -p public/uploads/avatars public/uploads/designs public/uploads/videos public/uploads/sterilization public/uploads/messages && \
  cp .env $STANDALONE/.env && \
  rm -rf $STANDALONE/public/uploads && \
  ln -sfn $APP_DIR/public/uploads $STANDALONE/public/uploads"

# ── 8. PM2 (перезапуск или первый старт) ─────────────────────────────────────
echo "==> PM2"
if sudo -u "$RUN_USER" -H pm2 describe nailmasters >/dev/null 2>&1; then
  sudo -u "$RUN_USER" -H pm2 restart nailmasters --update-env
else
  # Entry-файл standalone: server.js (Next ≤15/16), server.mjs — запасной вариант
  SERVER_ENTRY="server.js"
  [ -f "$STANDALONE/server.js" ] || SERVER_ENTRY="server.mjs"
  # --cwd обязателен: process.cwd() используется для public/uploads
  # Без единицы измерения (голое число) PM2 трактует лимит как БАЙТЫ и
  # рестартует процесс каждые 30 с — единица обязательна: 1500M
  sudo -u "$RUN_USER" -H pm2 start "$STANDALONE/$SERVER_ENTRY" --name nailmasters --cwd "$APP_DIR" --max-memory-restart 1500M
  sudo -u "$RUN_USER" -H pm2 save
  # unit автозапуска создаётся от root, но с -u deploy — daemon остаётся у deploy
  pm2 startup systemd -u "$RUN_USER" --hp "/home/$RUN_USER" >/dev/null 2>&1 || true
fi

echo "==> Проверка health (http://127.0.0.1:$APP_PORT)"
for _ in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:$APP_PORT" >/dev/null 2>&1; then
    echo "    Приложение отвечает"
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:$APP_PORT" >/dev/null 2>&1 || \
  echo "Внимание: приложение не ответило — смотрите: sudo -u $RUN_USER -H pm2 logs nailmasters"

# ── 9. Nginx + SSL ───────────────────────────────────────────────────────────
# Только при первом запуске: certbot --nginx дописывает в конфиг SSL-блок,
# перегенерация из шаблона на повторных запусках затирала бы его.
if [ -n "$DOMAIN" ] && [ ! -f /etc/nginx/sites-available/nailmasters ]; then
  echo "==> Nginx: $DOMAIN"
  sed "s/%DOMAIN%/$DOMAIN/g; s/%PORT%/$APP_PORT/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/nailmasters
  ln -sfn /etc/nginx/sites-available/nailmasters /etc/nginx/sites-enabled/nailmasters
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

  if [ -n "$CERTBOT_EMAIL" ] && [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "==> Let's Encrypt"
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$CERTBOT_EMAIL" --agree-tos --non-interactive --redirect || \
      echo "Внимание: certbot не завершился — запустите вручную: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  fi
else
  if [ -z "$DOMAIN" ]; then
    echo "==> Nginx пропущен (домен не указан) — приложение на http://<IP-сервера>:$APP_PORT"
  else
    echo "==> Nginx уже настроен — пропуск"
  fi
fi

# ── 10. Бэкапы по cron (устанавливаются один раз) ────────────────────────────
# Бит исполняемости не сохраняется при коммитах с Windows — ставим явно
chmod +x "$APP_DIR/deploy/backup.sh" "$APP_DIR/deploy/deploy.sh"
if ! crontab -l 2>/dev/null | grep -q "nailmasters"; then
  echo "==> Cron-бэкапы"
  ( crontab -l 2>/dev/null; cat "$APP_DIR/deploy/backup.cron" ) | crontab -
fi

echo ""
if [ -n "$DOMAIN" ]; then
  echo "✅ Готово: https://$DOMAIN"
else
  echo "✅ Готово (тестовый режим без домена): http://<IP-сервера>:$APP_PORT"
  echo "   Добавить домен и SSL: sudo bash $APP_DIR/deploy/deploy.sh ваш-домен.ru [email]"
fi
echo "   Логи:       sudo -u $RUN_USER -H pm2 logs nailmasters"
echo "   Статус:     sudo -u $RUN_USER -H pm2 status"
echo "   .env:       $APP_DIR/.env"
echo "   Загрузки:   $APP_DIR/public/uploads"
echo "   Бэкапы:     $BACKUP_DIR (cron ежедневно 03:00)"
echo "   Обновление: sudo bash $APP_DIR/deploy/deploy.sh"
[ "$FIRST_DEPLOY" = "yes" ] && echo "   Тестовые аккаунты сида: README.md (код SMS — 000000)"
