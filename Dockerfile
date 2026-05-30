# syntax=docker/dockerfile:1.7

# =============================================================================
# Helm — Application Image
# =============================================================================
# Minimal, multi-stage Dockerfile for the local-demo path
#   `git clone && docker compose up && open http://localhost:3000`
#
# This image is NOT a production image. It runs `next dev`-equivalent flow on
# top of `next start` against a local MySQL service. Production deployments
# should layer on top of release readiness correction §一 #3 (Aliyun cn-hangzhou)
# and the dedicated production Dockerfile (out of scope for v0.1.0-trial).
# =============================================================================

# ---------- deps ----------
FROM node:22-slim AS deps
WORKDIR /app

# Install OpenSSL — Prisma client requires it at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` runs `postinstall` which calls `prisma generate`.
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip lint/typecheck during image build to keep the demo path fast.
# Local quality chain (`npm run typecheck && npm run lint && npm run test`)
# remains the canonical correctness gate.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate \
 && npm run build

# ---------- runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]

# Run migrations + seed on first boot, then start.
# `db:migrate` is idempotent; `db:seed` is gated by Prisma seed semantics.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run start"]
