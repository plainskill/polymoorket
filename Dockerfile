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

# shipd bind-mounts persistent storage at /data (group-writable, node joins via
# --group-add); pre-create it owned by node so boot still works unmounted
RUN mkdir -p /data /app/data && chown node:node /data /app/data
USER node
CMD ["node", "server/index.js"]
