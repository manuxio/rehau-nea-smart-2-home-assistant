// Shared zod schemas used by the REST routes. We mirror the @rehau/types
// shapes; zod is both the runtime validator AND the source of truth for the
// generated OpenAPI spec (via fastify-type-provider-zod).

import { z } from "zod";
import {
  SETPOINT_HEAT_MIN,
  SETPOINT_HEAT_MAX,
  SETPOINT_STEP,
} from "@rehau/types";

export const metaSchema = z.object({ lastUpdatedAt: z.string().describe("ISO timestamp") });

export const roomModeSchema = z.enum([
  "standby",
  "normal",
  "reduced",
  "program",
  "program_override",
]);

export const systemModeSchema = z.enum([
  "heating_only",
  "cooling_only",
  "manual_heating",
  "manual_cooling",
]);

export const energyLevelSchema = z.enum(["normal", "reduced", "standby", "auto", "vacation"]);

export const fanLevelSchema = z.number().int().min(0).max(4);

export const roomSchema = z.object({
  id: z.string(),
  zone: z.number().int(),
  name: z.string(),
  temperature: z.number(),
  humidity: z.number(),
  setpointHeating: z.number(),
  setpointCooling: z.number(),
  setpointNormal: z.number(),
  setpointReduced: z.number(),
  setpointStandby: z.number(),
  mode: roomModeSchema,
  programOverride: z.boolean(),
  hasFan: z.boolean(),
  hasFlap: z.boolean(),
  hasLight: z.boolean(),
  fan: fanLevelSchema,
  flap: z.number().int().min(0).max(1),
  light: z.boolean(),
  fanRunning: z.boolean(),
  calibrationTemp: z.number(),
  calibrationHumidity: z.number(),
  programDailyId: z.number().int(),
  programWeeklyId: z.number().int(),
  floor: z.string(),
  lock: z.boolean(),
  autoStart: z.boolean(),
  windowDetection: z.boolean(),
  meta: metaSchema,
});

export const setpointBodySchema = z.object({
  value: z.number().min(SETPOINT_HEAT_MIN).max(SETPOINT_HEAT_MAX).multipleOf(SETPOINT_STEP),
});

export const roomModeBodySchema = z.object({
  mode: roomModeSchema,
  setpoint: z.number().min(SETPOINT_HEAT_MIN).max(SETPOINT_HEAT_MAX).optional(),
});

export const roomPatchSchema = z.object({
  setpoint: z.number().min(SETPOINT_HEAT_MIN).max(SETPOINT_HEAT_MAX).optional(),
  mode: roomModeSchema.optional(),
  light: z.boolean().optional(),
  lock: z.boolean().optional(),
  autoStart: z.boolean().optional(),
  windowDetection: z.boolean().optional(),
});

export const lightBodySchema = z.object({
  light: z.boolean(),
});

export const roomFlagsBodySchema = z.object({
  lock: z.boolean().optional(),
  autoStart: z.boolean().optional(),
  windowDetection: z.boolean().optional(),
});

export const systemStateSchema = z.object({
  installationName: z.string(),
  operatingMode: systemModeSchema,
  energyLevel: energyLevelSchema,
  outdoorTemp: z.number(),
  outdoorOffset: z.number(),
  seasonStart: z.string(),
  seasonEnd: z.string(),
  reachable: z.boolean(),
  fw: z.object({
    master: z.string(),
    web: z.string(),
    umodules: z.record(z.string()),
  }),
  uniqueCode: z.string(),
  ssid: z.string(),
  meta: metaSchema,
});

export const operatingModeBodySchema = z.object({ mode: systemModeSchema });
export const energyLevelBodySchema = z.object({ level: energyLevelSchema });

export const alarmSeveritySchema = z.enum(["info", "warning", "error", "critical"]);
export const messageSchema = z.object({
  id: z.string(),
  severity: alarmSeveritySchema,
  source: z.string(),
  code: z.string(),
  title: z.string(),
  detail: z.string(),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
});

export const dailyProgramSchema = z.object({
  id: z.number().int().min(1).max(10),
  name: z.string(),
  bits: z.array(z.number().int().min(0).max(1)).length(96),
});

export const dailyProgramWriteSchema = z.union([
  z.object({ bits: z.array(z.number().int().min(0).max(1)).length(96) }),
  z.object({
    intervals: z.array(
      z.object({
        start: z.string().regex(/^([01]?\d|2[0-4]):[0-5]\d$/),
        end: z.string().regex(/^([01]?\d|2[0-4]):[0-5]\d$/),
      }),
    ),
  }),
]);

export const weeklyProgramSchema = z.object({
  id: z.number().int().min(1).max(5),
  name: z.string(),
  days: z.tuple([
    z.number().int().min(1).max(10),
    z.number().int().min(1).max(10),
    z.number().int().min(1).max(10),
    z.number().int().min(1).max(10),
    z.number().int().min(1).max(10),
    z.number().int().min(1).max(10),
    z.number().int().min(1).max(10),
  ]),
});

export const weeklyProgramWriteSchema = z.object({
  monday: z.number().int().min(1).max(10),
  tuesday: z.number().int().min(1).max(10),
  wednesday: z.number().int().min(1).max(10),
  thursday: z.number().int().min(1).max(10),
  friday: z.number().int().min(1).max(10),
  saturday: z.number().int().min(1).max(10),
  sunday: z.number().int().min(1).max(10),
});

export const errorSchema = z.object({ error: z.string(), message: z.string().optional() });

// ─── installer ──────────────────────────────────────────────────

export const roomCalibrationSchema = z.object({
  zone: z.number().int().min(0).max(63),
  tempOffset: z.number().min(-5).max(5),
  humidityOffset: z.number().int().min(-25).max(25),
});

export const calibrationStateSchema = z.object({
  outdoor: z.number(),
  rooms: z.array(roomCalibrationSchema),
  meta: metaSchema,
});

export const calibrationWriteSchema = z.object({
  outdoor: z.number().min(-10).max(10).optional(),
  rooms: z.array(roomCalibrationSchema).optional(),
});

export const ioSchema = z.object({
  master: z.object({
    rz: z.array(z.number()),
    relay: z.array(z.number()),
    di: z.array(z.number()),
  }),
  umodules: z.record(
    z.object({
      relay: z.array(z.number()),
      di: z.array(z.number()),
      aiC: z.array(z.number().nullable()),
      aoPct: z.number(),
    }),
  ),
});

export const uptimeSchema = z.object({
  years: z.number().int().min(0),
  days: z.number().int().min(0),
  hours: z.number().int().min(0),
});

export const topologySchema = z.object({
  baseModules: z.number().int().min(0),
  rModules: z.number().int().min(0),
  uModules: z.number().int().min(0),
  rooms: z.number().int().min(0),
  mixedCircuits: z.number().int().min(0),
  dehumidifiers: z.number().int().min(0),
});

export const heatCurveSchema = z.object({
  slopeNormal: z.number(),
  slopeAbsent: z.number(),
  startNormal: z.number(),
  startAbsent: z.number(),
  reductionK: z.number(),
  minFlowNormalC: z.number(),
  minFlowAbsentC: z.number(),
  maxFlowNormalC: z.number(),
  maxFlowAbsentC: z.number(),
  meta: metaSchema,
});

// ─── installer · generic settings groups ─────────────────────

export const installerSettingsGroupSchema = z.enum([
  "curve",
  "heatcool",
  "devices",
  "functions",
  "pid",
  "fancoil",
]);

export const installerSettingFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  kind: z.enum(["number", "boolean"]),
  unit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  hint: z.string().optional(),
  value: z.union([z.number(), z.boolean()]),
});

export const installerSettingsSchema = z.object({
  group: installerSettingsGroupSchema,
  fields: z.array(installerSettingFieldSchema),
  meta: metaSchema,
});

export const installerSettingsPatchSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.number(), z.boolean()]),
    }),
  ),
});
