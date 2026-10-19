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
EXPOSE 4000
CMD ["pnpm", "--filter", "@jobflow/api", "dev"]

FROM source AS build
RUN pnpm turbo run build --filter @jobflow/api...
RUN pnpm --filter @jobflow/api --prod deploy /prod/api

FROM node:26.12.0-alpine3.24 AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
