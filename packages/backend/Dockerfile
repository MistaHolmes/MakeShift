FROM oven/bun:latest

WORKDIR /app

# Copy package metadata
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy application files
COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Expose backend ports
EXPOSE 3001

# Start backend
CMD ["bun", "run", "index.ts"]
