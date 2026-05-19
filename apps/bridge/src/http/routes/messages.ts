import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../core/store.js";
import { messageSchema } from "../schemas.js";

export interface MessagesRoutesDeps {
  store: Store;
}

export const registerMessagesRoutes = (app: FastifyInstance, { store }: MessagesRoutesDeps): void => {
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
};
