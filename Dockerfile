# Optimized Dockerfile for single-user deployment
FROM node:20-alpine AS base
RUN corepack enable pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
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

# Build packages
ENV TURBO_TELEMETRY_DISABLED=1
RUN pnpm build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

WORKDIR /app/apps/web
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["pnpm", "start"]
