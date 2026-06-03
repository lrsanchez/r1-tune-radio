### Stage 1: build the Vite client
FROM node:20-alpine AS builder
WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_TOKEN=r1-radio-2026
ARG VITE_PIN=000000
ENV VITE_TOKEN=$VITE_TOKEN
ENV VITE_PIN=$VITE_PIN

RUN npm run build

### Stage 2: production server
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=builder /build/dist ./public

EXPOSE 15000

ENV PORT=15000
ENV TOKEN=r1-radio-2026

CMD ["node", "index.js"]
