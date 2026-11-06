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

// Endpoints that are reachable without a bearer token on purpose.
const PUBLIC = new Set(["POST /api/v1/auth/login", "POST /api/v1/auth/ingress"]);

let app: FastifyInstance;
let routes: { method: string; path: string }[] = [];

beforeAll(async () => {
  const logger = createLogger(config);
  const store = new Store({ seed: true });
  const source = new MockDeviceSource();
  const ops = new OpLog({ size: 10, logger });
  const poller = new Poller({ config, source, store, logger, ops });
  const commander = new Commander({ source, store, poller });
  app = await buildServer({ config, logger, store, commander, source, poller, ops });
  await app.ready();
  const spec = (app as unknown as { swagger: () => { paths: Record<string, Record<string, unknown>> } }).swagger();
  routes = Object.entries(spec.paths).flatMap(([path, ops]) =>
    Object.keys(ops).map((m) => ({ method: m.toUpperCase(), path: path.replace(/\{[^}]+\}/g, "x") })),
  );
});

afterAll(async () => {
  await app.close();
});

describe("API auth guard", () => {
  it("finds the /api/v1 routes in the OpenAPI spec", () => {
    expect(routes.filter((r) => r.path.startsWith("/api/v1/")).length).toBeGreaterThan(20);
  });

  it("rejects every non-public /api/v1 route without a token", async () => {
    const leaks: string[] = [];
    for (const r of routes) {
      if (!r.path.startsWith("/api/v1/") || PUBLIC.has(`${r.method} ${r.path}`)) continue;
      const res = await app.inject({
        method: r.method as "GET",
        url: r.path,
        ...(r.method === "GET" ? {} : { payload: {} }),
      });
      if (res.statusCode !== 401) leaks.push(`${r.method} ${r.path} -> ${res.statusCode}`);
    }
    expect(leaks).toEqual([]);
  });

  it("serves a protected route with a valid token (control)", async () => {
    const token = app.jwt.sign({ sub: "t", role: "user" });
    const res = await app.inject({ method: "GET", url: "/api/v1/rooms", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a forged token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/rooms",
      headers: { authorization: "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4Iiwicm9sZSI6Imluc3RhbGxlciJ9." },
    });
    expect(res.statusCode).toBe(401);
  });

  describe("ingress auto-login", () => {
    const ingress = { "x-ingress-path": "/api/hassio_ingress/abc" };

    it("refuses X-Ingress-Path from a LAN client on the direct port", async () => {
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/ingress", headers: ingress, remoteAddress: "192.168.1.50" });
      expect(res.statusCode).toBe(401);
    });

    it("ignores a spoofed X-Forwarded-For", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/ingress",
        headers: { ...ingress, "x-forwarded-for": "172.30.32.2" },
        remoteAddress: "192.168.1.50",
      });
      expect(res.statusCode).toBe(401);
    });

    it("refuses the Supervisor proxy without the header", async () => {
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/ingress", remoteAddress: "172.30.32.2" });
      expect(res.statusCode).toBe(401);
    });

    it.each(["172.30.32.2", "::ffff:172.30.32.2"])("issues a working token via the Supervisor proxy (%s)", async (peer) => {
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/ingress", headers: ingress, remoteAddress: peer });
      expect(res.statusCode).toBe(200);
      const { token } = res.json() as { token: string };
      const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${token}` } });
      expect(me.statusCode).toBe(200);
    });
  });

  // Non-canonical spellings of a protected URL must never reach a handler.
  it.each([
    "/api/v1/rooms/",
    "//api/v1/rooms",
    "/API/v1/rooms",
    "/api/v1//rooms",
    "/api/v1/./rooms",
    "/api/v1/auth/../rooms",
    "/api/v1/auth/login/../../rooms",
    "/api/v1/auth/login%2F..%2F..%2Frooms",
    "/api/v1/auth/login/..%2F..%2Frooms",
    "/api%2Fv1%2Frooms",
    "/api/v1/rooms?x=/api/v1/auth/login",
    "/api/v1/rooms#/api/v1/auth/login",
    "/api/v1/auth/loginx/../../rooms",
    "/api/v1/auth/ingress/../../rooms",
  ])("does not serve %s without a token", async (url) => {
    const res = await app.inject({ method: "GET", url });
    expect(res.statusCode === 401 || res.statusCode === 404, `${url} -> ${res.statusCode}`).toBe(true);
  });
});
