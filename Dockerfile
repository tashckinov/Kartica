FROM node:18-bullseye-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:./prisma/dev.db

RUN node prisma/seed.js

EXPOSE 3000

CMD ["node", "server/index.js"]
