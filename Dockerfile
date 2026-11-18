# syntax=docker/dockerfile:1
# Card Table production image: one Node process serving the app, API and WebSocket (server-hosting spec).
# glibc-based slim image: better-sqlite3 and sharp ship prebuilt binaries for linux-x64/arm64 glibc.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
ARG GIT_SHA=dev
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data GIT_SHA=${GIT_SHA}
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json shared/
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/package.json server/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data
EXPOSE 8080
# Starts as root only to take ownership of the mounted volume, then drops to the unprivileged "node" user.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/dist/main.js"]
