import { seedRooms, seedSystem } from "@rehau/types/mocks";
import { describe, expect, it } from "vitest";
import { buildAllDiscovery, type DiscoveryContext } from "./discovery.js";
import { topics } from "./topics.js";

const ctx: DiscoveryContext = {
  prefix: "homeassistant",
  topics: topics({ base: "rehau", installationSlug: "casa", deviceId: "dev1" }),
  deviceId: "dev1",
  installationName: "Casa",
  installationSlug: "casa",
  fwVersion: "6.15",
  exposeCalibration: false,
};

const remoteSensorTopics = (rooms: typeof seedRooms): string[] =>
  buildAllDiscovery(ctx, rooms, seedSystem, null)
    .map((m) => m.topic)
    .filter((t) => t.endsWith("_remote_temperature/config"));

describe("remote temperature discovery", () => {
  it("publishes no remote temperature sensor for rooms without a remote sensor", () => {
    expect(remoteSensorTopics(seedRooms.map((r) => ({ ...r, remoteTemperature: null })))).toEqual([]);
  });

  it("publishes one sensor per room that reports a remote temperature", () => {
    const [first, ...rest] = seedRooms;
    const rooms = [{ ...first!, remoteTemperature: 23.8 }, ...rest.map((r) => ({ ...r, remoteTemperature: null }))];
    const msgs = buildAllDiscovery(ctx, rooms, seedSystem, null).filter((m) =>
      m.topic.endsWith("_remote_temperature/config"),
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.payload).toMatchObject({
      device_class: "temperature",
      state_class: "measurement",
      unit_of_measurement: "°C",
      state_topic: ctx.topics.roomState(first!.id),
    });
  });
});
