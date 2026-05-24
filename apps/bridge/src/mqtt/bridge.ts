// Wires the in-memory store ↔ MQTT broker.
//
// Outbound: store events → retained state topics.
// Inbound: subscribed *_set topics → commander writes (same lock as REST).
// On connect: publish Home Assistant discovery payloads.

import type { AlarmMessage, IOSnapshot, Room, SystemState } from "@rehau/types";
import type { Config } from "../config.js";
import type { Commander } from "../core/commander.js";
import type { Store } from "../core/store.js";
import type { Logger } from "../observability/log.js";
import { TypedMqttClient } from "./client.js";
import { buildAllDiscovery, type DiscoveryContext } from "./discovery.js";
import { matchCommand, slugify, topics, type Topics } from "./topics.js";

export interface MqttBridgeOptions {
  config: Config;
  store: Store;
  commander: Commander;
  logger: Logger;
  /** Optional ops sink — emit mqtt.connect / mqtt.disconnect /
   *  mqtt.discovery.publish so the diagnostic snapshot covers MQTT
   *  too. Optional so tests don't have to construct one. */
  ops?: { emit: (kind: string, summary: string, detail?: Record<string, unknown>) => void };
}

const ENERGY = new Set(["normal", "reduced", "standby", "auto", "vacation"] as const);
const OP_MODE = new Set(["heating_only", "cooling_only", "manual_heating", "manual_cooling"] as const);
const ROOM_MODE = new Set(["standby", "normal", "reduced", "program", "program_override"] as const);

export class MqttBridge {
  private readonly mqtt: TypedMqttClient;
  private readonly topics: Topics;
  private readonly deviceId: string;
  private readonly installationName: string;
  private readonly installationSlug: string;
  /**
   * Snapshot of the room capability flags we last published in HA discovery.
   * When this signature changes (e.g. a room turns out to have a light after
   * the first detail poll), we re-publish discovery so HA picks up the new
   * `switch`/`select` entities.
   */
  private capabilitySignature: string | null = null;

  constructor(private readonly o: MqttBridgeOptions) {
    const c = o.config;
    this.deviceId = c.DEVICE_ID || this.deriveDeviceId(o.store.getSystem().uniqueCode);
    this.installationName = c.INSTALLATION_NAME;
    this.installationSlug = slugify(c.INSTALLATION_NAME);
    this.topics = topics({
      base: c.MQTT_BASE_TOPIC,
      installationSlug: this.installationSlug,
      deviceId: this.deviceId,
    });
    this.mqtt = new TypedMqttClient({
      url: c.MQTT_URL ?? "",
      username: c.MQTT_USERNAME,
      password: c.MQTT_PASSWORD,
      clientId: `rehau-bridge-${this.deviceId}-${Math.random().toString(36).slice(2, 7)}`,
      availabilityTopic: this.topics.availability,
      logger: o.logger,
    });
  }

  private deriveDeviceId(uniqueCode: string): string {
    return (uniqueCode || "rehau").slice(-8) || "rehau";
  }

  async start(): Promise<void> {
    await this.mqtt.start();

    // Subscribe to all command topics.
    this.mqtt.subscribe(this.topics.setOperatingMode);
    this.mqtt.subscribe(this.topics.setEnergyLevel);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/setpoint/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/mode/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/light/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/lock/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/auto_start/set`);
    this.mqtt.subscribe(`${this.topics.root}/rooms/+/window_detection/set`);

    this.mqtt.onMessage(async (topic, payload) => {
      try { await this.handleCommand(topic, payload); }
      catch (err) { this.o.logger.warn({ err, topic }, "mqtt command failed"); }
    });

    // Publish initial state once we are connected; mqtt.js may not be ready
    // immediately so push state on every change too.
    this.publishCurrent();

    // Subscribe to store events for ongoing state updates.
    this.o.store.events.on("room.changed", (r) => this.publishRoom(r));
    this.o.store.events.on("system.changed", (s) => this.publishSystem(s));
    this.o.store.events.on("messages.changed", (m) => this.publishMessages(m));
    this.o.store.events.on("io.changed", (io) => this.publishIO(io));
    this.o.store.events.on("device.status", (s) => {
      this.mqtt.publish(this.topics.availability, s.online ? "online" : "offline", { retain: true });
    });
  }

  async stop(): Promise<void> {
    await this.mqtt.stop();
  }

  private publishCurrent(): void {
    setTimeout(() => {
      if (!this.mqtt.isConnected()) return this.publishCurrent();
      this.publishHaDiscovery();
      this.publishSystem(this.o.store.getSystem());
      this.publishMessages(this.o.store.getMessages());
      for (const r of this.o.store.listRooms()) this.publishRoom(r);
      const io = this.o.store.getIO();
      if (io) this.publishIO(io);
    }, 500);
  }

  private currentCapabilitySignature(): string {
    const rooms = this.o.store
      .listRooms()
      .map((r) => `${r.id}:${r.hasLight ? "L" : ""}${r.hasFan ? "F" : ""}${r.hasFlap ? "P" : ""}`)
      .join("|");
    // Shape of the I/O snapshot also drives discovery (how many AI / relay channels per umodule).
    const io = this.o.store.getIO();
    const ioSig = io
      ? `m:${io.master.rz.length}/${io.master.relay.length}/${io.master.di.length}|` +
        Object.entries(io.umodules)
          .map(([k, v]) => `${k}:${v.relay.length}/${v.di.length}/${v.aiC.length}`)
          .join(",")
      : "noio";
    // Heating vs cooling season also drives the climate entity's
    // modes / min_temp / max_temp / mode_state_template, so we want
    // discovery to be republished on a season flip.
    const opMode = this.o.store.getSystem().operatingMode;
    const season =
      opMode === "cooling_only" || opMode === "manual_cooling" ? "C" : "H";
    return `${rooms}||${ioSig}||s:${season}`;
  }

  /**
   * Publish HA discovery. Idempotent: a no-op if the room capability signature
   * hasn't changed since the last publish. This lets us recover from the
   * initial-state race (seed data has `hasLight=false` but the polled value
   * arrives moments later as `true`).
   */
  private publishHaDiscovery(): void {
    if (!this.o.config.MQTT_HA_DISCOVERY) return;
    const sig = this.currentCapabilitySignature();
    if (sig === this.capabilitySignature) return;
    const previous = this.capabilitySignature;
    this.capabilitySignature = sig;

    const ctx: DiscoveryContext = {
      prefix: this.o.config.MQTT_HA_DISCOVERY_PREFIX,
      topics: this.topics,
      deviceId: this.deviceId,
      installationName: this.installationName,
      installationSlug: this.installationSlug,
      fwVersion: `Master ${this.o.store.getSystem().fw.master}`,
      exposeCalibration: this.o.config.EXPOSE_CALIBRATION,
    };
    const messages = buildAllDiscovery(ctx, this.o.store.listRooms(), this.o.store.getSystem(), this.o.store.getIO());
    for (const m of messages) {
      this.mqtt.publish(m.topic, m.payload as object, { retain: true });
    }
    const reason = previous === null ? "initial" : "capabilities-changed";
    this.o.logger.info(
      { count: this.o.store.listRooms().length, reason },
      "ha discovery published",
    );
    this.o.ops?.emit("mqtt.discovery.publish", `${reason}, ${messages.length} entities`, {
      reason, count: messages.length,
    });
  }

  private publishRoom(r: Room): void {
    this.mqtt.publish(this.topics.roomState(r.id), r, { retain: true });
    // Capability flags can flip on the first detail poll; keep discovery in sync.
    this.publishHaDiscovery();
  }

  private publishSystem(s: SystemState): void {
    this.mqtt.publish(this.topics.systemState, s, { retain: true });
    // Season change (heating ↔ cooling) flips the climate entity's
    // modes list and the room-mode→HA-mode template. publishHaDiscovery
    // is a no-op when the capability signature hasn't changed, so calling
    // it on every system update is cheap and correct.
    this.publishHaDiscovery();
  }

  private publishMessages(m: AlarmMessage[]): void {
    this.mqtt.publish(this.topics.messages, m, { retain: true });
    // Derived boolean + count helpers for HA automations / dashboards.
    const active = m.filter((a) => !a.resolvedAt).length;
    this.mqtt.publish(this.topics.alarmsActive, active > 0 ? "true" : "false", { retain: true });
    this.mqtt.publish(this.topics.alarmsCount, String(active), { retain: true });
  }

  private publishIO(io: IOSnapshot): void {
    this.mqtt.publish(this.topics.io, io, { retain: true });
    // The IO shape (how many channels) drives discovery — re-publish if it
    // changed since last time (eg. a new U-module appeared on the bus).
    this.publishHaDiscovery();
  }

  private async handleCommand(topic: string, payload: string): Promise<void> {
    const match = matchCommand(this.topics, topic);
    if (!match) return;

    switch (match.kind) {
      case "setOperatingMode": {
        const m = payload.trim();
        if (OP_MODE.has(m as typeof OP_MODE extends Set<infer U> ? U : never)) {
          await this.o.commander.setOperatingMode(m as never);
        }
        return;
      }
      case "setEnergyLevel": {
        const l = payload.trim();
        if (ENERGY.has(l as typeof ENERGY extends Set<infer U> ? U : never)) {
          await this.o.commander.setEnergyLevel(l as never);
        }
        return;
      }
      case "roomSetpoint": {
        const v = Number(payload);
        if (Number.isFinite(v)) await this.o.commander.setRoomSetpoint(match.roomId, v);
        return;
      }
      case "roomMode": {
        const m = payload.trim();
        if (ROOM_MODE.has(m as typeof ROOM_MODE extends Set<infer U> ? U : never)) {
          await this.o.commander.setRoomMode(match.roomId, m as never);
        }
        return;
      }
      case "roomLight": {
        // HA `switch` discovery: payload_on="true", payload_off="false".
        // Accept the common variants HA might send.
        const v = payload.trim().toLowerCase();
        const next = v === "true" || v === "on" || v === "1";
        await this.o.commander.setRoomLight(match.roomId, next);
        return;
      }
      case "roomLock":
      case "roomAutoStart":
      case "roomWindowDetection": {
        const v = payload.trim().toLowerCase();
        const next = v === "true" || v === "on" || v === "1";
        const key =
          match.kind === "roomLock"
            ? "lock"
            : match.kind === "roomAutoStart"
              ? "autoStart"
              : "windowDetection";
        await this.o.commander.setRoomFlags(match.roomId, { [key]: next });
        return;
      }
    }
  }
}
