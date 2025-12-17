# --- STAGE 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Install the tools needed to compile native 'canvas'
# These are only in the builder stage, so they won't bloat your final image
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    python3

COPY package*.json ./

# 2. Tell npm to use the tools we just installed
RUN npm ci --omit=dev

# --- STAGE 2: Run (The Prison) ---
FROM node:20-alpine
WORKDIR /app

# 3. IMPORTANT: Canvas needs these libraries to actually RUN 
# (These are much smaller than the build tools)
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib

RUN mkdir -p /app/persistence && chown -R node:node /app/persistence
USER node

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

CMD ["node", "index.js"]