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
COPY apps/website/ ./apps/website/

RUN pnpm install --ignore-scripts

RUN pnpm --filter website build

FROM nginx:1.27-alpine AS runner

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/apps/website/dist /usr/share/nginx/html

COPY apps/website/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
