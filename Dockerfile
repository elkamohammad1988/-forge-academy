FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

# Native deps for better-sqlite3
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/forge.db

# Non-root user
RUN addgroup -S forge && adduser -S forge -G forge

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=forge:forge . .

# Persistent SQLite volume
RUN mkdir -p /data && chown -R forge:forge /data
VOLUME ["/data"]

USER forge

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
