# syntax=docker/dockerfile:1.7

# ─── deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
ENV CI=1
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package*.json tsconfig.base.json ./
COPY packages/types/package.json    packages/types/
COPY apps/bridge/package.json       apps/bridge/
COPY apps/web/package.json          apps/web/
RUN npm ci --workspaces --include-workspace-root \
 && apk del .build-deps

# ─── build ───────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# tsup bundles the bridge into dist/main.js, but leaves EVERY package.json
# dependency external (its default) — not just the ones in `external`.
# Vite builds the SPA.
RUN npm run build -w @rehau/bridge \
 && npm run build -w @rehau/web
# tsup externalises every package.json dependency, so the runtime image has
# to install them all — except the @rehau/* workspaces, which are inlined.
RUN node -e "const p=require('./apps/bridge/package.json');const d=Object.fromEntries(Object.entries(p.dependencies||{}).filter(([k])=>!k.startsWith('@rehau/')));d['pino-pretty']=d['pino-pretty']||'^13.0.0';require('fs').writeFileSync('/runtime-package.json',JSON.stringify({name:'rehau-bridge-runtime',version:'0.1.0',private:true,type:'module',dependencies:d},null,2))"

# ─── runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine
RUN apk add --no-cache wget \
 && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production HTTP_PORT=8080

# The deps tsup did not inline, generated at build time (see above).
COPY --from=build /runtime-package.json /app/package.json

RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm install --omit=dev --no-audit --no-fund \
 && apk del .build-deps \
 && npm cache clean --force

# Bridge bundle + React SPA.
COPY --from=build /app/apps/bridge/dist ./dist
COPY --from=build /app/apps/web/dist    ./web

USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "dist/main.js"]
