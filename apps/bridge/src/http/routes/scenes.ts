import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sceneModeWantsSetpoint, type Scene } from "@rehau/types";
import type { Commander } from "../../core/commander.js";
import type { Store } from "../../core/store.js";
import { errorSchema, sceneCreateSchema, sceneSchema } from "../schemas.js";

export interface ScenesRoutesDeps {
  store: Store;
  commander: Commander;
}

const newId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return `${slug || "scene"}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * GET    /api/v1/scenes              → list
 * POST   /api/v1/scenes               → create (server assigns id)
 * PUT    /api/v1/scenes/:id           → replace (id from path wins over body)
 * DELETE /api/v1/scenes/:id           → remove
 * POST   /api/v1/scenes/:id/apply     → run the scene (apply mode to all rooms)
 *
 * Backed by Store.{get,set}Scenes which persists to /data/state.json via
 * the persistent.changed event in main.ts.
 */
export const registerScenesRoutes = (
  app: FastifyInstance,
  { store, commander }: ScenesRoutesDeps,
): void => {
  app.get("/api/v1/scenes", {
    schema: {
      tags: ["scenes"],
      response: { 200: z.array(sceneSchema) },
      security: [{ bearerAuth: [] }],
    },
  }, async () => store.getScenes());

  app.post("/api/v1/scenes", {
    schema: {
      tags: ["scenes"],
      body: sceneCreateSchema,
      response: { 200: sceneSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const body = req.body as z.infer<typeof sceneCreateSchema>;
    const scene: Scene = { id: newId(body.name), ...body };
    store.setScenes([...store.getScenes(), scene]);
    return scene;
  });

  app.put("/api/v1/scenes/:id", {
    schema: {
      tags: ["scenes"],
      params: z.object({ id: z.string() }),
      body: sceneCreateSchema,
      response: { 200: sceneSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof sceneCreateSchema>;
    const list = store.getScenes();
    if (!list.some((s) => s.id === id)) return reply.code(404).send({ error: "not_found", message: "scene not found" });
    const next: Scene = { id, ...body };
    store.setScenes(list.map((s) => (s.id === id ? next : s)));
    return next;
  });

  app.delete("/api/v1/scenes/:id", {
    schema: {
      tags: ["scenes"],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ ok: z.literal(true) }) },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const { id } = req.params as { id: string };
    store.setScenes(store.getScenes().filter((s) => s.id !== id));
    return { ok: true as const };
  });

  /**
   * Apply a scene's action across the relevant entities. For v1 the
   * only supported action is `applyRoomMode` — sets every Room to the
   * scene's mode via Commander (which goes through the optimistic-write
   * path, so HA + the SPA see the new mode immediately and revert if
   * REHAU rejects). We don't block on every room's POST sequentially
   * because that would saturate REHAU's single-flight chain; the
   * Commander serialises them properly.
   */
  app.post("/api/v1/scenes/:id/apply", {
    schema: {
      tags: ["scenes"],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ ok: z.literal(true) }), 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const scene = store.getScenes().find((s) => s.id === id);
    if (!scene) return reply.code(404).send({ error: "not_found", message: "scene not found" });
    if (scene.action.type === "applyRoomMode") {
      const { mode, setpoint } = scene.action;
      // Only forward the setpoint when the mode actually owns one
      // (`normal` / `reduced`). For `standby` / `program` the device
      // either uses its own slot or defers to the weekly schedule —
      // passing a temp would write into the wrong place.
      const sp = sceneModeWantsSetpoint(mode) ? setpoint : undefined;
      for (const r of store.listRooms()) {
        // Fire-and-forget — each call queues into DeviceClient's chain
        // and updates the store optimistically in turn.
        void commander.setRoomMode(r.id, mode, sp);
      }
    } else if (scene.action.type === "perRoom") {
      // Only touch rooms the scene explicitly names. Rooms missing from
      // the map (e.g. a new room added after the scene was authored)
      // are intentionally left alone — same "skip" semantics.
      const setpoints = scene.action.setpoints ?? {};
      for (const [roomId, mode] of Object.entries(scene.action.rooms)) {
        if (!store.getRoom(roomId)) continue;
        const sp = sceneModeWantsSetpoint(mode) ? setpoints[roomId] : undefined;
        void commander.setRoomMode(roomId, mode, sp);
      }
    }
    return { ok: true as const };
  });
};
