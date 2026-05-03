# ---------- DEPS ----------
FROM node:18-alpine AS deps

WORKDIR /app
COPY backend/api-gateway/package*.json ./
RUN npm install --production

# ---------- APP ----------
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY backend/api-gateway/ .

# ✅ USE THIS (safe)
CMD ["npm", "start"]