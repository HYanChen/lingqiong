FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,id=lingqiong-npm-cache,target=/root/.npm \
    npm ci \
      --ignore-scripts \
      --no-audit \
      --no-fund \
      --registry=https://registry.npmmirror.com

FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV WCU_ALLOW_DATABASE_FALLBACK=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/next/dist/bin/next build --webpack

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts ./scripts
# The one-shot OIDC synchronizer runs outside Next.js, so its small locked
# mysql2 dependency tree must accompany the standalone server explicitly.
COPY --from=builder --chown=node:node /app/node_modules/mysql2 ./node_modules/mysql2
COPY --from=builder --chown=node:node /app/node_modules/aws-ssl-profiles ./node_modules/aws-ssl-profiles
COPY --from=builder --chown=node:node /app/node_modules/denque ./node_modules/denque
COPY --from=builder --chown=node:node /app/node_modules/generate-function ./node_modules/generate-function
COPY --from=builder --chown=node:node /app/node_modules/is-property ./node_modules/is-property
COPY --from=builder --chown=node:node /app/node_modules/iconv-lite ./node_modules/iconv-lite
COPY --from=builder --chown=node:node /app/node_modules/safer-buffer ./node_modules/safer-buffer
COPY --from=builder --chown=node:node /app/node_modules/long ./node_modules/long
COPY --from=builder --chown=node:node /app/node_modules/lru.min ./node_modules/lru.min
COPY --from=builder --chown=node:node /app/node_modules/named-placeholders ./node_modules/named-placeholders
COPY --from=builder --chown=node:node /app/node_modules/sql-escaper ./node_modules/sql-escaper

EXPOSE 3000

CMD ["node", "server.js"]
