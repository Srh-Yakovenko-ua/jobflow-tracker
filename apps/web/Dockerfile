FROM node:26.12.0-alpine3.24 AS base
RUN npm i -g pnpm@12.14.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN HUSKY=0 pnpm install --frozen-lockfile --filter @jobflow/web...

FROM deps AS source
COPY turbo.json ./
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/web apps/web

FROM source AS dev
RUN pnpm --filter @jobflow/shared build
EXPOSE 3000
CMD ["pnpm", "--filter", "@jobflow/web", "exec", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

FROM source AS build
RUN pnpm turbo run build --filter @jobflow/web...

FROM node:26.12.0-alpine3.24 AS prod
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((res) => process.exit(res.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
