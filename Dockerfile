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

# 4. Build CSS (Tailwind) and JS (Bun.build minify) inside the image so the
#    runtime never depends on committed build artifacts. tailwindcss is a
#    devDep and was skipped by --production above; `bunx --bun tailwindcss@3`
#    fetches it just-in-time. bun build is built into the runtime, no install.
COPY site_src ./site_src
COPY tailwind.config.js ./
RUN bun build ./site_src/Assets/app.src.js --minify --outfile ./site_src/Assets/app.js \
    && bunx --bun tailwindcss@3 -i ./site_src/Assets/input.css -o ./site_src/Assets/styles.css --minify

# 5. Fetch the GM soundfont for the JAYDON music generator (checksum-verified,
#    cached as a layer — only re-downloads when the fetch script changes).
COPY scripts/fetch-soundfont.ts ./scripts/fetch-soundfont.ts
RUN bun scripts/fetch-soundfont.ts

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
# Overlay the built CSS/JS from the builder stage. The local `.dockerignore`
# excludes these from the `COPY . .` above, so the only copies that reach the
# runtime are the ones the builder just produced.
COPY --from=builder --chown=bun:bun /app/site_src/Assets/styles.css ./site_src/Assets/styles.css
COPY --from=builder --chown=bun:bun /app/site_src/Assets/app.js ./site_src/Assets/app.js
# Soundfont downloaded + checksum-verified in the builder stage.
COPY --from=builder --chown=bun:bun /app/data/soundfonts ./data/soundfonts

# Refresh font cache
RUN fc-cache -f

CMD ["bun", "index.ts"]