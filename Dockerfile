FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install frontend deps
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci

# Install backend deps
COPY backend/package*.json backend/
RUN cd backend && npm ci

# Copy source and build
COPY . .

RUN cd frontend && npm run build
RUN cd backend && npx prisma generate && npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
