# @rehau/api-client

Typed REST client for the REHAU bridge.

This package is **regenerated** from the bridge's OpenAPI 3.1 spec — do not edit `src/generated/` by hand.

## Regenerate

```bash
# 1. emit the latest OpenAPI spec from the bridge into this package:
npm run openapi:emit -w @rehau/bridge      # writes packages/api-client/openapi.json

# 2. regenerate the typed client (when wired):
npm run generate -w @rehau/api-client      # writes src/generated/
```

## Status

The bridge exposes `/openapi.json` (also reachable via `npm run openapi:emit`).

The React web app currently consumes a hand-typed client at `apps/web/src/lib/apiClient.ts` for fastest iteration. Switching to the generated client is a one-line import change per file once `npm run generate` is run.

The committed `openapi.json` is a snapshot — regenerate after route changes.
