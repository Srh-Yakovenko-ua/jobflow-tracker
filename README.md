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
```
