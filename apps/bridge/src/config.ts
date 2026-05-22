import { z } from "zod";

const csvNumbers = z
  .string()
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));

const roomFloorsSchema = z
  .string()
  .default("")
  .transform((s) => {
    const out: Record<number, string> = {};
    for (const pair of s.split(",").map((p) => p.trim()).filter(Boolean)) {
      const [idx, ...rest] = pair.split(":");
      const i = Number(idx);
      const floor = rest.join(":").trim();
      if (Number.isFinite(i) && floor) out[i] = floor;
    }
    return out;
  });

const envSchema = z.object({
  // device
  DEVICE_URL: z.string().url(),
  DEVICE_MODE: z.enum(["live", "mock"]).default("live"),
  DEVICE_INSTALLER_CODE: z.string().optional(),
  DEVICE_ID: z.string().optional(),
  DEVICE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  /** Mandatory cool-down between two consecutive device calls, in ms. */
  DEVICE_MIN_GAP_MS: z.coerce.number().int().min(0).default(150),
  INSTALLER_MAX_SESSION_S: z.coerce.number().int().positive().default(30),

  // http
  HTTP_PORT: z.coerce.number().int().positive().default(8080),
  HTTP_CORS_ORIGINS: z.string().default(""),
  JWT_SECRET: z.string().min(16),
  JWT_TTL: z.string().default("1h"),
  API_USER: z.string().default("admin"),
  API_PASSWORD_HASH: z.string(),
  ADMIN_ROLE: z.enum(["user", "installer"]).default("installer"),

  // installation
  /**
   * Human-readable name for this REHAU installation. Lets multiple instances
   * coexist on the same MQTT broker / HA — used as:
   *   - HA device "name" (so two installations show up as e.g. "Casa" and "Ufficio")
   *   - slug component injected into the MQTT topic path
   */
  INSTALLATION_NAME: z.string().min(1).default("Casa"),

  // mqtt
  MQTT_URL: z.string().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_BASE_TOPIC: z.string().default("rehau"),
  MQTT_HA_DISCOVERY: z.coerce.boolean().default(true),
  MQTT_HA_DISCOVERY_PREFIX: z.string().default("homeassistant"),

  // polling (seconds)
  POLL_DASHBOARD_S: z.coerce.number().int().positive().default(30),
  POLL_ROOMS_S: z.coerce.number().int().positive().default(15),
  POLL_ROOM_DETAIL_S: z.coerce.number().int().positive().default(60),
  POLL_MESSAGES_S: z.coerce.number().int().positive().default(300),
  POLL_IO_S: z.coerce.number().int().positive().default(10),
  // Calibration auto-poll cadence. Calibration lives behind an installer
  // session (full open/close per fetch), so we keep it slow by default.
  // 0 disables the auto-poll entirely; the force-refresh button in the
  // SPA (POST /api/v1/installer/refresh) and the existing Installer-tab
  // GET still trigger one-shot fetches on demand.
  POLL_CALIBRATION_S: z.coerce.number().int().nonnegative().default(180),
  EXPOSE_IO: z.coerce.boolean().default(true),
  EXPOSE_CALIBRATION: z.coerce.boolean().default(false),

  // ui-only mapping. Legacy: when /data/state.json doesn't yet have
  // floors set by the user, ROOM_FLOORS env var is used as the seed.
  // SPA edits override this and persist to STATE_FILE.
  ROOM_FLOORS: roomFloorsSchema,

  // Persistent state file path (HA addon volume). Holds user-editable
  // floors + scenes. /data is the supervisor-mounted persistent dir.
  STATE_FILE: z.string().default("/data/state.json"),

  // logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
});

export type Config = z.infer<typeof envSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
};

/** True when installer-tier endpoints can be reached at all. */
export const hasInstallerAccess = (cfg: Config): boolean =>
  Boolean(cfg.DEVICE_INSTALLER_CODE);
