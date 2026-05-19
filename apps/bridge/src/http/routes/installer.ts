import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../../config.js";
import type { DeviceSource } from "../../device/source.js";
import type { RoomCalibration } from "@rehau/types";
import {
  calibrationStateSchema,
  calibrationWriteSchema,
  errorSchema,
  heatCurveSchema,
  installerSettingsGroupSchema,
  installerSettingsPatchSchema,
  installerSettingsSchema,
  ioSchema,
  topologySchema,
  uptimeSchema,
} from "../schemas.js";

export interface InstallerRoutesDeps {
  config: Config;
  source: DeviceSource;
}

const nowIso = (): string => new Date().toISOString();

export const registerInstallerRoutes = (
  app: FastifyInstance,
  { config, source }: InstallerRoutesDeps,
): void => {
  const guard = async () => {
    if (!source.hasInstaller || !config.DEVICE_INSTALLER_CODE) {
      const err = Object.assign(new Error("installer_disabled"), { statusCode: 503 });
      throw err;
    }
  };

  // ─── calibrazione ────────────────────────────────────────
  app.get("/api/v1/installer/calibration", {
    schema: {
      tags: ["installer"],
      response: { 200: calibrationStateSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const snap = await source.fetchCalibration();
    return { ...snap, meta: { lastUpdatedAt: nowIso() } };
  });

  app.put("/api/v1/installer/calibration", {
    schema: {
      tags: ["installer"],
      body: calibrationWriteSchema,
      response: { 200: calibrationStateSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const body = req.body as z.infer<typeof calibrationWriteSchema>;
    // Single installer session: read + merge + write + return — instead of
    // fetch → setCalibration (which itself fetches + writes) → fetch.
    const patch: { outdoor?: number; rooms?: RoomCalibration[] } = {};
    if (body.outdoor !== undefined) patch.outdoor = body.outdoor;
    if (body.rooms !== undefined) patch.rooms = body.rooms;
    const fresh = await source.setCalibration(patch);
    return { ...fresh, meta: { lastUpdatedAt: nowIso() } };
  });

  // ─── I/O live ────────────────────────────────────────────
  app.get("/api/v1/installer/io", {
    schema: {
      tags: ["installer"],
      response: { 200: ioSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    return source.fetchIO();
  });

  // ─── diagnostica ─────────────────────────────────────────
  app.get("/api/v1/installer/diagnostics/uptime", {
    schema: {
      tags: ["installer"],
      response: { 200: uptimeSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    return source.fetchUptime();
  });

  app.get("/api/v1/installer/diagnostics/topology", {
    schema: {
      tags: ["installer"],
      response: { 200: topologySchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    return source.fetchTopology();
  });

  // ─── curva di carico (vista compatta SVG-friendly) ───────
  app.get("/api/v1/installer/curve", {
    schema: {
      tags: ["installer"],
      response: { 200: heatCurveSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const c = await source.fetchHeatCurve();
    return { ...c, meta: { lastUpdatedAt: nowIso() } };
  });

  // ─── settings (any group) — generic read + write ─────────
  app.get("/api/v1/installer/settings/:group", {
    schema: {
      tags: ["installer"],
      params: z.object({ group: installerSettingsGroupSchema }),
      response: { 200: installerSettingsSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const { group } = req.params as { group: z.infer<typeof installerSettingsGroupSchema> };
    const snap = await source.fetchSettings(group);
    return { ...snap, meta: { lastUpdatedAt: nowIso() } };
  });

  app.put("/api/v1/installer/settings/:group", {
    schema: {
      tags: ["installer"],
      params: z.object({ group: installerSettingsGroupSchema }),
      body: installerSettingsPatchSchema,
      response: { 200: installerSettingsSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    await guard();
    const { group } = req.params as { group: z.infer<typeof installerSettingsGroupSchema> };
    const body = req.body as z.infer<typeof installerSettingsPatchSchema>;
    const snap = await source.setSettings(group, body.fields);
    return { ...snap, meta: { lastUpdatedAt: nowIso() } };
  });
};
