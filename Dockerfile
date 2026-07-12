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

COPY --from=builder /app ./

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
