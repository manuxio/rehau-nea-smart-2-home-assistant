import { describe, it, expect } from "vitest";
import { roomIdFromName } from "./store.js";

describe("roomIdFromName — MQTT/HA-safe slug", () => {
  it("passes plain ASCII names through unchanged", () => {
    expect(roomIdFromName("Cucina", 2)).toBe("r-cucina-z2");
    expect(roomIdFromName("Arianna", 0)).toBe("r-arianna-z0");
  });

  it("replaces internal whitespace with a single dash", () => {
    expect(roomIdFromName("Master Bedroom", 1)).toBe("r-master-bedroom-z1");
    expect(roomIdFromName("Camera   Studio", 3)).toBe("r-camera-studio-z3");
  });

  it("strips accents (NFD + combining-marks pass)", () => {
    expect(roomIdFromName("Salòn", 4)).toBe("r-salon-z4");
    expect(roomIdFromName("Café", 5)).toBe("r-cafe-z5");
  });

  it("collapses non-alphanumeric punctuation to dashes — these were the chars that broke HA discovery", () => {
    // `/` would otherwise inject extra topic levels and produce a
    // unique_id outside HA's [a-zA-Z0-9_-] allow-list.
    expect(roomIdFromName("Bagno/Lavanderia", 6)).toBe("r-bagno-lavanderia-z6");
    // `+` and `#` are MQTT-reserved wildcards.
    expect(roomIdFromName("Camera + Studio", 7)).toBe("r-camera-studio-z7");
    expect(roomIdFromName("Stanza #1", 8)).toBe("r-stanza-1-z8");
    // Parens, ampersands, etc.
    expect(roomIdFromName("Soggiorno (sud)", 9)).toBe("r-soggiorno-sud-z9");
    expect(roomIdFromName("Cucina&Pranzo", 10)).toBe("r-cucina-pranzo-z10");
  });

  it("trims leading/trailing dashes", () => {
    expect(roomIdFromName(" Cucina ", 2)).toBe("r-cucina-z2");
    expect(roomIdFromName("/Cucina/", 2)).toBe("r-cucina-z2");
  });

  it("falls back to 'room' when the name has no usable characters", () => {
    expect(roomIdFromName("", 0)).toBe("r-room-z0");
    expect(roomIdFromName("???", 1)).toBe("r-room-z1");
    expect(roomIdFromName("   ", 2)).toBe("r-room-z2");
  });
});
