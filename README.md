# JobFlow Tracker

Дипломний трекер пошуку роботи: канбан відгуків, збереження вакансій зі сторінки, AI-розбір тексту вакансії та аналітика воронки.

## Структура

```
apps/
  web/            Next.js 16 (App Router)
  api/            Express API, точка входу src/server.ts; worker у src/worker.ts
  mobile/         Expo, необов'язковий етап
services/
  analytics/      FastAPI (Python 3.14, uv)
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
