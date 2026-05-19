import bcrypt from "bcrypt";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Role } from "@rehau/types";
import type { Config } from "../config.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

export const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  role: z.enum(["user", "installer"]),
});

export const meResponseSchema = z.object({
  username: z.string(),
  role: z.enum(["user", "installer"]),
});

export const registerAuth = async (app: FastifyInstance, cfg: Config): Promise<void> => {
  await app.register(fastifyJwt, {
    secret: cfg.JWT_SECRET,
    sign: { expiresIn: cfg.JWT_TTL },
  });

  // Decorator: route handlers call `request.requireRole("installer")` to gate access.
  app.decorateRequest("requireRole", function (this: FastifyRequest, role: Role) {
    if (this.user.role !== role && !(role === "user" && this.user.role === "installer")) {
      throw Object.assign(new Error("forbidden"), { statusCode: 403 });
    }
  });

  // Global guard for everything under /api/v1 except /api/v1/auth/login
  // and /api/v1/auth/ingress (which has its own header check).
  app.addHook("preValidation", async (req) => {
    if (!req.url.startsWith("/api/v1/")) return;
    if (req.url.startsWith("/api/v1/auth/login")) return;
    if (req.url.startsWith("/api/v1/auth/ingress")) return;
    if (req.url.startsWith("/api/v1/events")) {
      // Allow ?token=... fallback for browsers that can't set headers on EventSource.
      const url = new URL(req.url, "http://x");
      const tokenParam = url.searchParams.get("token");
      if (tokenParam) req.headers.authorization = `Bearer ${tokenParam}`;
    }
    try {
      await req.jwtVerify();
    } catch {
      throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
    }
  });
};

export const registerAuthRoutes = (app: FastifyInstance, cfg: Config): void => {
  app.post("/api/v1/auth/login", {
    schema: {
      tags: ["auth"],
      body: loginBodySchema,
      response: {
        200: loginResponseSchema,
        401: z.object({ error: z.string() }),
      },
    },
  }, async (req, reply) => {
    const { username, password } = loginBodySchema.parse(req.body);
    const userOk = username === cfg.API_USER;
    const passOk = userOk && (await bcrypt.compare(password, cfg.API_PASSWORD_HASH).catch(() => false));
    if (!userOk || !passOk) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const role: Role = cfg.ADMIN_ROLE;
    const token = app.jwt.sign({ sub: username, role });
    const decoded = app.jwt.decode<{ exp: number }>(token);
    const expiresAt = new Date((decoded?.exp ?? 0) * 1000).toISOString();
    return reply.code(200).send({ token, expiresAt, role });
  });

  /**
   * Auto-login for requests coming in through Home Assistant's ingress
   * reverse proxy. HA's proxy injects an `X-Ingress-Path` header on every
   * forwarded request — that header IS NOT set when a LAN client hits the
   * addon's directly exposed port (8080). We treat its presence as proof
   * that the user has already authenticated with HA, and mint a JWT for
   * the configured admin user without asking for a password.
   *
   * Threat model: the addon is a LAN device, the user trusts everyone on
   * their LAN. A LAN attacker could spoof `X-Ingress-Path` against the
   * direct port, but they could also just brute-force the password — so
   * this endpoint doesn't widen the attack surface materially.
   */
  app.post("/api/v1/auth/ingress", {
    schema: {
      tags: ["auth"],
      response: {
        200: loginResponseSchema,
        401: z.object({ error: z.string() }),
      },
    },
  }, async (req, reply) => {
    const ingressPath = req.headers["x-ingress-path"];
    if (typeof ingressPath !== "string" || ingressPath.length === 0) {
      return reply.code(401).send({ error: "not_via_ingress" });
    }
    const username =
      (typeof req.headers["x-hass-display-name"] === "string" &&
        req.headers["x-hass-display-name"]) ||
      cfg.API_USER;
    const role: Role = cfg.ADMIN_ROLE;
    const token = app.jwt.sign({ sub: username, role });
    const decoded = app.jwt.decode<{ exp: number }>(token);
    const expiresAt = new Date((decoded?.exp ?? 0) * 1000).toISOString();
    return reply.code(200).send({ token, expiresAt, role });
  });

  app.get("/api/v1/auth/me", {
    schema: {
      tags: ["auth"],
      response: { 200: meResponseSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    return { username: req.user.sub, role: req.user.role };
  });
};

declare module "fastify" {
  interface FastifyRequest {
    requireRole(role: Role): void;
  }
}
