import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../../config.js";
import type { Store } from "../../core/store.js";
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
  store: Store;
}

const nowIso = (): string => new Date().toISOString();

export const registerInstallerRoutes = (
  app: FastifyInstance,
  { config, source, store }: InstallerRoutesDeps,
): void => {
  const guard = async () => {
    if (!source.hasInstaller || !config.DEVICE_INSTALLER_CODE) {
      const err = Object.assign(new Error("installer_disabled"), { statusCode: 503 });
      throw err;
    }
  };

  /**
   * Mirror calibration values into each Room so RoomDetail's read-only
   * Calibration card has data without going through the installer endpoint
   * itself. Called after every successful fetch / write of calibration.
   *
   * Why this lives here rather than in the poller: calibration requires an
   * installer session, which is expensive (CLAUDE.md §6); we'd rather
   * piggyback on the user's natural Installer-tab visits than poll on a
   * schedule. TODO.md §"Server-error visibility" Stage 8 will add an
   * opt-in low-frequency auto-poll for users who want the values fresh.
   */
  const mirrorCalibration = (snap: { rooms: RoomCalibration[] }): void => {
    for (const c of snap.rooms) {
      const room = store.getRoomByZone(c.zone);
      if (!room) continue;
      store.patchRoom(room.id, {
        calibrationTemp: c.tempOffset,
        calibrationHumidity: c.humidityOffset,
      });
    }
  };

  // ─── calibrazione ────────────────────────────────────────
  // Cache-first per POLLING-PLAN.md "SPA cache discipline" — boot warms
  // the cache, write paths invalidate. SPA reads never trigger a REHAU
  // round-trip on the happy path.
  app.get("/api/v1/installer/calibration", {
    schema: {
      tags: ["installer"],
      response: { 200: calibrationStateSchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    const cached = store.getCalibration();
    if (cached) return cached;
    await guard();
    const snap = await source.fetchCalibration();
    const full = { ...snap, meta: { lastUpdatedAt: nowIso() } };
    store.setCalibration(full);
    mirrorCalibration(snap);
    return full;
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
    const full = { ...fresh, meta: { lastUpdatedAt: nowIso() } };
    store.setCalibration(full);
    mirrorCalibration(fresh);
    return full;
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
    const cached = store.getIO();
    if (cached) return cached;
    await guard();
    const snap = await source.fetchIO();
    store.setIO(snap);
    return snap;
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
    const cached = store.getUptime();
    if (cached) return cached;
    await guard();
    const snap = await source.fetchUptime();
    store.setUptime(snap);
    return snap;
  });

  app.get("/api/v1/installer/diagnostics/topology", {
    schema: {
      tags: ["installer"],
      response: { 200: topologySchema, 503: errorSchema },
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    req.requireRole("installer");
    const cached = store.getTopology();
    if (cached) return cached;
    await guard();
    const snap = await source.fetchTopology();
    store.setTopology(snap);
    return snap;
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
    const cached = store.getHeatCurve();
    if (cached) return cached;
    await guard();
    const c = await source.fetchHeatCurve();
    const full = { ...c, meta: { lastUpdatedAt: nowIso() } };
    store.setHeatCurve(full);
    return full;
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
    const { group } = req.params as { group: z.infer<typeof installerSettingsGroupSchema> };
    const cached = store.getInstallerSettings(group);
    if (cached) return cached;
    await guard();
    const snap = await source.fetchSettings(group);
    const full = { ...snap, meta: { lastUpdatedAt: nowIso() } };
    store.setInstallerSettings(full);
    return full;
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
    const full = { ...snap, meta: { lastUpdatedAt: nowIso() } };
    store.setInstallerSettings(full);
    return full;
  });
};
