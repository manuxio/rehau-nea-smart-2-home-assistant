import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../core/store.js";
import type { DeviceSource } from "../../device/source.js";
import { messageSchema } from "../schemas.js";

export interface MessagesRoutesDeps {
  store: Store;
  source: DeviceSource;
}

export const registerMessagesRoutes = (
  app: FastifyInstance,
  { store, source }: MessagesRoutesDeps,
): void => {
  app.get("/api/v1/messages", {
    schema: {
      tags: ["messages"],
      querystring: z.object({ activeOnly: z.coerce.boolean().optional() }),
      response: { 200: z.array(messageSchema) },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const { activeOnly } = req.query as { activeOnly?: boolean };
    const all = store.getMessages();
    return activeOnly ? all.filter((m) => !m.resolvedAt) : all;
  });

  /**
   * Acknowledge / clear all REHAU alarms. Mirrors the device's built-in
   * Confirm button on /messages.html (which POSTs the wrapping form to
   * /user-menu.html). After the POST REHAU's table empties on the next
   * fetch; we also wipe the Store's cache immediately so the SPA and
   * MQTT see the cleared state without waiting for the next scheduled
   * poll. The poller re-fetches authoritative state on the next tick.
   */
  app.post("/api/v1/messages/clear", {
    schema: {
      tags: ["messages"],
      response: { 200: z.object({ ok: z.literal(true) }) },
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    await source.clearMessages();
    store.setMessages([]);
    return { ok: true as const };
  });
};
