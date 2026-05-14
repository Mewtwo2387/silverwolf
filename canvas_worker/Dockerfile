FROM oven/bun:latest

WORKDIR /app

# Install system dependencies for node-canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN bun install

COPY . .

# Environment variables
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "index.ts"]
