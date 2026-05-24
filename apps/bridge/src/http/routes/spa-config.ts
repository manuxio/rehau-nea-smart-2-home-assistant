// UI-only SPA config — what bits of the bundle should render which way.
// Independent of the bridge's actual capabilities; toggling these flags
// hides surfaces without changing what the API serves or what MQTT
// publishes. See POLLING-PLAN.md → "SPA visibility flags".
//
// Auth-gated under /api/v1 like every other config endpoint. The SPA
// fetches once on mount and caches the result; restart the addon to
// change.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../../config.js";

const spaConfigSchema = z.object({
  installerTab: z.boolean(),
});

export interface SpaConfigRoutesDeps {
  config: Config;
}

export const registerSpaConfigRoutes = (
  app: FastifyInstance,
  { config }: SpaConfigRoutesDeps,
): void => {
  app.get("/api/v1/spa-config", {
    schema: {
      tags: ["system"],
      response: { 200: spaConfigSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async () => ({
    installerTab: config.SPA_INSTALLER_TAB,
  }));
};
