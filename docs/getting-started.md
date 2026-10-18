# Початок роботи

Від клону до запущеного стеку на одному ноутбуці. Хмари, деплою і платних сервісів немає: усе працює локально в Docker Compose.

## Вимоги

- Git.
- Docker Desktop або Docker Engine з Compose v2 чи новішим (перевірено на v5.1.4). Версію покаже `docker compose version`.
- Щонайменше 6 ГБ пам'яті для Docker.
- Node.js 26, версія записана в `.nvmrc`. З nvm: `nvm install && nvm use` у корені репозиторію.
- pnpm 12.14.0, як у полі `packageManager` у `package.json`. Node 26 постачається без corepack, тому pnpm ставиться окремо: `npm install -g pnpm@12.14.0`.
- Вільні порти з таблиці нижче, насамперед 5432, 6379, 9000, 9001, 1025 і 8025.
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
5. `pnpm dev` піднімає Postgres, Redis, MinIO і Mailpit, чекає до 120 секунд, поки їхні healthcheck-и стануть healthy, і створює бакет `resumes`. Далі йдуть міграції і застосунки з hot reload через `turbo dev`.

Сьогодні застосунків і міграцій ще немає, тому після інфраструктури `pnpm dev` друкує два рядки і завершується з кодом 0:

```text
pnpm db:migrate is not available yet: it arrives with BE-02.
pnpm dev is not available yet: it arrives with BE-01,FE-01.
```

Так і має бути. Стан контейнерів покаже `docker compose ps`: у postgres, redis, minio і mailpit у колонці `STATUS` стоїть `healthy`.

## Усе в контейнерах

Для демо, E2E і рецензента весь стек запускається в контейнерах:

```bash
docker compose up -d
```

Зараз у compose є лише інфраструктура. Контейнери api, worker, web, analytics, documents і ai додадуть картки з таблиці портів. Моніторинг (Grafana, Jaeger та інші) вмикатиметься профілем: `docker compose --profile observability up -d`, коли з'являться картки OBS.

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
| api           | 4000                       | з'явиться в BE-01  |
| worker        | без порту                  | з'явиться в BE-11  |
| web (Next.js) | 3000                       | з'явиться в FE-01  |
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

| Команда                                     | Що робить                                             | Стан                                                        |
| ------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                                  | інфраструктура, міграції, усі застосунки з hot reload | інфраструктура працює, застосунки з'являться в BE-01, FE-01 |
| `pnpm infra:up`                             | лише контейнери інфраструктури і бакет `resumes`      | працює                                                      |
| `pnpm db:migrate`                           | застосувати міграції Prisma                           | з'явиться в BE-02                                           |
| `pnpm db:seed`                              | мінімальний seed: стадії, таксономія причин відмов    | з'явиться в BE-05                                           |
| `pnpm db:reset`                             | видалити, змігрувати і засіяти dev-базу               | з'явиться в BE-05                                           |
| `pnpm demo:seed`                            | демо-користувач з повним набором даних з дизайну      | з'явиться в FIN-01                                          |
| `pnpm test`                                 | усі unit-тести                                        | працює                                                      |
| `pnpm test:int`                             | інтеграційні тести на справжніх Postgres і Redis      | з'явиться в BE-01                                           |
| `pnpm test:e2e`                             | Playwright на стеку compose                           | з'явиться в QA-01                                           |
| `pnpm test:watch`                           | unit-тести в режимі спостереження                     | працює                                                      |
| `pnpm ci:local`                             | ті самі перевірки, що й CI, у тому ж порядку          | працює                                                      |
| `pnpm gen:keys`                             | ключі JWT у `.secrets/`                               | працює                                                      |
| `pnpm gen:vapid`                            | ключі VAPID для web push у `.env`                     | з'явиться в BE-36                                           |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | ESLint, перевірка типів, збірка всіх пакетів          | працює                                                      |
| `pnpm format`                               | Prettier по всьому репозиторію                        | працює                                                      |
| `docker compose logs -f api worker ai`      | стежити за логами                                     | з'явиться з контейнерами api, worker і ai                   |

Python-тести запускаються в теці сервісу: `uv run pytest`.

## Тестові акаунти

Поки що жодного акаунта немає. Демо-користувач `demo@jobflow.local` з'явиться в BE-05 через `pnpm db:seed`, а повна демо-історія відгуків у FIN-01 через `pnpm demo:seed`. Пароль буде записано тут разом з акаунтом.

## AI

За замовчуванням `AI_PROVIDER=fake`: ключ і модель не потрібні.

## Типові проблеми

**`is not available yet`.** Рядок `pnpm <команда> is not available yet: it arrives with <картка>.` означає, що функцію цієї команди ще не зроблено, а не що щось зламалось. Команда завершується з кодом 0, щоб не зупиняти `pnpm dev` і `pnpm ci:local`. Щойно картка додасть скрипт у свій пакет, та сама команда почне його запускати.

**Немає `.env`.** `pnpm dev` і `pnpm infra:up` зупиняються з повідомленням `No .env in the repository root: run cp .env.example .env first.` Виконайте `cp .env.example .env`.

**Порт уже зайнятий.** Порти зафіксовані в `infra/docker/compose.yml` і не змінюються, тому звільніть порт. `lsof -nP -iTCP:5432 -sTCP:LISTEN` покаже процес, що тримає порт (підставте свій номер), наприклад локальний Postgres: зупиніть його. Якщо це інший проєкт compose, `docker compose ls` покаже його назву, а `docker compose -p <назва> stop` зупинить.

**Контейнери перезапускаються по колу.** `docker compose ps` покаже, який сервіс unhealthy. Зазвичай це залежність, що не піднялась, або відсутня змінна: застосунок при старті друкує її назву.

**Hot reload не працює на Windows.** Тримайте репозиторій у файловій системі WSL2. `docker compose watch` і змінні `WATCHPACK_POLLING=true` та `CHOKIDAR_USEPOLLING=true` з'являться разом з контейнерами застосунків (BE-01, FE-01).

**Помилки Prisma client після pull.** З'явиться в BE-02: тоді виконайте `pnpm --filter @jobflow/api exec prisma generate` і перезапустіть api та worker.

**Немає бакета `resumes`.** Виконайте `docker compose up minio-init`.

**Docker не вистачає пам'яті.** Дайте Docker Desktop 6 ГБ або не вмикайте профіль `observability`.
