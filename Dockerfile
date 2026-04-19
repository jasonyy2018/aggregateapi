# syntax=docker/dockerfile:1.7

# ---------- Base ----------
# Next.js 16 requires Node >= 20.9; 20-alpine is LTS and small.
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
# Enable pnpm via corepack (shipped with Node 20+). No global install needed.
RUN corepack enable
WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
# The prisma schema is needed because `postinstall` runs `prisma generate`.
COPY package.json pnpm-lock.yaml* .npmrc* ./
COPY prisma ./prisma
# Use a persistent pnpm store cache to speed up rebuilds.
# Falls back gracefully when no pnpm-lock.yaml is present (first run).
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

# Build Next.js in standalone mode (see next.config.ts)
RUN pnpm run build

# ---------- Runner (minimal prod image) ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
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

# Prisma engines required at runtime (copied in by standalone, but the schema is useful for migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy entrypoint and admin script
COPY --from=builder --chown=nextjs:nodejs /app/scripts/entrypoint.sh ./scripts/entrypoint.sh
COPY --from=builder --chown=nextjs:nodejs /app/scripts/ensure-admin.js ./scripts/ensure-admin.js
RUN chmod +x ./scripts/entrypoint.sh

# Install runtime-only dependencies needed by entrypoint scripts
RUN npm install --no-save pg bcryptjs prisma@6 2>/dev/null || true

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["sh", "./scripts/entrypoint.sh"]
