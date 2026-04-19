# syntax=docker/dockerfile:1.7

# ---------- Base ----------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml* .npmrc* ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      echo "WARNING: pnpm-lock.yaml not found, running unlocked install" && \
      pnpm install --no-frozen-lockfile; \
    fi

# ---------- Builder ----------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (schema-aware)
RUN pnpm exec prisma generate

# Build Next.js in standalone mode
RUN pnpm run build

# ---------- Runner (minimal prod image) ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
# Enable corepack to use pnpm in the runner stage
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prepare .next dir for cache writes
RUN mkdir .next && chown nextjs:nodejs .next

# Standalone output bundles exactly what's needed to run
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema and config (needed for db push at startup)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./prisma.config.js

# Copy entrypoint and admin scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/entrypoint.sh ./scripts/entrypoint.sh
COPY --from=builder --chown=nextjs:nodejs /app/scripts/ensure-admin.js ./scripts/ensure-admin.js
RUN chmod +x ./scripts/entrypoint.sh

# Use pnpm instead of npm to avoid "isDescendantOf" bugs and stay consistent with the project
# We install these specifically in the runner for the entrypoint automation tasks
RUN pnpm add pg bcryptjs prisma@7 --ignore-scripts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["sh", "./scripts/entrypoint.sh"]
