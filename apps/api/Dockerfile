FROM node:26.12.0-alpine3.24 AS base
RUN npm i -g pnpm@12.14.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN HUSKY=0 pnpm install --frozen-lockfile --filter @jobflow/api...

FROM deps AS source
COPY turbo.json ./
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api

FROM source AS dev
RUN pnpm --filter @jobflow/shared build
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "node_modules/@nestjs/cli/bin/nest.js", "start", "--watch"]

FROM source AS build
RUN pnpm turbo run build --filter @jobflow/api...
RUN pnpm --filter @jobflow/api --prod deploy /prod/api

FROM node:26.12.0-alpine3.24 AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/v1/health').then((res) => process.exit(res.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
