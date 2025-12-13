# Production Dockerfile for Smart ZZP Hub Backend
FROM node:18-alpine AS base

WORKDIR /app

COPY backend/package*.json ./
COPY backend/node_modules ./node_modules
RUN npm prune --omit=dev && test -f node_modules/express/package.json && npm cache clean --force

COPY backend/src ./src

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/index.js"]
