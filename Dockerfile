# polymoorket — one container: node server + built SPA + sqlite at /data
FROM node:22-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
# full bookworm image carries build tools, so better-sqlite3 compiles even if no prebuild
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

EXPOSE 3000

# shipd bind-mounts persistent storage at /data; run as node user
USER node
CMD ["node", "server/index.js"]
