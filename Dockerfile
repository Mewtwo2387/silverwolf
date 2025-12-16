# --- STAGE 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# --- STAGE 2: Run ---
FROM node:20-alpine
WORKDIR /app

# 1. Create the persistence folder and set permissions
RUN mkdir -p /app/persistence && chown -R node:node /app/persistence

# 2. Switch to non-privileged user
USER node

# 3. Copy files AND ensure the 'node' user owns them
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# IMPORTANT: Ensure your code points to /app/persistence/bot.db
CMD ["node", "index.js"]