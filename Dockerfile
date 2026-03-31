# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
COPY frontend/tsconfig.json frontend/tsconfig.node.json ./
COPY frontend/vite.config.ts frontend/postcss.config.js frontend/tailwind.config.js frontend/index.html ./
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm ci && npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm ci && npm run build

# Stage 3: Production image
FROM node:20-alpine AS production
WORKDIR /app

# Copy compiled backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
# Install only production dependencies for backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy compiled frontend static files
COPY --from=frontend-builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "backend/dist/index.js"]
