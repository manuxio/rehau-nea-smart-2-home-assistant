ARG BUILD_FROM
FROM ${BUILD_FROM}

# HA base images are Alpine. Node 22+ is needed by tsup's emitted bundle.
RUN apk add --no-cache nodejs npm bash tini

WORKDIR /app

# Pre-built bundles are shipped inside the addon — we do not build from source
# inside the container. This keeps the build context tiny and the install fast
# on every architecture.
COPY dist/ ./dist/
COPY web/  ./web/
COPY package.json ./
COPY run.sh /run.sh

RUN chmod +x /run.sh \
 && npm install --omit=dev --no-audit --no-fund --loglevel=error

# tini reaps zombies and forwards SIGTERM so HA can stop the addon cleanly.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/run.sh"]
