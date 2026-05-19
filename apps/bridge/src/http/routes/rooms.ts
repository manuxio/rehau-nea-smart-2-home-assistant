import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Commander } from "../../core/commander.js";
import type { Store } from "../../core/store.js";
import {
  errorSchema,
  lightBodySchema,
  roomFlagsBodySchema,
  roomModeBodySchema,
  roomPatchSchema,
  roomSchema,
  setpointBodySchema,
} from "../schemas.js";

export interface RoomsRoutesDeps {
  store: Store;
  commander: Commander;
}

export const registerRoomsRoutes = (app: FastifyInstance, { store, commander }: RoomsRoutesDeps): void => {
  app.get("/api/v1/rooms", {
    schema: {
      tags: ["rooms"],
      response: { 200: z.array(roomSchema) },
      security: [{ bearerAuth: [] }],
    },
  }, async () => store.listRooms());

  app.get("/api/v1/rooms/:id", {
    schema: {
      tags: ["rooms"],
      params: z.object({ id: z.string() }),
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = store.getRoom(id);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });

  app.patch("/api/v1/rooms/:id", {
    schema: {
      tags: ["rooms"],
      params: z.object({ id: z.string() }),
      body: roomPatchSchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof roomPatchSchema>;
    let room = store.getRoom(id);
    if (!room) return reply.code(404).send({ error: "not_found" });

    if (body.mode !== undefined) {
      room = await commander.setRoomMode(id, body.mode, body.setpoint);
    } else if (body.setpoint !== undefined) {
      room = await commander.setRoomSetpoint(id, body.setpoint);
    }
    if (body.light !== undefined) {
      room = await commander.setRoomLight(id, body.light);
    }
    if (body.lock !== undefined || body.autoStart !== undefined || body.windowDetection !== undefined) {
      const flagPatch: { lock?: boolean; autoStart?: boolean; windowDetection?: boolean } = {};
      if (body.lock !== undefined) flagPatch.lock = body.lock;
      if (body.autoStart !== undefined) flagPatch.autoStart = body.autoStart;
      if (body.windowDetection !== undefined) flagPatch.windowDetection = body.windowDetection;
      room = await commander.setRoomFlags(id, flagPatch);
    }
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });

  app.put("/api/v1/rooms/:id/flags", {
    schema: {
      tags: ["rooms"],
      params: z.object({ id: z.string() }),
      body: roomFlagsBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof roomFlagsBodySchema>;
    const flagPatch: { lock?: boolean; autoStart?: boolean; windowDetection?: boolean } = {};
    if (body.lock !== undefined) flagPatch.lock = body.lock;
    if (body.autoStart !== undefined) flagPatch.autoStart = body.autoStart;
    if (body.windowDetection !== undefined) flagPatch.windowDetection = body.windowDetection;
    const room = await commander.setRoomFlags(id, flagPatch);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });

  app.put("/api/v1/rooms/:id/setpoint", {
    schema: {
      tags: ["rooms"],
      params: z.object({ id: z.string() }),
      body: setpointBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { value } = req.body as z.infer<typeof setpointBodySchema>;
    const room = await commander.setRoomSetpoint(id, value);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });

  app.put("/api/v1/rooms/:id/light", {
    schema: {
      tags: ["rooms"],
      params: z.object({ id: z.string() }),
      body: lightBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { light } = req.body as z.infer<typeof lightBodySchema>;
    const room = await commander.setRoomLight(id, light);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });

  app.put("/api/v1/rooms/:id/mode", {
    schema: {
      tags: ["rooms"],
      params: z.object({ id: z.string() }),
      body: roomModeBodySchema,
      response: { 200: roomSchema, 404: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { mode, setpoint } = req.body as z.infer<typeof roomModeBodySchema>;
    const room = await commander.setRoomMode(id, mode, setpoint);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
};
