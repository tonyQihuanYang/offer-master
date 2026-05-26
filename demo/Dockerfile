# syntax=docker/dockerfile:1.6

# ---- Stage 1: build the Vite frontend ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (incl. dev) for the build
COPY package*.json ./
RUN npm ci

# Build the frontend
COPY . .
RUN npm run build

# ---- Stage 2: lean runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bring in the server code, the built frontend, and the seed data files
COPY server ./server
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "server/index.js"]
