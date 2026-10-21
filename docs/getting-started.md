# Початок роботи

Від клону до запущеного стеку на одному ноутбуці. Хмари, деплою і платних сервісів немає: усе працює локально в Docker Compose.

## Вимоги

- Git.
- Docker Desktop або Docker Engine з Compose v2 чи новішим (перевірено на v5.1.4). Версію покаже `docker compose version`.
- Щонайменше 6 ГБ пам'яті для Docker.
- Node.js 26, версія записана в `.nvmrc`. З nvm: `nvm install && nvm use` у корені репозиторію.
- pnpm 12.14.0, як у полі `packageManager` у `package.json`. Node 26 постачається без corepack, тому pnpm ставиться окремо: `npm install -g pnpm@12.14.0`.
- Вільні порти з таблиці нижче, насамперед 5432, 6379, 9000, 9001, 1025, 8025, 4000 і 3000.
- uv знадобиться для Python-сервісів (`services/analytics`, `services/documents`, `services/ai`), коли вони з'являться.

## Кроки

```bash
git clone <url-репозиторію> jobflow-tracker
cd jobflow-tracker
nvm use
pnpm install --frozen-lockfile
cp .env.example .env
pnpm gen:keys
pnpm dev
```

1. `git clone` і `cd`: робоча копія репозиторію.
2. `pnpm install --frozen-lockfile` ставить залежності точно за `pnpm-lock.yaml` і вмикає git-хуки husky.
3. `cp .env.example .env` створює єдиний кореневий `.env`. Значення з `.env.example` підходять для локального стеку, міняти їх не треба. Змінна `COMPOSE_FILE` у ньому вказує compose на `infra/docker/`, тому `docker compose` працює з кореня без `-f`.
4. `pnpm gen:keys` створює пару ключів RS256 для JWT і друкує `JWT keys written to .secrets/jwt-private.pem and .secrets/jwt-public.pem.` Повторний запуск ключі не перезаписує, а друкує `JWT keys already exist in .secrets/, nothing to do.`
5. `pnpm dev` піднімає Postgres, Redis, MinIO і Mailpit, чекає до 120 секунд, поки їхні healthcheck-и стануть healthy, і створює бакет `resumes`. Далі йдуть міграції, а за ними api на порту 4000 і web на порту 3000, обидва з hot reload через `turbo dev`. Ctrl+C зупиняє застосунки, контейнери інфраструктури працюють далі.

Міграції запускає `pnpm db:migrate`, тобто `prisma migrate deploy` у `apps/api`. На порожній базі перший запуск застосовує всі міграції з `apps/api/prisma/migrations` і друкує серед іншого такі рядки:

```text
@jobflow/api:db:migrate: Datasource "db": PostgreSQL database "jobflow", schema "public" at "localhost:5432"
@jobflow/api:db:migrate: 1 migration found in prisma/migrations
@jobflow/api:db:migrate: Applying migration `20261019040525_add_users_auth_settings`
@jobflow/api:db:migrate: All migrations have been successfully applied.
```

Кожен наступний запуск друкує `No pending migrations to apply.` і нічого не змінює. Нових міграцій ця команда не створює і базу не скидає.

`pnpm dev` worker не запускає. Фонові задачі (черги BullMQ у Redis) виконує окремий процес worker: у другому терміналі поруч із `pnpm dev` виконайте `pnpm --filter @jobflow/api dev:worker`. Він теж перезбирається при змінах в `apps/api/src`, а свою збірку кладе в `apps/api/dist-worker`, тому не заважає api.

Api живий, якщо http://localhost:4000/api/v1/health відповідає `{"status":"ok"}`, і готовий, якщо http://localhost:4000/api/v1/ready відповідає `{"status":"ok","checks":{"redis":"up","postgres":"up"}}`. Стан контейнерів покаже `docker compose ps`: у postgres, redis, minio і mailpit у колонці `STATUS` стоїть `healthy`.

## Усе в контейнерах

Для демо, E2E і рецензента весь стек запускається в контейнерах:

```bash
docker compose up -d
```

Зараз у compose є інфраструктура, api, worker і web. Лише api і worker разом з Redis, від якого вони залежать:

```bash
docker compose up -d --build --wait api worker
```

Команда збирає образ api (ціль `dev`, `apps/api/src` змонтовано в контейнер) і повертає керування, коли healthcheck api стане `healthy`, а worker запуститься. Worker використовує той самий образ з іншою командою, порту не має і healthcheck-а теж, тому в `docker compose ps` у колонці `STATUS` у нього лише `Up`, без `(healthy)`. `--build` потрібен, щоб після pull образ підхопив нові залежності. Health відповідає на http://localhost:4000/api/v1/health. Контейнер api займає той самий порт 4000, що й `pnpm dev`, тому одночасно працює щось одне. Контейнери analytics, documents і ai додадуть картки з таблиці портів. Моніторинг (Grafana, Jaeger та інші) вмикатиметься профілем: `docker compose --profile observability up -d`, коли з'являться картки OBS.

Лише web:

```bash
docker compose up -d --build --wait web
```

Команда збирає образ web (ціль `dev`, `apps/web/src` змонтовано в контейнер, у ньому працює `next dev`) і повертає керування, коли healthcheck web стане `healthy`: http://localhost:3000/login відповідає 200. Від інших контейнерів web не залежить. Зміни в `apps/web/src` підхоплюються без перезбирання, а після змін у `package.json`, `next.config.ts` чи `packages/shared` потрібен `--build`. Контейнер web займає той самий порт 3000, що й `pnpm dev`, тому одночасно працює щось одне.

`docker compose stop worker` чекає, поки worker завершить задачі, що вже виконуються (до 60 секунд). Задача, яку перервало аварійне завершення worker, не губиться: після перезапуску worker бере її знову.

У режимі розробки (`NODE_ENV=development`, як у `.env.example`) api показує Bull Board на http://localhost:4000/admin/queues: черги `ai`, `notifications`, `push`, `domain-events`, `maintenance` і задачі в них. Панель лише для перегляду, видаляти чи перезапускати задачі з неї не можна. В інших режимах цієї адреси немає.

Зупинити стек:

```bash
docker compose stop
docker compose down
```

`stop` лише зупиняє контейнери, `down` ще й видаляє їх разом з мережею. Дані в іменованих томах залишаються в обох випадках.

Увага: `docker compose down -v` видаляє всі томи, тобто базу, Redis і файли MinIO. Повернути їх не вийде.

## Порти

Усі порти слухають лише 127.0.0.1.

| Сервіс        | Порт                       | Стан               |
| ------------- | -------------------------- | ------------------ |
| Postgres      | 5432                       | працює             |
| Redis         | 6379                       | працює             |
| MinIO         | 9000 (API), 9001 (консоль) | працює             |
| Mailpit       | 1025 (SMTP), 8025 (UI)     | працює             |
| api           | 4000                       | працює             |
| worker        | без порту                  | працює             |
| web (Next.js) | 3000                       | працює             |
| analytics     | 8000                       | з'явиться в AN-01  |
| ai            | 8001                       | з'явиться в AI-01  |
| documents     | 8002                       | з'явиться в AI-11  |
| Prometheus    | 9090                       | з'явиться в OBS-02 |
| Grafana       | 3001                       | з'явиться в OBS-02 |
| Loki          | 3100                       | з'явиться в OBS-01 |
| Alloy         | 12345, OTLP 4317 і 4318    | з'явиться в OBS-01 |
| Jaeger        | 16686                      | з'явиться в OBS-03 |
| GlitchTip     | 8003                       | з'явиться в OBS-04 |
| Uptime Kuma   | 3002                       | з'явиться в OBS-05 |

Сервіси моніторингу запускатимуться лише з профілем `observability`.

## Команди

| Команда                                     | Що робить                                                                                | Стан                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm dev`                                  | інфраструктура, міграції, усі застосунки з hot reload                                    | працює                                             |
| `pnpm infra:up`                             | лише контейнери інфраструктури і бакет `resumes`                                         | працює                                             |
| `pnpm db:migrate`                           | застосувати міграції Prisma (`prisma migrate deploy`)                                    | працює                                             |
| `pnpm db:seed`                              | причини відмов і демо-користувач `demo@jobflow.local`; повторний запуск нічого не дублює | працює, потрібен Postgres: `pnpm infra:up`         |
| `pnpm db:reset`                             | видалити всі дані dev-бази, змігрувати і засіяти                                         | працює, потрібен Postgres: `pnpm infra:up`         |
| `pnpm demo:seed`                            | демо-користувач з повним набором даних з дизайну                                         | з'явиться в FIN-01                                 |
| `pnpm test`                                 | усі unit-тести                                                                           | працює                                             |
| `pnpm test:int`                             | інтеграційні тести на справжніх Postgres і Redis                                         | працює, потрібні Postgres і Redis: `pnpm infra:up` |
| `pnpm test:e2e`                             | Playwright на стеку compose                                                              | з'явиться в QA-01                                  |
| `pnpm test:watch`                           | unit-тести в режимі спостереження                                                        | працює                                             |
| `pnpm ci:local`                             | ті самі перевірки, що й CI, у тому ж порядку                                             | працює                                             |
| `pnpm gen:keys`                             | ключі JWT у `.secrets/`                                                                  | працює                                             |
| `pnpm tokens:build`                         | згенерувати тему (CSS, Tailwind, Chart.js, RN) з `tokens.json`                           | працює                                             |
| `pnpm gen:vapid`                            | ключі VAPID для web push у `.env`                                                        | з'явиться в BE-36                                  |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | ESLint, перевірка типів, збірка всіх пакетів                                             | працює                                             |
| `pnpm format`                               | Prettier по всьому репозиторію                                                           | працює                                             |
| `docker compose logs -f api worker`         | стежити за логами api і worker (JSON, з `requestId`)                                     | працює, логи ai з'являться в AI-01                 |

Python-тести запускаються в теці сервісу: `uv run pytest`.

## Тестові акаунти

Демо-акаунт: `demo@jobflow.local`, пароль `jobflow-demo`. Його створюють `pnpm db:seed` і `pnpm db:reset`. Seed працює на вже змігрованій базі, тобто після `pnpm dev` або `pnpm db:migrate`. У нового акаунта налаштування за замовчуванням і порожній пошук «Мій пошук», відгуків немає. Якщо акаунт уже є, повторний `pnpm db:seed` його не чіпає, змінений пароль теж лишається.

Повна демо-історія відгуків з'явиться у FIN-01 через `pnpm demo:seed`.

## AI

AI-провайдера обирає `services/ai`, а не API. Ключі вендорів і `AI_PROVIDER` задаються в `services/ai/.env`, за замовчуванням там провайдер `fake`, якому ключ і модель не потрібні. Сервіс з'явиться в AI-01. API знає лише `AI_SERVICE_URL`, адресу сервісу (локально `http://localhost:8001`).

## Типові проблеми

**`is not available yet`.** Рядок `pnpm <команда> is not available yet: it arrives with <картка>.` означає, що функцію цієї команди ще не зроблено, а не що щось зламалось. Команда завершується з кодом 0, щоб не зупиняти `pnpm dev` і `pnpm ci:local`. Щойно картка додасть скрипт у свій пакет, та сама команда почне його запускати.

**Немає `.env`.** `pnpm dev` і `pnpm infra:up` зупиняються з повідомленням `No .env in the repository root: run cp .env.example .env first.` Виконайте `cp .env.example .env`.

**`Invalid environment` при старті api.** Api перевіряє змінні під час запуску і зупиняється, якщо якоїсь бракує, а кожну відсутню друкує рядком `→ at <НАЗВА>`. Зазвичай це старий `.env`, створений до картки, що додала змінну: допишіть відсутні рядки з `.env.example`.

**Порт уже зайнятий.** Порти зафіксовані в `infra/docker/compose.yml` і не змінюються, тому звільніть порт. Якщо зайнятий 3000 або 4000, `pnpm dev` друкує `EADDRINUSE` і зупиняє обидва застосунки. `lsof -nP -iTCP:5432 -sTCP:LISTEN` покаже процес, що тримає порт (підставте свій номер), наприклад локальний Postgres: зупиніть його. Якщо це інший проєкт compose, `docker compose ls` покаже його назву, а `docker compose -p <назва> stop` зупинить.

**Контейнери перезапускаються по колу.** `docker compose ps` покаже, який сервіс unhealthy. Зазвичай це залежність, що не піднялась, або відсутня змінна: застосунок при старті друкує її назву.

**Hot reload не працює на Windows.** Тримайте репозиторій у файловій системі WSL2. Контейнери api і worker монтують `apps/api/src` і перезапускаються через `nest start --watch`. Контейнер web монтує `apps/web/src`, і `next dev` у ньому перезавантажує сторінку після змін. Змінних для polling compose не задає.

**Помилки Prisma client після pull.** Клієнт Prisma генерується в `apps/api/src/generated/prisma` і в git не потрапляє. `pnpm install` створює його сам, а після зміни схеми без нового install виконайте `pnpm --filter @jobflow/api exec prisma generate` і перезапустіть api та worker. Якщо api пише про відсутню таблицю, запустіть `pnpm db:migrate`.

**Немає бакета `resumes`.** Виконайте `docker compose up minio-init`.

**Docker не вистачає пам'яті.** Дайте Docker Desktop 6 ГБ або не вмикайте профіль `observability`.
