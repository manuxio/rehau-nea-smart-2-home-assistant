import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "../observability/log.js";
import { loadConfig } from "../config.js";
import { TypedMqttClient } from "./client.js";

const logger = createLogger(
  loadConfig({
    DEVICE_URL: "http://10.0.0.1",
    JWT_SECRET: "x".repeat(32),
    API_PASSWORD_HASH: "$2b$12$abc",
    LOG_LEVEL: "fatal",
  } as NodeJS.ProcessEnv),
);

let server: Server | null = null;
const sockets: Socket[] = [];

/**
 * Minimal fake broker: answers CONNECT with a CONNACK (when `ack` is set) and
 * then swallows everything, so QoS 1 publishes never get their PUBACK.
 */
const fakeBroker = async (ack: boolean): Promise<number> => {
  server = createServer((s) => {
    sockets.push(s);
    s.once("data", () => {
      if (ack) s.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
    });
    s.on("error", () => {});
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return (server.address() as { port: number }).port;
};

const client = (url: string) =>
  new TypedMqttClient({ url, clientId: "t", availabilityTopic: "t/availability", logger });

const timed = async (fn: () => Promise<void>): Promise<number> => {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
};

afterEach(async () => {
  for (const s of sockets.splice(0)) s.destroy();
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = null;
});

describe("TypedMqttClient.stop", () => {
  it("returns at once when the broker is unreachable", async () => {
    const c = client("mqtt://127.0.0.1:1");
    await c.start();
    await new Promise((r) => setTimeout(r, 200));
    expect(await timed(() => c.stop())).toBeLessThan(500);
  });

  it("returns at once when the broker never acknowledges the connection", async () => {
    const c = client(`mqtt://127.0.0.1:${await fakeBroker(false)}`);
    await c.start();
    await new Promise((r) => setTimeout(r, 200));
    expect(c.isConnected()).toBe(false);
    expect(await timed(() => c.stop())).toBeLessThan(500);
  });

  it("gives up waiting for the offline marker's PUBACK within the grace period", async () => {
    const c = client(`mqtt://127.0.0.1:${await fakeBroker(true)}`);
    await c.start();
    await new Promise((r) => setTimeout(r, 300));
    expect(c.isConnected()).toBe(true);
    // Under main.ts's 3 s shutdown killer, with margin.
    expect(await timed(() => c.stop())).toBeLessThan(2500);
  });
});
