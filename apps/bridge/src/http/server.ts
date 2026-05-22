import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Commander } from "../core/commander.js";
import type { Poller } from "../core/poller.js";
import type { Store } from "../core/store.js";
import type { Config } from "../config.js";
import type { Logger } from "../observability/log.js";
import { registerAuth, registerAuthRoutes } from "./auth.js";
import { registerOpenApi } from "./openapi.js";
import { registerFloorsRoutes } from "./routes/floors.js";
import { registerInstallerRoutes } from "./routes/installer.js";
import { registerMessagesRoutes } from "./routes/messages.js";
import { registerProgramsRoutes } from "./routes/programs.js";
import { registerRoomsRoutes } from "./routes/rooms.js";
import { registerScenesRoutes } from "./routes/scenes.js";
import { registerSystemRoutes } from "./routes/system.js";
import type { DeviceSource } from "../device/source.js";

export interface BuildServerArgs {
  config: Config;
  logger: Logger;
  store: Store;
  commander: Commander;
  source: DeviceSource;
  poller: Poller;
  /** When set, Fastify serves the built SPA from this directory at `/`. */
  spaDir?: string | undefined;
}

export const buildServer = async ({
  config,
  logger,
  store,
  commander,
  source,
  poller,
  spaDir,
}: BuildServerArgs) => {
  // Configure Fastify with its own pino options (logger generic must remain
  // FastifyBaseLogger so the route helper signatures match).
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.LOG_FORMAT === "pretty"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : {}),
    },
    disableRequestLogging: false,
    trustProxy: true,
    // Close keep-alive sockets immediately on app.close(). Without this, when
    // `tsx watch` restarts the bridge, idle browser connections keep the
    // listener alive past the SIGTERM and the OS holds port 8080.
    forceCloseConnections: true,
  });
  // Keep the standalone logger reference available to non-Fastify callers.
  void logger;

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const e = err as { name?: string; message?: string };
    app.log.error({ err, status }, "request failed");
    reply.code(status).send({ error: e.name ?? "error", message: e.message ?? "" });
  });

  // ─── plumbing ──────────────────────────────────────────────
  if (config.HTTP_CORS_ORIGINS) {
    const origins = config.HTTP_CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
    await app.register(fastifyCors, { origin: origins, credentials: true });
  }
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: () => false,
  });

  await registerOpenApi(app);
  await registerAuth(app, config);

  // ─── public ────────────────────────────────────────────────
  // Addon version is exported by rehau-bridge/run.sh as ADDON_VERSION
  // (bashio::addon.version). Falls back to "dev" when running outside the
  // addon container (npm run -w @rehau/bridge dev), so the System tab
  // shows something useful in both modes.
  const addonVersion = process.env.ADDON_VERSION || "dev";

  app.get("/healthz", async () => ({
    ok: true,
    bridge: "0.1.0",
    addon: addonVersion,
    source: config.DEVICE_MODE,
    device: { url: config.DEVICE_URL, ...store.getDeviceStatus() },
    connection: store.getConnection(),
    installerAccess: Boolean(config.DEVICE_INSTALLER_CODE),
  }));

  // Full ring-buffer + aggregates view for the Diagnostics UI / TODO.md
  // "Server-error visibility" layer 1. Auth-gated (under /api/v1) so it's
  // not advertised to anonymous probes. Includes addon + bridge version
  // so the SPA's System tab can show them in a single fetch.
  app.get("/api/v1/diagnostics/fetches", async () => ({
    ...store.getDiagnostics(),
    versions: { bridge: "0.1.0", addon: addonVersion },
  }));

  /**
   * Force-refresh — the SPA's "Refresh now" button hits this to bypass
   * the schedule and pull every meaningful endpoint immediately
   * (dashboard, room list, room detail, messages, calibration if
   * installer access is available). Returns after all calls have
   * settled so the SPA can flip a spinner off when the work is done.
   * Errors during the refresh are still logged by the poller's `safe`
   * wrapper — they don't fail this endpoint, so a partial refresh
   * (e.g. dashboard ok but calibration timed out) still returns 200.
   */
  app.post("/api/v1/diagnostics/refresh", async () => {
    await poller.refreshAll();
    return { ok: true };
  });

  // ─── api ───────────────────────────────────────────────────
  registerAuthRoutes(app, config);
  registerRoomsRoutes(app, { store, commander });
  registerSystemRoutes(app, { store, commander });
  registerMessagesRoutes(app, { store, source });
  registerProgramsRoutes(app, { store, commander });
  registerInstallerRoutes(app, { config, source, store });
  registerFloorsRoutes(app, { store });
  registerScenesRoutes(app, { store, commander });

  // ─── SPA (built React) ─────────────────────────────────────
  // Cache strategy:
  //   - index.html / *.html → no-cache, must-revalidate. The HTML
  //     references vite's content-hashed asset filenames; if the
  //     browser caches the HTML across an addon update, it keeps
  //     pointing at a deleted JS bundle and the user sees the old
  //     UI until they hard-refresh. no-cache forces a revalidate
  //     on every load while still allowing 304s.
  //   - assets/* → vite already content-hashes these (e.g.
  //     index-CtJ_6omw.js). Safe to cache for a long time; a new
  //     build gets a new filename so the HTML pulls a fresh asset.
  if (spaDir && existsSync(spaDir)) {
    await app.register(fastifyStatic, {
      root: resolve(spaDir),
      prefix: "/",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        } else if (/\/assets\//.test(filePath)) {
          // Content-hashed — long-lived. immutable hints the client
          // it can skip even the conditional GET.
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    });
    // SPA fallback for non-/api/* paths (TanStack/router pretty URLs).
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/docs") || req.url.startsWith("/openapi")) {
        return reply.code(404).send({ error: "not_found" });
      }
      reply.header("Cache-Control", "no-cache, must-revalidate");
      return reply.sendFile("index.html");
    });
  }

  return app;
};

export type Server = Awaited<ReturnType<typeof buildServer>>;
