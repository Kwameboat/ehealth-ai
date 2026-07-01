FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:whatsapp || true
RUN mkdir -p db && cp node_modules/sql.js/dist/sql-wasm.wasm db/sql-wasm.wasm

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/medassistant.db
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app .
EXPOSE 8080
CMD ["node", "server.js"]
