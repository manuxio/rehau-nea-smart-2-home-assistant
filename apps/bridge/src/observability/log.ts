import { pino } from "pino";
import type { Config } from "../config.js";

export const createLogger = (cfg: Config) =>
  pino({
    level: cfg.LOG_LEVEL,
    ...(cfg.LOG_FORMAT === "pretty"
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss.l" },
          },
        }
      : {}),
  });

export type Logger = ReturnType<typeof createLogger>;
