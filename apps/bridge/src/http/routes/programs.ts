import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  bitsToIntervals,
  intervalsToBits,
} from "../../device/codecs.js";
import type { Commander } from "../../core/commander.js";
import type { Store } from "../../core/store.js";
import {
  dailyProgramSchema,
  dailyProgramWriteSchema,
  errorSchema,
  weeklyProgramSchema,
  weeklyProgramWriteSchema,
} from "../schemas.js";

export interface ProgramsRoutesDeps {
  store: Store;
  commander: Commander;
}

export const registerProgramsRoutes = (
  app: FastifyInstance,
  { store, commander }: ProgramsRoutesDeps,
): void => {
  // ─── daily ──────────────────────────────────────────────────
  // Lazy-fill any missing slot before returning the list. REHAU exposes
  // a fixed catalogue of 10 daily and 5 weekly programs; with the
  // no-defaults rule the Store boots empty in live mode, so a fresh
  // bridge would otherwise show "0 weekly programs" until the user
  // manually opened each one. Refresh-on-list-call fixes that with a
  // one-time tax (~3.5s for 10 daily, ~1.8s for 5 weekly) the first
  // time the SPA visits the Programs tab; subsequent reads come from
  // the in-memory cache. Errors per slot are swallowed so a single
  // bad slot doesn't break the whole list.
  app.get("/api/v1/programs/daily", {
    schema: {
      tags: ["programs"],
      response: { 200: z.array(dailyProgramSchema) },
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    for (let n = 1; n <= 10; n++) {
      if (!store.getDailyProgram(n)) {
        try { await commander.refreshDailyProgram(n); } catch { /* skip slot */ }
      }
    }
    return store.listDailyPrograms();
  });

  app.get("/api/v1/programs/daily/:n", {
    schema: {
      tags: ["programs"],
      params: z.object({ n: z.coerce.number().int().min(1).max(10) }),
      querystring: z.object({ fresh: z.coerce.boolean().optional() }),
      response: { 200: dailyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { n } = req.params as { n: number };
    const { fresh } = req.query as { fresh?: boolean };
    if (fresh || !store.getDailyProgram(n)) {
      const p = await commander.refreshDailyProgram(n);
      if (!p) return reply.code(404).send({ error: "not_found" });
      return p;
    }
    return store.getDailyProgram(n)!;
  });

  app.put("/api/v1/programs/daily/:n", {
    schema: {
      tags: ["programs"],
      params: z.object({ n: z.coerce.number().int().min(1).max(10) }),
      body: dailyProgramWriteSchema,
      response: { 200: dailyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { n } = req.params as { n: number };
    const body = req.body as z.infer<typeof dailyProgramWriteSchema>;
    const bits = "bits" in body ? body.bits : intervalsToBits(body.intervals);
    const p = await commander.setDailyProgram(n, bits);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return p;
  });

  // ─── weekly ─────────────────────────────────────────────────
  // Same lazy-fill story as the daily-list handler above. The user
  // reported seeing 1 weekly program instead of 5 — that was because
  // only the one they'd opened got cached; with the no-defaults sweep
  // removing the mock seed in live mode the other slots stayed empty.
  app.get("/api/v1/programs/weekly", {
    schema: {
      tags: ["programs"],
      response: { 200: z.array(weeklyProgramSchema) },
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    for (let n = 1; n <= 5; n++) {
      if (!store.getWeeklyProgram(n)) {
        try { await commander.refreshWeeklyProgram(n); } catch { /* skip slot */ }
      }
    }
    return store.listWeeklyPrograms();
  });

  app.get("/api/v1/programs/weekly/:n", {
    schema: {
      tags: ["programs"],
      params: z.object({ n: z.coerce.number().int().min(1).max(5) }),
      querystring: z.object({ fresh: z.coerce.boolean().optional() }),
      response: { 200: weeklyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { n } = req.params as { n: number };
    const { fresh } = req.query as { fresh?: boolean };
    if (fresh || !store.getWeeklyProgram(n)) {
      const p = await commander.refreshWeeklyProgram(n);
      if (!p) return reply.code(404).send({ error: "not_found" });
      return p;
    }
    return store.getWeeklyProgram(n)!;
  });

  app.put("/api/v1/programs/weekly/:n", {
    schema: {
      tags: ["programs"],
      params: z.object({ n: z.coerce.number().int().min(1).max(5) }),
      body: weeklyProgramWriteSchema,
      response: { 200: weeklyProgramSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { n } = req.params as { n: number };
    const b = req.body as z.infer<typeof weeklyProgramWriteSchema>;
    const days: [number, number, number, number, number, number, number] = [
      b.monday, b.tuesday, b.wednesday, b.thursday, b.friday, b.saturday, b.sunday,
    ];
    const p = await commander.setWeeklyProgram(n, days);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return p;
  });

  // ─── intervals helper exposed for the UI ────────────────────
  app.get("/api/v1/programs/daily/:n/intervals", {
    schema: {
      tags: ["programs"],
      params: z.object({ n: z.coerce.number().int().min(1).max(10) }),
      response: {
        200: z.object({
          intervals: z.array(z.object({ start: z.string(), end: z.string() })),
        }),
        404: errorSchema,
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { n } = req.params as { n: number };
    const p = store.getDailyProgram(n);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return { intervals: bitsToIntervals(p.bits) };
  });
};
