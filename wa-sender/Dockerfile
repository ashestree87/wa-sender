# Use latest stable Node.js version
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-bullseye AS base

LABEL fly_launch_runtime="NodeJS"

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install required system dependencies (for Puppeteer & WhatsApp-web.js)
RUN apt-get update -qq && \
    apt-get install -y \
    python-is-python3 \
    pkg-config \
    build-essential \
    chromium \
    libnss3 \
    libfreetype6 \
    libharfbuzz0b \
    ca-certificates \
    fonts-freefont-ttf \
    libgbm-dev && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Build stage
FROM base as build

# Install node modules
COPY --link package.json package-lock.json ./
RUN npm install --production=false

# Copy server code (exclude client directory)
COPY --link server ./server
COPY --link .env* ./

# Remove development dependencies
RUN npm prune --production

# Final production stage
FROM base

# Copy built application
COPY --from=build /app /app

# Expose the default port
EXPOSE 3000

# Start the server
CMD ["node", "/app/server/index.js"]
