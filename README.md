# 🔥 LifeStreak

> «Стань человеком, которым всегда хотел быть.»

Telegram Mini App, превращающая жизнь пользователя в коллекцию красивых непрерывных серий (streaks). MVP отвечает на один вопрос: **вернутся ли пользователи завтра, чтобы не потерять серию?**

## Структура проекта

```
LifeStreak/
├── backend/          # NestJS + SQLite (libSQL) + Prisma
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── fly.toml
│   └── src/
│       ├── modules/  # auth, users, streaks, hearts, challenges, achievements,
│       │              # statistics, invites, notifications, health
│       ├── common/    # guards, interceptors, filters, decorators, utils
│       ├── config/
│       └── prisma/
├── frontend/         # React + TypeScript + Vite + Tailwind + shadcn/ui
│   └── src/
│       ├── components/  # ui, layout, streaks, hearts, challenges,
│       │                 # achievements, profile, share
│       ├── pages/        # Home, Achievements, Profile
│       ├── hooks/        # React Query хуки по фичам
│       ├── store/        # Zustand: auth, celebrations
│       └── lib/          # api client, telegram sdk wrapper, utils
├── docker-compose.yml
└── .env.example
```

## Быстрый старт (Docker)

```bash
cp .env.example .env      # заполните JWT_SECRET и TELEGRAM_BOT_TOKEN
docker compose up --build
```

- Backend API: http://localhost:3000/api/v1
- Frontend: http://localhost:5173

База — файл SQLite на именованном томе `sqlite_data`. При каждом старте
контейнер прогоняет `prisma migrate deploy` и сид каталогов (достижения и
шаблоны испытаний) — обе операции идемпотентны. Чтобы получить ещё и
демо-пользователя с примерами серий, поставьте `SEED_DEMO=true` в `.env`.

## Локальная разработка без Docker

Внешняя инфраструктура не нужна: база — обычный файл SQLite.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy   # создаст backend/prisma/dev.db
npm run prisma:seed         # SEED_DEMO=true в .env добавит демо-данные
npm run start:dev
```

Для локальной разработки без реального Telegram-бота оставьте
`TELEGRAM_SKIP_AUTH_VALIDATION=true` в `backend/.env` — фронтенд в браузере
(вне Telegram) будет логиниться демо-пользователем без проверки HMAC-подписи
`initData`. В продакшене эта переменная обязательно должна быть `false` —
при `NODE_ENV=production` бэкенд откажется стартовать, если она осталась
`true`, если пуст `TELEGRAM_BOT_TOKEN` или если `JWT_SECRET` короче 32
символов (см. `src/config/assert-production-config.ts`).

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Откройте http://localhost:5173 — приложение работает и в обычном браузере
(эмулируя Telegram initData), и как полноценный Telegram Mini App.

## Деплой

Схема: **бэкенд на Fly.io** (SQLite-файл на постоянном томе), **фронтенд на
Vercel**, Telegram Mini App смотрит на домен Vercel.

Шаги идут именно в этом порядке: адрес бэкенда нужен фронтенду при сборке, а
адрес фронтенда нужен бэкенду для CORS.

### 1. Бэкенд на Fly.io

```bash
cd backend
fly auth login
fly launch --no-deploy          # подтвердит имя приложения и регион из fly.toml
fly volumes create lifestreak_data --size 1 --region fra
```

Секреты (в репозиторий они не попадают):

```bash
fly secrets set \
  JWT_SECRET="$(openssl rand -base64 48)" \
  TELEGRAM_BOT_TOKEN="<токен от @BotFather>" \
  TELEGRAM_SKIP_AUTH_VALIDATION=false
```

```bash
fly deploy
fly scale count 1               # см. предупреждение ниже
fly logs                        # убедитесь, что миграции применились
curl https://<app>.fly.dev/api/v1/health
```

> **Одна машина, всегда.** База — файл SQLite на томе. Два инстанса не могут
> делить один том, а с разными томами вы получите две независимые базы и
> пользователей, случайно раскиданных между ними. Проверяйте `fly scale show`
> после каждого изменения конфигурации.

Миграции и сид каталогов выполняются при каждом старте контейнера (обе
операции идемпотентны), отдельная release-команда не нужна.

### 2. Фронтенд на Vercel

Импортируйте репозиторий в Vercel и укажите **Root Directory: `frontend`** —
остальное подхватится из `frontend/vercel.json`. Единственная переменная
окружения:

```
VITE_API_URL = https://<app>.fly.dev/api/v1
```

Vite подставляет её на этапе сборки, поэтому после изменения переменной нужен
повторный деплой, а не просто перезапуск.

### 3. Свяжите бэкенд с доменом фронтенда

```bash
cd backend
fly secrets set CORS_ORIGIN="https://<project>.vercel.app"
```

Несколько доменов перечисляются через запятую (например, прод и превью).
Без этого шага браузер заблокирует запросы Mini App к API.

### 4. Подключение к боту

У вас уже есть бот и токен, поэтому остаётся привязать к нему Mini App —
в [@BotFather](https://t.me/BotFather):

1. `/newapp` → выберите бота → укажите название, описание, иконку 640×360.
2. **Web App URL**: `https://<project>.vercel.app` — домен Vercel, не Fly.
3. `/setmenubutton` → выберите бота → тот же URL → задайте подпись кнопки
   (например, «Открыть журнал»), чтобы приложение открывалось из меню чата.

Проверка: откройте бота в Telegram, нажмите кнопку меню. Приложение должно
залогинить вас вашим Telegram-аккаунтом. Если вход не проходит, смотрите
`fly logs` — при неверной подписи `initData` бэкенд отвечает 401 с причиной.

> В обычном браузере продакшен-сборка входить **не будет**, и это правильно:
> `TELEGRAM_SKIP_AUTH_VALIDATION=false` включает проверку HMAC-подписи, а
> браузерный fallback подписи не имеет.

### Переменные окружения

| Переменная | Где | Назначение |
|---|---|---|
| `DATABASE_URL` | Fly (`fly.toml`) | `file:/data/lifestreak.db` — путь на томе |
| `JWT_SECRET` | Fly secret | подпись токенов, ≥32 символов |
| `TELEGRAM_BOT_TOKEN` | Fly secret | проверка подписи `initData` |
| `TELEGRAM_SKIP_AUTH_VALIDATION` | Fly secret | всегда `false` в проде |
| `CORS_ORIGIN` | Fly secret | домен(ы) фронтенда через запятую |
| `VITE_API_URL` | Vercel | адрес API, вшивается при сборке |
| `SEED_DEMO` | опционально | `true` — добавить демо-данные |

### Резервная копия базы

Том живёт отдельно от образа и переживает деплои, но не удаление тома:

```bash
fly ssh console -C "cp /data/lifestreak.db /data/backup.db"
fly sftp get /data/backup.db ./lifestreak-backup.db
```

Если позже понадобится реплика или несколько регионов — переключение на Turso
не требует изменений в коде: `PrismaService` уже работает через libSQL-адаптер,
достаточно задать `DATABASE_URL=libsql://<db>-<org>.turso.io` и
`TURSO_AUTH_TOKEN`.

## Игровая механика (кратко)

| Механика | Правило |
|---|---|
| Отметка дня | +20 XP, серия +1 день |
| Пропуск 1 дня | можно восстановить одним ❤️ (только последний пропуск) |
| Пропуск 2+ дней | серия сбрасывается до 1 |
| Серия кратна 7 | +1 ❤️ (максимум 5, старт — 3) |
| Испытание дня | случайное каждый день, +40 XP или ❤️ |
| Уровень | 500 XP на уровень, чисто визуальная награда |
| Приглашение друга | +1 ❤️ инвайтеру при принятии кода |
| Достижения | 7/30/100/365 дней, первое сердце, первое восстановление, без пропусков, коллекционер (5 серий), легенда (20 уровень) |

## API

Полный REST API под префиксом `/api/v1`, версионирование через
`VersioningType.URI`. Основные группы:

- `POST /auth/telegram` — вход по `initData`
- `GET/POST /streaks`, `POST /streaks/:id/checkin`, `POST /streaks/:id/recover`
- `GET /challenges/today`, `POST /challenges/:id/complete`
- `GET /achievements`, `GET /achievements/me`
- `GET /hearts`
- `GET /statistics/me`
- `GET /invites/me`, `POST /invites/accept`
- `GET /notifications`
- `GET /health` — проба для хостинга, единственный публичный роут кроме `/auth/telegram`

Все защищённые роуты требуют `Authorization: Bearer <JWT>`, полученный из
`/auth/telegram`. Ответы оборачиваются в `{ success, data }`; ошибки — в
`{ success: false, statusCode, message }`.

## Дизайн — «Журнал наблюдений»

Интерфейс устроен как лабораторный журнал, который пользователь ведёт на
себя: светлая бумага в клетку, поле с киноварной линией слева, записи,
отделённые линейками, вместо карточек-плашек.

**Палитра** (CSS-переменные в `frontend/src/index.css`):

| Токен | Значение | Роль |
|---|---|---|
| `--paper` | `70 12% 91%` | бумага — холодная серо-зелёная, не кремовая |
| `--ink` | `163 11% 12%` | чернила, основной текст и засечки ленты |
| `--graphite` | `80 5% 44%` | карандаш, вторичный текст |
| `--indigo` | `203 30% 26%` | активное состояние, каретка сегодняшнего дня |
| `--vermilion` | `7 64% 47%` | **только** разрывы серии и восстановление |
| `--ochre` | `38 59% 45%` | всё заработанное: сердца, достижения, штампы |

Дисциплина цвета: киноварь не используется как акцент — она означает
пропуск. Всё, что пользователь заработал, окрашено охрой. Цвета самих
серий — приглушённые пигменты (`STREAK_TEMPLATES` в бэкенде и `COLORS` в
`CreateStreakDialog`), они появляются один раз, на метке в поле.

**Типографика**: `PT Sans Narrow` (дисплей, капс с трекингом — кириллица от
ParaType), `IBM Plex Mono` (даты, счётчики, подписи полей), `IBM Plex Sans`
(проза). Все три подключены через `@fontsource` с кириллическими сабсетами.

**Сигнатурный элемент** — `RecordTape` (`components/streaks/RecordTape.tsx`):
серия как лента записи шириной в четыре недели, где форма кодирует правила
игры, а не украшает их — высокая засечка это день, принёсший сердце
(каждый 7-й), низкая — обычный записанный день, пунктирная мигающая ячейка —
сегодня, ещё не записанный, киноварная полоса — пропуск.

Анимация ограничена тремя местами: появление записей, «штамп» при отметке дня
и печать награды в `CelebrationOverlay`. `prefers-reduced-motion` отключает
всё это. Экспорт вырезки в PNG — через `html-to-image`.
