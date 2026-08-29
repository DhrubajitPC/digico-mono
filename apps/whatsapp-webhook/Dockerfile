FROM node:22-alpine AS builder

WORKDIR /app

# Install git for prepare scripts
RUN apk add --no-cache git

# Bypass minimum release age policy inside Docker build
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Must follow the COPY: reads the pinned version from package.json#packageManager
RUN corepack enable && corepack prepare --activate

COPY packages/ ./packages/
COPY apps/whatsapp-webhook/ ./apps/whatsapp-webhook/

RUN pnpm install --ignore-scripts

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/whatsapp-webhook ./apps/whatsapp-webhook

RUN mkdir -p /app/data/db && chown -R node:node /app

USER node

EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-strip-types", "apps/whatsapp-webhook/src/server.ts"]
