// Thin wrapper around mqtt.js that:
//   - publishes Last-Will on connect → marks availability=offline when we drop
//   - exposes typed publish/subscribe
//   - retries on disconnect with exponential backoff (mqtt.js handles this)

import mqtt, { type MqttClient } from "mqtt";
import type { Logger } from "../observability/log.js";

export interface MqttClientOptions {
  url: string;
  username?: string | undefined;
  password?: string | undefined;
  clientId: string;
  availabilityTopic: string;
  logger: Logger;
}

export class TypedMqttClient {
  private client: MqttClient | null = null;
  private connected = false;
  private handlers: ((topic: string, payload: string) => void)[] = [];

  constructor(private readonly opts: MqttClientOptions) {}

  async start(): Promise<void> {
    const { url, username, password, clientId, availabilityTopic, logger } = this.opts;
    logger.info({ url, clientId }, "mqtt connecting");
    this.client = mqtt.connect(url, {
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      clientId,
      reconnectPeriod: 5_000,
      will: {
        topic: availabilityTopic,
        payload: Buffer.from("offline"),
        qos: 1,
        retain: true,
      },
    });

    this.client.on("connect", () => {
      this.connected = true;
      logger.info("mqtt connected");
      this.publish(availabilityTopic, "online", { retain: true });
    });
    this.client.on("reconnect", () => logger.info("mqtt reconnecting"));
    this.client.on("offline", () => {
      this.connected = false;
      logger.warn("mqtt offline");
    });
    this.client.on("error", (err) => logger.error({ err }, "mqtt error"));
    this.client.on("close", () => {
      this.connected = false;
    });
    this.client.on("message", (topic, payload) => {
      const text = payload.toString("utf8");
      for (const h of this.handlers) h(topic, text);
    });
  }

  isConnected(): boolean { return this.connected; }

  publish(topic: string, payload: string | object, options: { retain?: boolean; qos?: 0 | 1 | 2 } = {}): void {
    if (!this.client) return;
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    this.client.publish(topic, body, {
      qos: options.qos ?? 1,
      retain: options.retain ?? false,
    });
  }

  subscribe(topic: string): void {
    if (!this.client) return;
    this.client.subscribe(topic, { qos: 1 });
  }

  onMessage(handler: (topic: string, payload: string) => void): void {
    this.handlers.push(handler);
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    // Best-effort offline marker before closing.
    this.publish(this.opts.availabilityTopic, "offline", { retain: true });
    await new Promise<void>((resolve) => {
      this.client!.end(false, {}, () => resolve());
    });
  }
}
