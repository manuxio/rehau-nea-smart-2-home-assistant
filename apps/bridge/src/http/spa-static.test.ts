import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { Commander } from "../core/commander.js";
import { Poller } from "../core/poller.js";
import { Store } from "../core/store.js";
import { MockDeviceSource } from "../device/source.js";
import { createLogger } from "../observability/log.js";
import { OpLog } from "../observability/ops-log.js";
import { buildServer } from "./server.js";

const config = loadConfig({
  DEVICE_URL: "http://10.0.0.1",
  DEVICE_MODE: "mock",
  JWT_SECRET: "x".repeat(32),
  API_PASSWORD_HASH: "$2b$12$abc",
  LOG_LEVEL: "fatal",
} as NodeJS.ProcessEnv);

let app: FastifyInstance;
let spaDir: string;

beforeAll(async () => {
  spaDir = mkdtempSync(join(tmpdir(), "rehau-spa-"));
  mkdirSync(join(spaDir, "assets"));
  writeFileSync(join(spaDir, "index.html"), "<!doctype html><title>spa</title>");
  writeFileSync(join(spaDir, "assets", "index-abc123.js"), "console.log(1)");
  const logger = createLogger(config);
  const store = new Store({ seed: true });
  const source = new MockDeviceSource();
  const ops = new OpLog({ size: 10, logger });
  const poller = new Poller({ config, source, store, logger, ops });
  const commander = new Commander({ source, store, poller });
  app = await buildServer({ config, logger, store, commander, source, poller, ops, spaDir });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(spaDir, { recursive: true, force: true });
});

describe("SPA static serving", () => {
  it("serves index.html with no-cache", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<title>spa</title>");
    expect(res.headers["cache-control"]).toBe("no-cache, must-revalidate");
  });

  it("serves hashed assets as immutable", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/index-abc123.js" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await app.inject({ method: "GET", url: "/rooms/r-salone" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("<title>spa</title>");
  });

  it("keeps unknown /api paths as JSON 404s", async () => {
    const res = await app.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("does not serve files outside the SPA root", async () => {
    for (const url of ["/../package.json", "/assets/..%2F..%2Fpackage.json", "/%2e%2e/%2e%2e/package.json"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.body, url).not.toContain('"name"');
    }
  });
});
