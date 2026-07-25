# 🔥 LifeStreak

> «Стань человеком, которым всегда хотел быть.»

Telegram Mini App, превращающая жизнь пользователя в коллекцию красивых непрерывных серий (streaks). MVP отвечает на один вопрос: **вернутся ли пользователи завтра, чтобы не потерять серию?**

## Структура проекта

```
LifeStreak/
├── api/              # точка входа Vercel Function (реэкспорт из backend/dist)
├── backend/          # NestJS + SQLite (libSQL/Turso) + Prisma
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── scripts/      # apply-schema.mjs — миграции для libsql://
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
├── vercel.json       # сборка и роутинг: /api/* → функция, остальное → SPA
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

Фронтенд и API живут **в одном проекте Vercel**, база — в **Turso**
(SQLite as a service). Ни один из сервисов не требует карты.

Так как фронт и API на одном домене, CORS не участвует вовсе, а
`VITE_API_URL` — относительный путь `/api/v1` (задан в `vercel.json`).

### Как это устроено

```
api/index.ts            → Vercel Function: реэкспорт скомпилированного Nest
backend/src/serverless.ts → тот же AppModule без listen(), с кэшем между вызовами
frontend/dist           → статика, отдаётся с того же домена
```

NestJS собирается обычным `tsc` (`nest build`) **до** упаковки функции: Vercel
собирает функции через esbuild, который не умеет `emitDecoratorMetadata`, и без
предварительной сборки DI бы развалилась.

### 1. База данных в Turso

Создайте аккаунт на [turso.tech](https://turso.tech) (вход через GitHub) и
базу. Понадобятся две вещи: **URL базы** (`libsql://<db>-<org>.turso.io`) и
**auth token**.

Примените схему и справочные данные — обе команды идемпотентны:

```bash
cd backend
DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:migrate
DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run prisma:seed
```

`db:migrate` (`scripts/apply-schema.mjs`) прогоняет `prisma/migrations/*` и
отмечает применённое в таблице `_schema_migrations`. Обычный
`prisma migrate deploy` здесь не подходит — он не работает с `libsql://`.

### 2. Проект на Vercel

Импортируйте репозиторий на [vercel.com/new](https://vercel.com/new).
**Root Directory оставьте корнем репозитория** — не `frontend`: сборка и
функции описаны в корневом `vercel.json`.

Переменные окружения (Settings → Environment Variables):

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | `libsql://<db>-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | токен из Turso |
| `JWT_SECRET` | случайная строка от 32 символов |
| `TELEGRAM_BOT_TOKEN` | токен от @BotFather |
| `TELEGRAM_SKIP_AUTH_VALIDATION` | `false` |

Проверка после деплоя:

```bash
curl https://<project>.vercel.app/api/v1/health
```

### 3. Подключение к боту

В [@BotFather](https://t.me/BotFather):

1. `/newapp` → выберите бота → название, описание, иконка 640×360.
2. **Web App URL**: `https://<project>.vercel.app`
3. `/setmenubutton` → тот же URL → подпись кнопки (например, «Открыть журнал»).

Откройте бота и нажмите кнопку меню — приложение должно залогинить вас вашим
Telegram-аккаунтом.

> В обычном браузере продакшен входить **не будет**, и это правильно:
> `TELEGRAM_SKIP_AUTH_VALIDATION=false` включает проверку HMAC-подписи, а у
> браузерного fallback подписи нет. Смотрите логи функции в Vercel, если вход
> не проходит.

### Холодный старт

Функция засыпает при простое, первый запрос после паузы поднимает Nest заново
(порядка 1–3 секунд), дальше ответы быстрые. Кэш Express-инстанса в
`serverless.ts` не даёт пересобирать приложение на каждый запрос.

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
