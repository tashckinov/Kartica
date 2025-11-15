# syntax=docker/dockerfile:1.6

FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=development \
    DATABASE_URL="file:/app/api/prisma/dev.db" \
    VITE_API_BASE_URL="/api"

# Install root and API dependencies separately for better caching
COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json ./api/
RUN npm ci && npm ci --prefix api

# Copy project sources
COPY . .

# Generate Prisma client ahead of time so the API can start immediately
RUN npm --prefix api run prisma:generate

# Expose the development ports for Vite and the API server
EXPOSE 5173 4000

# Ensure the SQLite database file is stored outside the container when a volume is mounted
VOLUME ["/app/api/prisma"]

CMD ["npm", "run", "dev"]
