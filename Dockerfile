FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Le env var reali servono solo a runtime, non in build:
# valori placeholder qui permettono a `next build` di completare.
ENV SHOPIFY_DOMAIN=placeholder.myshopify.com
ENV SHOPIFY_CLIENT_ID=placeholder
ENV SHOPIFY_CLIENT_SECRET=placeholder
ENV CATALOG_USER_1_ID=placeholder
ENV CATALOG_USER_1_PASSWORD=placeholder
ENV SESSION_SECRET=placeholder
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
