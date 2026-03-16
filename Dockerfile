# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/server
COPY server/package.json ./
RUN npm install
COPY server/src ./src
COPY server/tsconfig.json ./
RUN npx tsc

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

RUN npm install -g serve

COPY --from=backend-build /app/server/dist ./server/dist
COPY --from=backend-build /app/server/node_modules ./server/node_modules
COPY --from=backend-build /app/server/package.json ./server/

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000 3001

CMD ["/app/docker-entrypoint.sh"]