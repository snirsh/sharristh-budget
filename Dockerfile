# Optimized Dockerfile for single-user deployment
FROM node:20-alpine AS base
RUN corepack enable pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
# Copy prisma schema for postinstall script (prisma generate)
COPY packages/db/prisma packages/db/prisma/
COPY packages/api/package.json packages/api/
COPY packages/domain/package.json packages/domain/
COPY packages/scraper/package.json packages/scraper/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN cd packages/db && pnpm prisma generate

# Build packages (only web app, not mobile)
ENV TURBO_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=@sfam/web...

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone build (includes all dependencies)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static files and public assets
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
