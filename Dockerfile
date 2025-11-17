# syntax=docker/dockerfile:1.6

FROM node:20-slim AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV DATABASE_URL="file:/app/api/prisma/dev.db" \
    VITE_API_BASE_URL="/api" \
    PORT=4000 \
    SERVE_CLIENT="true" \
    ADMIN_TOKEN_SECRET="please-change-me" \
    ADMIN_ALLOWED_ORIGINS="" \
    ADMIN_ALLOWED_ORIGIN="" \
    ADMIN_TELEGRAM_BOT_TOKEN="" \
    ADMIN_TELEGRAM_MINIAPP_URL="" \
    ADMIN_TELEGRAM_BOT_API_BASE_URL="https://api.telegram.org" \
    ADMIN_TELEGRAM_BOT_USE_TEST_ENV="false" \
    TELEGRAM_MINIAPP_URL="" \
    TELEGRAM_BOT_API_BASE_URL="" \
    TELEGRAM_BOT_USE_TEST_ENV="false"

COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json ./api/
COPY api/prisma ./api/prisma

RUN npm ci \
 && npm ci --prefix api

COPY . .

RUN npm --prefix api run prisma:generate \
 && npm --prefix api run prisma:deploy \
 && npm --prefix api run seed
RUN npm run build
ENV NODE_ENV=production
RUN npm --prefix api prune --omit=dev

FROM node:20-slim AS runner

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_URL="file:/app/api/prisma/dev.db" \
    VITE_API_BASE_URL="/api" \
    PORT=4000 \
    SERVE_CLIENT="true" \
    ADMIN_TOKEN_SECRET="please-change-me" \
    ADMIN_ALLOWED_ORIGINS="" \
    ADMIN_ALLOWED_ORIGIN="" \
    ADMIN_TELEGRAM_BOT_TOKEN="" \
    ADMIN_TELEGRAM_MINIAPP_URL="" \
    ADMIN_TELEGRAM_BOT_API_BASE_URL="https://api.telegram.org" \
    ADMIN_TELEGRAM_BOT_USE_TEST_ENV="false" \
    TELEGRAM_MINIAPP_URL="" \
    TELEGRAM_BOT_API_BASE_URL="" \
    TELEGRAM_BOT_USE_TEST_ENV="false"

COPY --from=build /app/api/package.json ./api/package.json
COPY --from=build /app/api/package-lock.json ./api/package-lock.json
COPY --from=build /app/api/node_modules ./api/node_modules
COPY --from=build /app/api/prisma ./api/prisma
COPY --from=build /app/api/src ./api/src
COPY --from=build /app/api/bot.js ./api/bot.js
COPY --from=build /app/dist ./dist

EXPOSE 4000

VOLUME ["/app/api/prisma"]

WORKDIR /app/api

CMD ["npm", "run", "start"]
