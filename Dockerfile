# Стадия сборки
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Стадия production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p public/uploads/avatars public/uploads/designs public/uploads/videos public/uploads/sterilization
RUN chown -R nextjs:nodejs public/uploads

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "node_modules/.bin/next", "start", "--port", "3000"]
