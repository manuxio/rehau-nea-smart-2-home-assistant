# @rehau/web

React + Vite + TypeScript SPA for the REHAU Nea Smart 2 control app.

## Status

Phase 1 stub: renders the seed rooms from the mock client. Full screens from the Claude Design hand-off will be transplanted into `src/features/*` next.

## Dev

```bash
npm run dev -w @rehau/web
# vite on :5173, proxies /api & /openapi.json to http://localhost:8080
```

Set `VITE_BRIDGE_URL` in your shell to override the proxy target.

## Build

```bash
npm run build -w @rehau/web
# emits to apps/web/dist — bundled by the bridge container at /web
```
