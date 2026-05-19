import type { FastifyInstance } from "fastify";
import type { Commander } from "../../core/commander.js";
import type { Store } from "../../core/store.js";
import {
  energyLevelBodySchema,
  operatingModeBodySchema,
  systemStateSchema,
} from "../schemas.js";

export interface SystemRoutesDeps {
  store: Store;
  commander: Commander;
}

export const registerSystemRoutes = (
  app: FastifyInstance,
  { store, commander }: SystemRoutesDeps,
): void => {
  app.get("/api/v1/system", {
    schema: {
      tags: ["system"],
      response: { 200: systemStateSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async () => store.getSystem());

  app.put("/api/v1/system/operating_mode", {
    schema: {
      tags: ["system"],
      body: operatingModeBodySchema,
      response: { 200: systemStateSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const { mode } = operatingModeBodySchema.parse(req.body);
    await commander.setOperatingMode(mode);
    return store.getSystem();
  });

  app.put("/api/v1/system/energy_level", {
    schema: {
      tags: ["system"],
      body: energyLevelBodySchema,
      response: { 200: systemStateSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const { level } = energyLevelBodySchema.parse(req.body);
    await commander.setEnergyLevel(level);
    return store.getSystem();
  });
};
