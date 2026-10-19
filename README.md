# JobFlow Tracker

Дипломний трекер пошуку роботи: канбан відгуків, збереження вакансій зі сторінки, AI-розбір тексту вакансії та аналітика воронки.

Як запустити проєкт з нуля: [docs/getting-started.md](docs/getting-started.md).

## Структура

```
apps/
  web/            Next.js 16 (App Router)
  api/            NestJS 12: точка входу src/main.ts, AppModule у src/app.module.ts, worker у src/worker.ts
  mobile/         Expo, необов'язковий етап
services/
  analytics/      FastAPI (Python 3.14, uv)
  ai/             FastAPI, AI-провайдери, порт 8001
  documents/      FastAPI, текст і сторінки резюме, порт 8002
packages/
  shared/         zod-схеми, типи, enum-и, машина стадій, пороги
  config/         спільні пресети tsconfig, eslint, prettier
bookmarklet/      код букмарклета і скрипт збірки
infra/
  docker/         Dockerfile-и, compose-файли, конфіги моніторингу
.github/
  workflows/      CI
docs/             ADR, дизайн, діаграми до диплому
```

## Вимоги

- Node.js 26, версія в `.nvmrc`
- pnpm 12, точна версія в полі `packageManager` у `package.json`. Node 26 постачається без corepack, тому pnpm треба встановити окремо.

## Команди

```bash
pnpm install
pnpm build
pnpm dev
pnpm lint
pnpm typecheck
pnpm format
```

## Локальна інфраструктура

Postgres, Redis, MinIO і Mailpit запускаються однією командою з кореня репозиторію:

```bash
cp .env.example .env
docker compose up -d
```

`COMPOSE_FILE` у `.env` вказує на `infra/docker/compose.yml` і `infra/docker/compose.override.yml`, тому `-f` не потрібен.

| Сервіс   | Порт                      |
| -------- | ------------------------- |
| Postgres | 127.0.0.1:5432            |
| Redis    | 127.0.0.1:6379            |
| MinIO    | 127.0.0.1:9000, 9001 (UI) |
| Mailpit  | 127.0.0.1:1025, 8025 (UI) |

Якщо бакета `resumes` немає, виконайте `docker compose up minio-init`.

## Змінні середовища

Усі змінні описано в `.env.example` у корені, з коментарем до кожної. Один кореневий `.env` читають compose, API, worker і analytics.

```bash
cp .env.example .env
pnpm gen:keys
```

- `pnpm gen:keys` створює пару ключів RS256 для JWT у `.secrets/`. Тека в `.gitignore`, ключі не комітяться. Повторний запуск не перезаписує наявні ключі.
- Значення в `.env.example` збігаються з локальним стеком compose, тому для розробки їх можна не змінювати.
- Необов'язкові змінні (`VAPID_*`, `SENTRY_DSN`, `MIXPANEL_TOKEN`, `TELEGRAM_BOT_TOKEN`) можна залишити порожніми: відповідна функція перейде в режим заглушки або вимкнеться.
- Ключі AI-вендорів і `AI_PROVIDER` живуть у `services/ai/.env` (AI-01). API про них не знає: йому потрібна лише адреса сервісу в `AI_SERVICE_URL`.
- Якщо обов'язкова змінна відсутня або має хибний формат, API виводить її назву і завершується з кодом 1.
- Змінні з префіксом `NEXT_PUBLIC_` потрапляють у браузер, тож секрети з таким префіксом не задаються.
