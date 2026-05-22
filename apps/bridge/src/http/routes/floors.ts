import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../core/store.js";
import { floorAssignmentsSchema } from "../schemas.js";

export interface FloorsRoutesDeps {
  store: Store;
}

/**
 * GET  /api/v1/floors      → current zone-to-label map (JSON object)
 * PUT  /api/v1/floors      → replace the whole map (zone strings → labels)
 *
 * Lives outside REHAU — pure SPA-driven config persisted to /data/state.json.
 * The Store applies the new map to every existing Room in-place so the
 * Dashboard's sorted-by-floor view updates immediately.
 */
export const registerFloorsRoutes = (
  app: FastifyInstance,
  { store }: FloorsRoutesDeps,
): void => {
  app.get("/api/v1/floors", {
    schema: {
      tags: ["floors"],
      response: { 200: floorAssignmentsSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    // FloorAssignments uses numeric keys; HTTP/JSON keys are strings.
    // Coerce on serialize so the wire shape is `{"0": "Ground", "1": "First"}`.
    const a = store.getFloorAssignments();
    return Object.fromEntries(Object.entries(a).map(([k, v]) => [String(k), v]));
  });

  app.put("/api/v1/floors", {
    schema: {
      tags: ["floors"],
      body: floorAssignmentsSchema,
      response: { 200: floorAssignmentsSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const body = req.body as Record<string, string>;
    const numericKeyed: Record<number, string> = {};
    for (const [k, v] of Object.entries(body)) {
      const n = Number(k);
      if (!Number.isInteger(n)) continue;
      numericKeyed[n] = v;
    }
    store.setFloorAssignments(numericKeyed);
    const a = store.getFloorAssignments();
    return Object.fromEntries(Object.entries(a).map(([k, v]) => [String(k), v]));
  });
};
