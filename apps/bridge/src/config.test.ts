import { describe, expect, it } from "vitest";
import { loadConfig, hasInstallerAccess } from "./config.js";

const baseEnv = {
  DEVICE_URL: "http://10.0.0.1",
  JWT_SECRET: "x".repeat(32),
  API_PASSWORD_HASH: "$2b$12$abc",
};

describe("loadConfig", () => {
  it("parses a minimal env", () => {
    const cfg = loadConfig({ ...baseEnv } as NodeJS.ProcessEnv);
    expect(cfg.HTTP_PORT).toBe(8080);
    expect(cfg.ADMIN_ROLE).toBe("installer");
    expect(cfg.MQTT_BASE_TOPIC).toBe("rehau");
    expect(cfg.EXPOSE_IO).toBe(true);
    expect(hasInstallerAccess(cfg)).toBe(false);
  });

  it("enables installer access when DEVICE_INSTALLER_CODE is set", () => {
    const cfg = loadConfig({ ...baseEnv, DEVICE_INSTALLER_CODE: "78602d11" } as NodeJS.ProcessEnv);
    expect(hasInstallerAccess(cfg)).toBe(true);
  });

  it("parses ROOM_FLOORS into an index→name map", () => {
    const cfg = loadConfig({
      ...baseEnv,
      ROOM_FLOORS: "0:Piano 1,1:Piano 1,2:Piano Terra",
    } as NodeJS.ProcessEnv);
    expect(cfg.ROOM_FLOORS).toEqual({ 0: "Piano 1", 1: "Piano 1", 2: "Piano Terra" });
  });

  it("rejects an invalid DEVICE_URL", () => {
    expect(() => loadConfig({ ...baseEnv, DEVICE_URL: "not-a-url" } as NodeJS.ProcessEnv)).toThrow();
  });

  it("rejects a too-short JWT_SECRET", () => {
    expect(() => loadConfig({ ...baseEnv, JWT_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow();
  });
});
