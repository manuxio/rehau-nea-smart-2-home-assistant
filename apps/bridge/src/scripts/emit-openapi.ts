// Boots Fastify headlessly and writes the OpenAPI spec to
// packages/api-client/openapi.json. Wires up to `npm run openapi:emit`.
//
// Will be fleshed out in Phase 2 once routes are registered.

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { Commander } from "../core/commander.js";
import { Poller } from "../core/poller.js";
import { Store } from "../core/store.js";
import { MockDeviceSource } from "../device/source.js";
import { createLogger } from "../observability/log.js";
import { buildServer } from "../http/server.js";

const main = async (): Promise<void> => {
  process.env.JWT_SECRET ??= "openapi-emit-only-not-used-at-runtime";
  process.env.API_PASSWORD_HASH ??= "$2b$12$placeholder";
  process.env.DEVICE_URL ??= "http://localhost";
  process.env.DEVICE_MODE = "mock";

  const config = loadConfig();
  const logger = createLogger({ ...config, LOG_LEVEL: "warn" });
  const source = new MockDeviceSource();
  const store = new Store();
  const poller = new Poller({ config, source, store, logger });
  const commander = new Commander({ source, store, poller });
  const app = await buildServer({ config, logger, store, commander, source });
  await app.ready();

  // Will use @fastify/swagger once registered:
  const spec = (app as unknown as { swagger?: () => unknown }).swagger?.() ?? {
    openapi: "3.1.0",
    info: { title: "REHAU Bridge", version: "0.1.0" },
    paths: {},
  };

  const out = resolve(import.meta.dirname, "../../../../packages/api-client/openapi.json");
  await writeFile(out, JSON.stringify(spec, null, 2));
  // eslint-disable-next-line no-console
  console.log(`wrote ${out}`);
  await app.close();
};

main().catch((err: unknown) => {
  console.error("emit-openapi failed:", err);
  process.exit(1);
});
