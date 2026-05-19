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
import type { Store } from "../core/store.js";
import type { Config } from "../config.js";
import type { Logger } from "../observability/log.js";
import { registerAuth, registerAuthRoutes } from "./auth.js";
import { registerOpenApi } from "./openapi.js";
import { registerInstallerRoutes } from "./routes/installer.js";
import { registerMessagesRoutes } from "./routes/messages.js";
import { registerProgramsRoutes } from "./routes/programs.js";
import { registerRoomsRoutes } from "./routes/rooms.js";
import { registerSystemRoutes } from "./routes/system.js";
import type { DeviceSource } from "../device/source.js";

export interface BuildServerArgs {
  config: Config;
  logger: Logger;
  store: Store;
  commander: Commander;
  source: DeviceSource;
  /** When set, Fastify serves the built SPA from this directory at `/`. */
  spaDir?: string | undefined;
}

export const buildServer = async ({
  config,
  logger,
  store,
  commander,
  source,
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
  app.get("/healthz", async () => ({
    ok: true,
    bridge: "0.1.0",
    source: config.DEVICE_MODE,
    device: { url: config.DEVICE_URL, ...store.getDeviceStatus() },
    installerAccess: Boolean(config.DEVICE_INSTALLER_CODE),
  }));

  // ─── api ───────────────────────────────────────────────────
  registerAuthRoutes(app, config);
  registerRoomsRoutes(app, { store, commander });
  registerSystemRoutes(app, { store, commander });
  registerMessagesRoutes(app, { store });
  registerProgramsRoutes(app, { store, commander });
  registerInstallerRoutes(app, { config, source });

  // ─── SPA (built React) ─────────────────────────────────────
  if (spaDir && existsSync(spaDir)) {
    await app.register(fastifyStatic, { root: resolve(spaDir), prefix: "/" });
    // SPA fallback for non-/api/* paths (TanStack/router pretty URLs).
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/docs") || req.url.startsWith("/openapi")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
};

export type Server = Awaited<ReturnType<typeof buildServer>>;
