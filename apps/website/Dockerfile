# Stage 1: Build static React 19 app
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

# Copy packages and frontend app
COPY packages/ ./packages/
COPY apps/website/ ./apps/website/

# Install dependencies
RUN pnpm install --ignore-scripts

# Build production bundle
RUN pnpm --filter website build

# Stage 2: Serve with lightweight Nginx
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets
COPY --from=builder /app/apps/website/dist /usr/share/nginx/html

# Copy custom Nginx security and reverse proxy config
COPY apps/website/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
