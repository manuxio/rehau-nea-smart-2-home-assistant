// Home Assistant MQTT discovery payloads. One retained message per entity
// published on connect; HA wires up climate + sensor + select entities.
//
// REHAU ↔ HA mode mapping is documented in README. We send the lossy version
// (off ↔ standby, heat ↔ normal/reduced, auto ↔ program/override) and also
// expose REHAU's native mode as a preset so power users see the truth.

import type { IOSnapshot, Room, SystemState } from "@rehau/types";
import type { Topics } from "./topics.js";

export interface DiscoveryContext {
  /** HA discovery prefix; default `homeassistant`. */
  prefix: string;
  topics: Topics;
  /** Stable id used in unique_id and device.identifiers. */
  deviceId: string;
  /** Human-readable installation name, used in HA `device.name`. */
  installationName: string;
  /** ASCII slug — keeps unique_ids stable across renames-with-same-slug. */
  installationSlug: string;
  fwVersion: string;
  /** When true, publish diagnostic sensors for per-room and outdoor calibration offsets. */
  exposeCalibration: boolean;
}

export interface DiscoveryMessage {
  topic: string;
  payload: unknown;
}

const deviceBlock = (ctx: DiscoveryContext) => ({
  identifiers: [`rehau_${ctx.installationSlug}_${ctx.deviceId}`],
  name: ctx.installationName,
  manufacturer: "REHAU",
  model: "Nea Smart 2.0",
  sw_version: ctx.fwVersion,
});

// JINJA inline mappings — must be one-liners. Active-mode words
// (`heat` vs `cool`) are baked in at discovery time based on the
// system's current operating mode; the bridge republishes discovery
// whenever the season flips (see capabilitySignature in bridge.ts).
// That way HA's climate card only ever shows the dropdown choices
// that actually do something for the current season.
const roomModeToHaJinja = (active: "heat" | "cool"): string =>
  `{{ {'standby':'off','normal':'${active}','reduced':'${active}','program':'auto','program_override':'auto'}.get(value_json.mode, 'off') }}`;

const haModeToRoomJinja = (): string =>
  // Both `heat` and `cool` map back to `normal` — the device decides
  // heating vs cooling from the global operating mode, not per-room.
  "{{ {'off':'standby','heat':'normal','cool':'normal','auto':'program'}.get(value, 'normal') }}";

const isSystemCooling = (s: SystemState): boolean =>
  s.operatingMode === "cooling_only" || s.operatingMode === "manual_cooling";

// REHAU exposes 5 fancoil speeds via FV0..FV4 (configured) and a separate
// fanRunning flag (motor actually spinning). We expose the *effective* speed:
// the configured level when running, "Spento" otherwise — that's the value
// the user sees on the REHAU display, in plain Italian.
const FAN_SPEED_STATE_JINJA =
  "{% if value_json.fanRunning %}" +
  "{{ ['Spento','Bassa','Media','Alta','Massima'][value_json.fan|int] }}" +
  "{% else %}Spento{% endif %}";

export const buildRoomClimate = (
  ctx: DiscoveryContext,
  room: Room,
  system: SystemState,
): DiscoveryMessage => {
  const cooling = isSystemCooling(system);
  const haActiveMode: "heat" | "cool" = cooling ? "cool" : "heat";
  return ({
  topic: `${ctx.prefix}/climate/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}/config`,
  payload: {
    name: room.name,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}`,
    availability_topic: ctx.topics.availability,
    current_temperature_topic: ctx.topics.roomState(room.id),
    // Render Python `None` for the no-defaults nullable fields so HA shows
    // "unavailable" instead of "0" / blank. Otherwise an un-polled Room
    // would surface phantom 0°C readings in HA dashboards.
    current_temperature_template:
      "{% if value_json.temperature is none %}unknown{% else %}{{ value_json.temperature }}{% endif %}",
    current_humidity_topic: ctx.topics.roomState(room.id),
    current_humidity_template:
      "{% if value_json.humidity is none %}unknown{% else %}{{ value_json.humidity }}{% endif %}",
    temperature_state_topic: ctx.topics.roomState(room.id),
    // Whichever season is active populates one slot; the other is null.
    // Pick whichever is non-none. (See poller pollRoomDetail routing.)
    temperature_state_template:
      "{% set sp = value_json.setpointHeating if value_json.setpointHeating is not none else value_json.setpointCooling %}" +
      "{% if sp is none %}unknown{% else %}{{ sp }}{% endif %}",
    temperature_command_topic: ctx.topics.roomSetpointSet(room.id),
    // Range matches the active season — heating 5–31, cooling 15–35.
    // REHAU's <input id="RSH"> enforces the same bounds on the device
    // side, so we mirror them exactly and HA won't offer values REHAU
    // would reject.
    min_temp: cooling ? 15 : 5,
    max_temp: cooling ? 35 : 31,
    temp_step: 0.5,
    // Per the project rule: heating season exposes Off/Heat/Auto,
    // cooling season exposes Off/Cool/Auto. Discovery is republished
    // on every season change so the dropdown stays in sync.
    modes: cooling ? ["off", "cool", "auto"] : ["off", "heat", "auto"],
    mode_state_topic: ctx.topics.roomState(room.id),
    mode_state_template: roomModeToHaJinja(haActiveMode),
    mode_command_topic: ctx.topics.roomModeSet(room.id),
    mode_command_template: haModeToRoomJinja(),
    preset_modes: ["normal", "reduced", "program", "program_override", "standby"],
    preset_mode_state_topic: ctx.topics.roomState(room.id),
    preset_mode_value_template: "{{ value_json.mode }}",
    preset_mode_command_topic: ctx.topics.roomModeSet(room.id),
    // Fancoil speed and flap are exposed as separate `sensor` entities (see
    // buildRoomFanSpeedSensor / buildRoomFlapSensor). HA doesn't have a
    // read-only mode for climate's fan_mode/swing_mode — declaring them
    // without a command topic leaves the dropdown clickable but does nothing,
    // which is worse UX than putting the value on a plain sensor.
    device: deviceBlock(ctx),
  },
});
};

export const buildRoomHumiditySensor = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_humidity/config`,
  payload: {
    name: `${room.name} umidità`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_humidity`,
    state_topic: ctx.topics.roomState(room.id),
    value_template:
      "{% if value_json.humidity is none %}unknown{% else %}{{ value_json.humidity }}{% endif %}",
    unit_of_measurement: "%",
    device_class: "humidity",
    state_class: "measurement",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildOutdoorSensor = (ctx: DiscoveryContext): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor/config`,
  payload: {
    name: "Temperatura esterna",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.outdoorTemp }}",
    unit_of_measurement: "°C",
    device_class: "temperature",
    state_class: "measurement",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildOperatingModeSelect = (ctx: DiscoveryContext): DiscoveryMessage => ({
  topic: `${ctx.prefix}/select/rehau_${ctx.installationSlug}_${ctx.deviceId}_operating_mode/config`,
  payload: {
    name: "Modalità operativa",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_operating_mode`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.operatingMode }}",
    command_topic: ctx.topics.setOperatingMode,
    options: ["heating_only", "cooling_only", "manual_heating", "manual_cooling"],
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildEnergyLevelSelect = (ctx: DiscoveryContext): DiscoveryMessage => ({
  topic: `${ctx.prefix}/select/rehau_${ctx.installationSlug}_${ctx.deviceId}_energy_level/config`,
  payload: {
    name: "Livello energia",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_energy_level`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.energyLevel }}",
    command_topic: ctx.topics.setEnergyLevel,
    options: ["normal", "reduced", "standby", "auto", "vacation"],
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

/** Switch entity for the room light (only rooms with `hasLight === true`). */
export const buildRoomLightSwitch = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/switch/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_light/config`,
  payload: {
    name: `${room.name} luce`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_light`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{{ 'ON' if value_json.light else 'OFF' }}",
    command_topic: ctx.topics.roomLightSet(room.id),
    payload_on: "true",
    payload_off: "false",
    state_on: "ON",
    state_off: "OFF",
    icon: "mdi:lightbulb",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

const roomFlagSwitch = (
  ctx: DiscoveryContext,
  room: Room,
  slug: string,
  label: string,
  field: string,
  commandTopic: string,
  icon: string,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/switch/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_${slug}/config`,
  payload: {
    name: `${room.name} · ${label}`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_${slug}`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: `{{ 'ON' if value_json.${field} else 'OFF' }}`,
    command_topic: commandTopic,
    payload_on: "true",
    payload_off: "false",
    state_on: "ON",
    state_off: "OFF",
    icon,
    entity_category: "config",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildRoomLockSwitch = (ctx: DiscoveryContext, room: Room): DiscoveryMessage =>
  roomFlagSwitch(ctx, room, "lock", "Blocco display", "lock", ctx.topics.roomLockSet(room.id), "mdi:lock");

export const buildRoomAutoStartSwitch = (ctx: DiscoveryContext, room: Room): DiscoveryMessage =>
  roomFlagSwitch(
    ctx,
    room,
    "auto_start",
    "Auto avviamento",
    "autoStart",
    ctx.topics.roomAutoStartSet(room.id),
    "mdi:clock-start",
  );

/**
 * Diagnostic binary_sensor that mirrors REHAU's pink fancoil icon: ON while
 * the fancoil motor is actually spinning, OFF otherwise. The climate's
 * `fan_mode` already reports the active speed, but a discrete on/off signal
 * is more useful for automations ("if any fancoil running, kick the supply
 * pump") and dashboard chips.
 */
export const buildRoomFanRunningSensor = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_running/config`,
  payload: {
    name: `${room.name} · fancoil`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_running`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{{ 'ON' if value_json.fanRunning else 'OFF' }}",
    payload_on: "ON",
    payload_off: "OFF",
    device_class: "running",
    entity_category: "diagnostic",
    icon: "mdi:fan",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

/**
 * Effective fan speed in plain Italian: "Spento" when the motor is idle,
 * otherwise "Bassa/Media/Alta/Massima" matching REHAU's FV1..FV4 buttons.
 * Sensor (not climate `fan_mode`) so the value is unambiguously read-only:
 * REHAU's HTTP surface doesn't expose a write for fan speed.
 */
export const buildRoomFanSpeedSensor = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_speed/config`,
  payload: {
    name: `${room.name} · velocità fancoil`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_fan_speed`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: FAN_SPEED_STATE_JINJA,
    entity_category: "diagnostic",
    icon: "mdi:fan-speed-1",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

/**
 * Flap position. Read-only sensor for now — if/when REHAU's flap write path
 * is found, this can be promoted to a `switch` with a command topic.
 */
export const buildRoomFlapSensor = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_flap/config`,
  payload: {
    name: `${room.name} · aletta`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_flap`,
    state_topic: ctx.topics.roomState(room.id),
    value_template: "{{ 'ON' if value_json.flap == 1 else 'OFF' }}",
    payload_on: "ON",
    payload_off: "OFF",
    device_class: "opening",
    entity_category: "diagnostic",
    icon: "mdi:valve",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildRoomWindowDetectionSwitch = (ctx: DiscoveryContext, room: Room): DiscoveryMessage =>
  roomFlagSwitch(
    ctx,
    room,
    "window_detection",
    "Rilev. finestra aperta",
    "windowDetection",
    ctx.topics.roomWindowDetectionSet(room.id),
    "mdi:window-open-variant",
  );

/**
 * Boolean "any alarm active" sensor — drives push notifications and dashboard
 * status badges in HA without forcing automations to parse the JSON array.
 */
export const buildAlarmsBinarySensor = (ctx: DiscoveryContext): DiscoveryMessage => ({
  topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_active/config`,
  payload: {
    name: "Allarmi attivi",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_active`,
    state_topic: ctx.topics.alarmsActive,
    payload_on: "true",
    payload_off: "false",
    device_class: "problem",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

/**
 * Diagnostic sensors for the installer-tuned offsets — useful so users can see
 * at a glance whether a probe was trimmed and by how much. Read-only here;
 * writes go through /api/v1/installer/calibration (installer code required).
 */
export const buildRoomTempCalibrationSensor = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_temp/config`,
  payload: {
    name: `${room.name} · offset temperatura`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_temp`,
    state_topic: ctx.topics.roomState(room.id),
    value_template:
      "{% if value_json.calibrationTemp is none %}unknown{% else %}{{ value_json.calibrationTemp }}{% endif %}",
    unit_of_measurement: "°C",
    device_class: "temperature",
    state_class: "measurement",
    entity_category: "diagnostic",
    icon: "mdi:thermometer-plus",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildRoomHumidityCalibrationSensor = (
  ctx: DiscoveryContext,
  room: Room,
): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_humidity/config`,
  payload: {
    name: `${room.name} · offset umidità`,
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${room.id}_cal_humidity`,
    state_topic: ctx.topics.roomState(room.id),
    value_template:
      "{% if value_json.calibrationHumidity is none %}unknown{% else %}{{ value_json.calibrationHumidity }}{% endif %}",
    unit_of_measurement: "%",
    state_class: "measurement",
    entity_category: "diagnostic",
    icon: "mdi:water-percent",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildOutdoorOffsetSensor = (ctx: DiscoveryContext): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor_offset/config`,
  payload: {
    name: "Offset temperatura esterna",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_outdoor_offset`,
    state_topic: ctx.topics.systemState,
    value_template: "{{ value_json.outdoorOffset }}",
    unit_of_measurement: "°C",
    device_class: "temperature",
    state_class: "measurement",
    entity_category: "diagnostic",
    icon: "mdi:thermometer-plus",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

export const buildAlarmsCountSensor = (ctx: DiscoveryContext): DiscoveryMessage => ({
  topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_count/config`,
  payload: {
    name: "Allarmi attivi · numero",
    unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_alarms_count`,
    state_topic: ctx.topics.alarmsCount,
    state_class: "measurement",
    icon: "mdi:alert-circle-outline",
    entity_category: "diagnostic",
    availability_topic: ctx.topics.availability,
    device: deviceBlock(ctx),
  },
});

/**
 * Discovery for every I/O channel on the master + each U-module:
 *   • master RZ 1..8 → binary_sensor (zone relays)
 *   • master RELAY 1..4 → binary_sensor
 *   • master DI 1..4 → binary_sensor
 *   • umodule RELAY 1..4 → binary_sensor
 *   • umodule DI 1..4 → binary_sensor
 *   • umodule AI 1..4 → sensor (°C, may be null)
 *   • umodule AO → sensor (%, modulating output)
 *
 * Channel labels are generic. AI 1/2 on a mixed-circuit installation are
 * typically mandata/ritorno but we don't assume — rename in HA per wiring.
 */
export const buildIODiscovery = (
  ctx: DiscoveryContext,
  io: IOSnapshot,
): DiscoveryMessage[] => {
  const msgs: DiscoveryMessage[] = [];
  const ioTopic = ctx.topics.io;

  // All I/O entities except temperatures (AI °C) go in the "diagnostic"
  // section of the HA device card — they're internal signals, not primary
  // controls/measurements.
  const binarySensor = (
    suffix: string,
    name: string,
    template: string,
    icon?: string,
  ): DiscoveryMessage => ({
    topic: `${ctx.prefix}/binary_sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}/config`,
    payload: {
      name,
      unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}`,
      state_topic: ioTopic,
      value_template: template,
      payload_on: "1",
      payload_off: "0",
      entity_category: "diagnostic",
      ...(icon ? { icon } : {}),
      availability_topic: ctx.topics.availability,
      device: deviceBlock(ctx),
    },
  });

  const sensor = (
    suffix: string,
    name: string,
    template: string,
    unit: string,
    deviceClass?: string,
    icon?: string,
  ): DiscoveryMessage => ({
    topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}/config`,
    payload: {
      name,
      unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${suffix}`,
      state_topic: ioTopic,
      value_template: template,
      unit_of_measurement: unit,
      state_class: "measurement",
      entity_category: "diagnostic",
      ...(deviceClass ? { device_class: deviceClass } : {}),
      ...(icon ? { icon } : {}),
      availability_topic: ctx.topics.availability,
      device: deviceBlock(ctx),
    },
  });

  // Master RZ (zone-actuator relays) — show only as many as the device reports.
  for (let i = 0; i < io.master.rz.length; i++) {
    msgs.push(
      binarySensor(
        `master_rz_${i + 1}`,
        `Master · Zona ${i + 1} (RZ)`,
        `{{ value_json.master.rz[${i}] | int }}`,
        "mdi:valve",
      ),
    );
  }
  // Master RELAY 1..4
  for (let i = 0; i < io.master.relay.length; i++) {
    msgs.push(
      binarySensor(
        `master_relay_${i + 1}`,
        `Master · Relè ${i + 1}`,
        `{{ value_json.master.relay[${i}] | int }}`,
        "mdi:electric-switch",
      ),
    );
  }
  // Master DI 1..4
  for (let i = 0; i < io.master.di.length; i++) {
    msgs.push(
      binarySensor(
        `master_di_${i + 1}`,
        `Master · Ingresso ${i + 1} (DI)`,
        `{{ value_json.master.di[${i}] | int }}`,
        "mdi:electric-switch-closed",
      ),
    );
  }

  // Each U-module: relays, DIs, AIs (°C), AO (%).
  for (const [key, um] of Object.entries(io.umodules)) {
    const slug = key.replace(/[^A-Za-z0-9]+/g, "_").toLowerCase();
    const pretty = key.replace(/^umodule/, "Modulo-U ");
    const pathPrefix = `value_json.umodules['${key}']`;

    for (let i = 0; i < um.relay.length; i++) {
      msgs.push(
        binarySensor(
          `${slug}_relay_${i + 1}`,
          `${pretty} · Relè ${i + 1}`,
          `{{ ${pathPrefix}.relay[${i}] | int }}`,
          "mdi:electric-switch",
        ),
      );
    }
    for (let i = 0; i < um.di.length; i++) {
      msgs.push(
        binarySensor(
          `${slug}_di_${i + 1}`,
          `${pretty} · Ingresso ${i + 1} (DI)`,
          `{{ ${pathPrefix}.di[${i}] | int }}`,
          "mdi:electric-switch-closed",
        ),
      );
    }
    for (let i = 0; i < um.aiC.length; i++) {
      msgs.push({
        topic: `${ctx.prefix}/sensor/rehau_${ctx.installationSlug}_${ctx.deviceId}_${slug}_ai_${i + 1}/config`,
        payload: {
          // AI temperatures are kept OUT of the diagnostic section — they're
          // primary measurements (mandata/ritorno etc.) worth dashboarding.
          name: `${pretty} · AI ${i + 1} (temperatura)`,
          unique_id: `rehau_${ctx.installationSlug}_${ctx.deviceId}_${slug}_ai_${i + 1}`,
          state_topic: ioTopic,
          // Skip "null" values via the template (HA marks the entity as unavailable).
          value_template:
            `{% set v = ${pathPrefix}.aiC[${i}] %}` +
            `{% if v is none %}{{ 'unknown' }}{% else %}{{ v }}{% endif %}`,
          unit_of_measurement: "°C",
          device_class: "temperature",
          state_class: "measurement",
          availability_topic: ctx.topics.availability,
          device: deviceBlock(ctx),
        },
      });
    }
    msgs.push(
      sensor(
        `${slug}_ao`,
        `${pretty} · AO (modulazione)`,
        `{{ ${pathPrefix}.aoPct }}`,
        "%",
        undefined,
        "mdi:gauge",
      ),
    );
  }

  return msgs;
};

export const buildAllDiscovery = (
  ctx: DiscoveryContext,
  rooms: Room[],
  system: SystemState,
  io: IOSnapshot | null,
): DiscoveryMessage[] => [
  buildOutdoorSensor(ctx),
  buildOperatingModeSelect(ctx),
  buildEnergyLevelSelect(ctx),
  buildAlarmsBinarySensor(ctx),
  buildAlarmsCountSensor(ctx),
  ...(ctx.exposeCalibration ? [buildOutdoorOffsetSensor(ctx)] : []),
  ...rooms.flatMap((r) => {
    const msgs: DiscoveryMessage[] = [
      buildRoomClimate(ctx, r, system),
      buildRoomHumiditySensor(ctx, r),
      buildRoomLockSwitch(ctx, r),
      buildRoomAutoStartSwitch(ctx, r),
      buildRoomWindowDetectionSwitch(ctx, r),
    ];
    if (r.hasLight) msgs.push(buildRoomLightSwitch(ctx, r));
    if (r.hasFan) {
      msgs.push(buildRoomFanRunningSensor(ctx, r));
      msgs.push(buildRoomFanSpeedSensor(ctx, r));
    }
    if (r.hasFlap) msgs.push(buildRoomFlapSensor(ctx, r));
    if (ctx.exposeCalibration) {
      msgs.push(buildRoomTempCalibrationSensor(ctx, r));
      msgs.push(buildRoomHumidityCalibrationSensor(ctx, r));
    }
    return msgs;
  }),
  ...(io ? buildIODiscovery(ctx, io) : []),
];
