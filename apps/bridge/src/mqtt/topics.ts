// Topic builder. Centralizing this keeps the bridge in sync with the HA
// discovery payloads and the broker-facing client.

export interface TopicSpec {
  base: string;
  /** Installation slug — injected between base and deviceId so two installations
   * on the same broker don't collide (eg. `rehau/casa/<id>` vs `rehau/ufficio/<id>`). */
  installationSlug: string;
  deviceId: string;
}

/**
 * Lowercased ASCII slug — strips accents, collapses non-alphanum to `-`.
 * "Casa Bertini" → "casa-bertini", "Ufficio 2°" → "ufficio-2".
 */
export const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";

export const topics = (spec: TopicSpec) => {
  const root = `${spec.base}/${spec.installationSlug}/${spec.deviceId}`;
  return {
    root,
    availability: `${root}/availability`,
    systemState: `${root}/system/state`,
    setOperatingMode: `${root}/system/operating_mode/set`,
    setEnergyLevel: `${root}/system/energy_level/set`,
    messages: `${root}/messages`,
    alarmsActive: `${root}/alarms/active`,
    alarmsCount: `${root}/alarms/count`,
    io: `${root}/io`,
    roomState: (roomId: string): string => `${root}/rooms/${roomId}/state`,
    roomSetpointSet: (roomId: string): string => `${root}/rooms/${roomId}/setpoint/set`,
    roomModeSet: (roomId: string): string => `${root}/rooms/${roomId}/mode/set`,
    roomLightSet: (roomId: string): string => `${root}/rooms/${roomId}/light/set`,
    roomLockSet: (roomId: string): string => `${root}/rooms/${roomId}/lock/set`,
    roomAutoStartSet: (roomId: string): string => `${root}/rooms/${roomId}/auto_start/set`,
    roomWindowDetectionSet: (roomId: string): string => `${root}/rooms/${roomId}/window_detection/set`,
  };
};

export type Topics = ReturnType<typeof topics>;

/** Try to match an inbound topic to a known command pattern. */
export const matchCommand = (
  t: Topics,
  topic: string,
):
  | { kind: "setOperatingMode" }
  | { kind: "setEnergyLevel" }
  | { kind: "roomSetpoint"; roomId: string }
  | { kind: "roomMode"; roomId: string }
  | { kind: "roomLight"; roomId: string }
  | { kind: "roomLock"; roomId: string }
  | { kind: "roomAutoStart"; roomId: string }
  | { kind: "roomWindowDetection"; roomId: string }
  | null => {
  if (topic === t.setOperatingMode) return { kind: "setOperatingMode" };
  if (topic === t.setEnergyLevel) return { kind: "setEnergyLevel" };
  const m = topic.match(new RegExp(`^${t.root}/rooms/([^/]+)/(setpoint|mode|light|lock|auto_start|window_detection)/set$`));
  if (!m) return null;
  const roomId = m[1]!;
  switch (m[2]) {
    case "setpoint":          return { kind: "roomSetpoint", roomId };
    case "mode":              return { kind: "roomMode", roomId };
    case "light":             return { kind: "roomLight", roomId };
    case "lock":              return { kind: "roomLock", roomId };
    case "auto_start":        return { kind: "roomAutoStart", roomId };
    case "window_detection":  return { kind: "roomWindowDetection", roomId };
    default:                  return null;
  }
};
