# Stage 1: Install dependencies and prepare application
FROM node:22-alpine AS builder

WORKDIR /app

# Install git for prepare scripts
RUN apk add --no-cache git

# Bypass minimum release age policy inside Docker build
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Enable Corepack and activate the pnpm version pinned in package.json's
# `packageManager` field. This runs after the COPY so the version has a single
# source of truth; `pnpm@latest` would silently drift off the pinned version
# the lockfile was resolved with.
RUN corepack enable && corepack prepare --activate

# Copy shared packages and backend app
COPY packages/ ./packages/
COPY apps/whatsapp-webhook/ ./apps/whatsapp-webhook/

# Install all dependencies
RUN pnpm install --ignore-scripts

# Stage 2: Minimal Production Runtime Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

# No Corepack/pnpm in the runtime stage: the entrypoint and healthcheck are
# plain `node`, so shipping a package manager only added an unpinned download
# and extra surface to the production image.

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy installed node_modules and built code from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/whatsapp-webhook ./apps/whatsapp-webhook

# Create persistent DB directory for PGlite with proper non-root permissions
RUN mkdir -p /app/data/db && chown -R node:node /app

# Run application under unprivileged 'node' user for security
USER node

EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-strip-types", "apps/whatsapp-webhook/src/server.ts"]
