# --- STAGE 1: Build ---
FROM oven/bun:1 AS builder
WORKDIR /app

# 1. Install system-level build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 2. [NEW] Install node-gyp globally so 'canvas' can use it to compile
RUN bun add -g node-gyp

COPY package.json bun.lockb* bun.lock ./

# 3. Install project dependencies
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

# --- STAGE 2: Run ---
# Use 'slim' (Debian) for a smaller final image that is still compatible with Stage 1
FROM oven/bun:1-slim
WORKDIR /app

# Install runtime libraries only
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libgif7 \
    librsvg2-2 \
    fonts-dejavu \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Create persistence directory and set permissions
RUN mkdir -p /app/persistence && chown -R bun:bun /app/persistence

# Switch to non-root user
USER bun

# Copy node_modules and code from builder
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . .

# Refresh font cache
RUN fc-cache -f

CMD ["bun", "index.js"]