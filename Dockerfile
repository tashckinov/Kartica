# syntax=docker/dockerfile:1.6

FROM node:20-slim AS build

WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_URL="file:/app/api/prisma/dev.db" \
    VITE_API_BASE_URL="/api"

COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json ./api/

RUN npm ci \
 && npm ci --prefix api

COPY . .

RUN npm --prefix api run prisma:generate \
 && npm --prefix api run prisma:deploy \
 && npm --prefix api run seed
RUN npm run build
RUN npm --prefix api prune --omit=dev

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_URL="file:/app/api/prisma/dev.db" \
    PORT=4000 \
    VITE_API_BASE_URL="/api"

COPY --from=build /app/api/package.json ./api/package.json
COPY --from=build /app/api/package-lock.json ./api/package-lock.json
COPY --from=build /app/api/node_modules ./api/node_modules
COPY --from=build /app/api/prisma ./api/prisma
COPY --from=build /app/api/src ./api/src
COPY --from=build /app/dist ./dist

EXPOSE 4000

VOLUME ["/app/api/prisma"]

WORKDIR /app/api

CMD ["npm", "run", "start"]
