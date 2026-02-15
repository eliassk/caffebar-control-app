/**
 * MQTT light integration.
 *
 * Connects to an MQTT broker, subscribes to state topics from the
 * Helvar lighting gateway, and exposes MQTT-based lights as standard
 * MappedEntity objects so the frontend can treat them identically to
 * Home Assistant lights.
 *
 * Three light types are supported:
 *   - toggle:  on/off only (level 0 or 100)
 *   - dimmer:  0-100 brightness slider
 *   - rgbw:    4 separate MQTT groups (R/G/B/W channels)
 */

import { readFileSync, existsSync } from "node:fs";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import type { MappedEntity } from "./entities.js";
import { triggerBroadcast } from "./stream.js";

// ─── Config types ───────────────────────────────────────────────────

interface MqttChannel {
  router_id: string;
  group_id: number;
}

interface MqttLightToggle {
  id: string;
  name: string;
  type: "toggle";
  router_id: string;
  group_id: number;
}

interface MqttLightDimmer {
  id: string;
  name: string;
  type: "dimmer";
  router_id: string;
  group_id: number;
}

interface RgbwCalibration {
  r: number; // 0.0–1.0, scales red channel output
  g: number; // 0.0–1.0, scales green channel output
  b: number; // 0.0–1.0, scales blue channel output
  w: number; // 0.0–1.0, scales white channel output
}

const DEFAULT_CALIBRATION: RgbwCalibration = { r: 1.0, g: 1.0, b: 1.0, w: 1.0 };

interface MqttLightRgbw {
  id: string;
  name: string;
  type: "rgbw";
  channels: {
    r: MqttChannel;
    g: MqttChannel;
    b: MqttChannel;
    w: MqttChannel;
  };
  /** Optional per-channel calibration to compensate for LED brightness differences. */
  calibration?: Partial<RgbwCalibration>;
}

type MqttLightConfig = MqttLightToggle | MqttLightDimmer | MqttLightRgbw;

interface MqttConfig {
  broker?: string;
  base_topic: string;
  username?: string;
  password?: string;
  lights: MqttLightConfig[];
}

// ─── State ──────────────────────────────────────────────────────────

/** Per MQTT group level (0-100), keyed by "router_id/group_id". */
const groupLevels = new Map<string, number>();

/** Lookup: "router_id/group_id" -> set of light config IDs that use it. */
const groupToLights = new Map<string, Set<string>>();

/** Lookup: light config ID -> config. */
const lightById = new Map<string, MqttLightConfig>();

let config: MqttConfig | null = null;
let client: MqttClient | null = null;

// ─── Helpers ────────────────────────────────────────────────────────

function groupKey(routerId: string, groupId: number): string {
  return `${routerId}/${groupId}`;
}

function entityIdFor(lightId: string): string {
  return `mqtt_light.${lightId}`;
}

function lightIdFromEntityId(entityId: string): string | null {
  if (!entityId.startsWith("mqtt_light.")) return null;
  return entityId.slice("mqtt_light.".length);
}

// ─── RGBW color science ─────────────────────────────────────────────

const GAMMA = 2.2;

/**
 * Convert an sRGB component (0-255, gamma-encoded for screens) to a
 * linear LED drive level (0-100). This compensates for the perceptual
 * non-linearity: sRGB 128 ≈ 21.6% linear, not 50%.
 */
function srgbToLinear(srgb: number): number {
  const normalized = Math.max(0, Math.min(1, srgb / 255));
  return Math.pow(normalized, GAMMA) * 100;
}

/**
 * Convert a linear LED drive level (0-100) back to an sRGB component
 * (0-255) for display in the UI color picker.
 */
function linearToSrgb(level: number): number {
  const normalized = Math.max(0, Math.min(1, level / 100));
  return Math.round(Math.pow(normalized, 1 / GAMMA) * 255);
}

/** Get resolved calibration for an RGBW light (fills in defaults). */
function getCalibration(light: MqttLightRgbw): RgbwCalibration {
  if (!light.calibration) return DEFAULT_CALIBRATION;
  return {
    r: light.calibration.r ?? 1.0,
    g: light.calibration.g ?? 1.0,
    b: light.calibration.b ?? 1.0,
    w: light.calibration.w ?? 1.0,
  };
}

/**
 * Extract the white component from linear RGB values and add it to
 * the white channel. This offloads the shared brightness to the
 * dedicated W LED, producing cleaner whites and pastels.
 *
 * Returns { r, g, b, w } as linear LED drive levels (0-100).
 */
function extractWhite(
  rLin: number,
  gLin: number,
  bLin: number,
  wLin: number
): { r: number; g: number; b: number; w: number } {
  const whiteComponent = Math.min(rLin, gLin, bLin);
  return {
    r: rLin - whiteComponent,
    g: gLin - whiteComponent,
    b: bLin - whiteComponent,
    w: Math.min(100, wLin + whiteComponent),
  };
}

// ─── Init ───────────────────────────────────────────────────────────

export function initMqtt(configPath: string): void {
  if (!existsSync(configPath)) {
    console.log("MQTT: No config at", configPath, "— MQTT lights disabled.");
    return;
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    config = JSON.parse(raw) as MqttConfig;
  } catch (err) {
    console.error("MQTT: Failed to parse config:", err);
    return;
  }

  if (!config.lights || config.lights.length === 0) {
    console.log("MQTT: No lights configured — MQTT lights disabled.");
    return;
  }

  // Build lookup tables
  for (const light of config.lights) {
    if (light.type === "rgbw") {
      const ch = (light as MqttLightRgbw).channels;
      if (!ch?.r || !ch?.g || !ch?.b || !ch?.w) {
        console.warn("MQTT: Skipping rgbw light with invalid channels:", light.id);
        continue;
      }
    }
    lightById.set(light.id, light);
    if (light.type === "rgbw") {
      const ch = (light as MqttLightRgbw).channels;
      for (const key of ["r", "g", "b", "w"] as const) {
        const c = ch[key];
        const k = groupKey(c.router_id, c.group_id);
        if (!groupToLights.has(k)) groupToLights.set(k, new Set());
        groupToLights.get(k)!.add(light.id);
      }
    } else {
      const k = groupKey(light.router_id, light.group_id);
      if (!groupToLights.has(k)) groupToLights.set(k, new Set());
      groupToLights.get(k)!.add(light.id);
    }
  }

  // Connection settings — env vars take precedence over config file
  const broker = process.env.MQTT_BROKER ?? config.broker ?? "mqtt://localhost:1883";
  const username = process.env.MQTT_USERNAME ?? config.username;
  const password = process.env.MQTT_PASSWORD ?? config.password;

  const opts: mqtt.IClientOptions = {
    clientId: `coffeebar-${Date.now()}`,
  };
  if (username) opts.username = username;
  if (password) opts.password = password;

  client = mqtt.connect(broker, opts);

  client.on("connect", () => {
    console.log(`MQTT: Connected to ${broker}`);
    // Subscribe to all state topics
    const stateTopic = `${config!.base_topic}/state/#`;
    client!.subscribe(stateTopic, { qos: 1 }, (err) => {
      if (err) console.error("MQTT: Subscribe failed:", err);
      else console.log(`MQTT: Subscribed to ${stateTopic}`);
    });
  });

  client.on("message", (topic, payload) => {
    handleMessage(topic, payload);
  });

  client.on("error", (err) => {
    console.error("MQTT: Connection error:", err.message);
  });

  client.on("offline", () => {
    console.warn("MQTT: Client offline, will retry...");
  });

  console.log(`MQTT: Initialised with ${config.lights.length} light(s).`);
}

// ─── Message handling ───────────────────────────────────────────────

function handleMessage(topic: string, payload: Buffer): void {
  if (!config) return;

  // Expected topic: {base_topic}/state/{router_id}/{group_id}
  const prefix = `${config.base_topic}/state/`;
  if (!topic.startsWith(prefix)) return;

  const rest = topic.slice(prefix.length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx < 0) return;

  const routerId = rest.slice(0, slashIdx);
  const groupId = parseInt(rest.slice(slashIdx + 1), 10);
  if (Number.isNaN(groupId)) return;

  try {
    const data = JSON.parse(payload.toString()) as { level?: number; scene?: number };
    if (typeof data.level === "number") {
      const key = groupKey(routerId, groupId);
      const oldLevel = groupLevels.get(key);
      groupLevels.set(key, data.level);

      // Only broadcast if this group is used by a configured light and level changed
      if (groupToLights.has(key) && oldLevel !== data.level) {
        triggerBroadcast();
      }
    }
  } catch {
    // Ignore malformed payloads
  }
}

// ─── Entity mapping ─────────────────────────────────────────────────

/** Get the current level (0-100) for a group, defaulting to 0. */
function getLevel(routerId: string, groupId: number): number {
  return groupLevels.get(groupKey(routerId, groupId)) ?? 0;
}

/** Convert a single MQTT light config + state into a MappedEntity. */
function lightToEntity(light: MqttLightConfig): MappedEntity {
  const entity_id = entityIdFor(light.id);

  if (light.type === "toggle") {
    const level = getLevel(light.router_id, light.group_id);
    return {
      entity_id,
      state: level > 0 ? "on" : "off",
      attributes: {
        friendly_name: light.name,
        supported_color_modes: ["onoff"],
      },
      friendly_name: light.name,
      icon: "mdi:light-switch",
      domain: "light",
    };
  }

  if (light.type === "dimmer") {
    const level = getLevel(light.router_id, light.group_id);
    return {
      entity_id,
      state: level > 0 ? "on" : "off",
      attributes: {
        friendly_name: light.name,
        brightness: Math.round((level / 100) * 255),
        supported_color_modes: ["brightness"],
      },
      friendly_name: light.name,
      icon: "mdi:lightbulb-on",
      domain: "light",
    };
  }

  if (light.type !== "rgbw") {
    const fallback = light as { id: string; name: string; type: string };
    console.warn("MQTT: Unknown light type:", fallback.type, "for", fallback.id);
    return {
      entity_id,
      state: "off",
      attributes: { friendly_name: fallback.name, supported_color_modes: ["onoff"] },
      friendly_name: fallback.name,
      icon: "mdi:lightbulb",
      domain: "light",
    };
  }

  const rgbw = light as MqttLightRgbw;
  const ch = rgbw.channels;
  if (!ch?.r || !ch?.g || !ch?.b || !ch?.w) {
    console.warn("MQTT: rgbw light has invalid channels:", light.id);
    return {
      entity_id,
      state: "off",
      attributes: { friendly_name: light.name, supported_color_modes: ["rgbw"] },
      friendly_name: light.name,
      icon: "mdi:led-strip-variant",
      domain: "light",
    };
  }

  // rgbw — read raw levels and reverse the color pipeline for the UI
  const rawR = getLevel(ch.r.router_id, ch.r.group_id);
  const rawG = getLevel(ch.g.router_id, ch.g.group_id);
  const rawB = getLevel(ch.b.router_id, ch.b.group_id);
  const rawW = getLevel(ch.w.router_id, ch.w.group_id);
  const anyOn = rawR > 0 || rawG > 0 || rawB > 0 || rawW > 0;

  // Reverse calibration: raw level on strip → uncalibrated linear level
  const cal = getCalibration(light);
  const linR = cal.r > 0 ? rawR / cal.r : 0;
  const linG = cal.g > 0 ? rawG / cal.g : 0;
  const linB = cal.b > 0 ? rawB / cal.b : 0;
  const linW = cal.w > 0 ? rawW / cal.w : 0;

  // Reverse white extraction: add white component back into RGB
  const reconR = Math.min(100, linR + linW);
  const reconG = Math.min(100, linG + linW);
  const reconB = Math.min(100, linB + linW);

  return {
    entity_id,
    state: anyOn ? "on" : "off",
    attributes: {
      friendly_name: light.name,
      brightness: 255,
      rgb_color: [
        linearToSrgb(reconR),
        linearToSrgb(reconG),
        linearToSrgb(reconB),
      ],
      white_value: linearToSrgb(linW),
      supported_color_modes: ["rgbw"],
    },
    friendly_name: light.name,
    icon: "mdi:led-strip-variant",
    domain: "light",
  };
}

/** Get all configured MQTT lights as MappedEntity objects. */
export function getMqttEntities(): MappedEntity[] {
  if (!config) return [];
  return config.lights.map(lightToEntity);
}

/** Check whether an entity_id belongs to an MQTT light. */
export function isMqttEntity(entityId: string): boolean {
  const id = lightIdFromEntityId(entityId);
  return id !== null && lightById.has(id);
}

// ─── Service call handling ──────────────────────────────────────────

/** Publish a level command to the MQTT gateway. */
function publishLevel(routerId: string, groupId: number, level: number, fadeMs?: number): void {
  if (!client || !config) return;
  const topic = `${config.base_topic}/cmd/${routerId}/${groupId}/level`;
  const payload: { level: number; fade_ms?: number } = {
    level: Math.max(0, Math.min(100, Math.round(level))),
  };
  if (typeof fadeMs === "number" && fadeMs > 0) payload.fade_ms = fadeMs;
  client.publish(topic, JSON.stringify(payload), { qos: 1 });

  // Optimistically update local state so the next getEntities() reflects it
  groupLevels.set(groupKey(routerId, groupId), payload.level);
}

/**
 * Handle a service call for an MQTT entity.
 * Maps HA-style service calls (turn_on, turn_off, toggle) to MQTT level commands.
 */
export async function handleMqttService(
  _domain: string,
  service: string,
  entityId: string,
  data?: Record<string, unknown>
): Promise<void> {
  const id = lightIdFromEntityId(entityId);
  if (!id) throw new Error(`Unknown MQTT entity: ${entityId}`);
  const light = lightById.get(id);
  if (!light) throw new Error(`Unknown MQTT entity: ${entityId}`);

  const fadeMs = typeof data?.fade_ms === "number" ? data.fade_ms : undefined;

  if (light.type === "toggle") {
    if (service === "turn_on") {
      publishLevel(light.router_id, light.group_id, 100, fadeMs);
    } else if (service === "turn_off") {
      publishLevel(light.router_id, light.group_id, 0, fadeMs);
    } else if (service === "toggle") {
      const current = getLevel(light.router_id, light.group_id);
      publishLevel(light.router_id, light.group_id, current > 0 ? 0 : 100, fadeMs);
    }
    return;
  }

  if (light.type === "dimmer") {
    if (service === "turn_on") {
      // If brightness provided (0-255), convert to 0-100
      const brightness = typeof data?.brightness === "number" ? data.brightness : 255;
      const level = Math.round((brightness / 255) * 100);
      publishLevel(light.router_id, light.group_id, level, fadeMs);
    } else if (service === "turn_off") {
      publishLevel(light.router_id, light.group_id, 0, fadeMs);
    } else if (service === "toggle") {
      const current = getLevel(light.router_id, light.group_id);
      if (current > 0) {
        publishLevel(light.router_id, light.group_id, 0, fadeMs);
      } else {
        publishLevel(light.router_id, light.group_id, 100, fadeMs);
      }
    }
    return;
  }

  // rgbw
  if (service === "turn_off") {
    publishLevel(light.channels.r.router_id, light.channels.r.group_id, 0, fadeMs);
    publishLevel(light.channels.g.router_id, light.channels.g.group_id, 0, fadeMs);
    publishLevel(light.channels.b.router_id, light.channels.b.group_id, 0, fadeMs);
    publishLevel(light.channels.w.router_id, light.channels.w.group_id, 0, fadeMs);
    return;
  }

  if (service === "toggle") {
    const rLevel = getLevel(light.channels.r.router_id, light.channels.r.group_id);
    const gLevel = getLevel(light.channels.g.router_id, light.channels.g.group_id);
    const bLevel = getLevel(light.channels.b.router_id, light.channels.b.group_id);
    const wLevel = getLevel(light.channels.w.router_id, light.channels.w.group_id);
    const anyOn = rLevel > 0 || gLevel > 0 || bLevel > 0 || wLevel > 0;
    if (anyOn) {
      publishLevel(light.channels.r.router_id, light.channels.r.group_id, 0, fadeMs);
      publishLevel(light.channels.g.router_id, light.channels.g.group_id, 0, fadeMs);
      publishLevel(light.channels.b.router_id, light.channels.b.group_id, 0, fadeMs);
      publishLevel(light.channels.w.router_id, light.channels.w.group_id, 0, fadeMs);
    } else {
      publishLevel(light.channels.r.router_id, light.channels.r.group_id, 100, fadeMs);
      publishLevel(light.channels.g.router_id, light.channels.g.group_id, 100, fadeMs);
      publishLevel(light.channels.b.router_id, light.channels.b.group_id, 100, fadeMs);
      publishLevel(light.channels.w.router_id, light.channels.w.group_id, 100, fadeMs);
    }
    return;
  }

  if (service === "turn_on") {
    const rgb = Array.isArray(data?.rgb_color) ? (data.rgb_color as number[]) : null;
    const whiteValue = typeof data?.white_value === "number" ? data.white_value : null;
    const cal = getCalibration(light);

    if (rgb && rgb.length >= 3) {
      // 1. Gamma-correct sRGB (0-255) → linear LED levels (0-100)
      let rLin = srgbToLinear(rgb[0]);
      let gLin = srgbToLinear(rgb[1]);
      let bLin = srgbToLinear(rgb[2]);

      // 2. White extraction — offload shared component to W LED
      //    Only extract into W when the caller didn't explicitly set white_value
      const currentW = whiteValue !== null ? srgbToLinear(whiteValue) : getLevel(light.channels.w.router_id, light.channels.w.group_id);
      const { r: finalR, g: finalG, b: finalB, w: extractedW } = extractWhite(rLin, gLin, bLin, currentW);
      rLin = finalR;
      gLin = finalG;
      bLin = finalB;

      // 3. Apply per-channel calibration
      publishLevel(light.channels.r.router_id, light.channels.r.group_id, rLin * cal.r, fadeMs);
      publishLevel(light.channels.g.router_id, light.channels.g.group_id, gLin * cal.g, fadeMs);
      publishLevel(light.channels.b.router_id, light.channels.b.group_id, bLin * cal.b, fadeMs);

      // Also update W with the extracted white (only when caller didn't explicitly set it separately)
      if (whiteValue === null) {
        publishLevel(light.channels.w.router_id, light.channels.w.group_id, extractedW * cal.w, fadeMs);
      }
    }

    if (whiteValue !== null) {
      // Gamma-correct the white value and apply calibration
      const wLin = srgbToLinear(whiteValue);
      publishLevel(light.channels.w.router_id, light.channels.w.group_id, wLin * cal.w, fadeMs);
    }

    // If neither rgb_color nor white_value provided, turn all channels to 100
    if (!rgb && whiteValue === null) {
      publishLevel(light.channels.r.router_id, light.channels.r.group_id, 100, fadeMs);
      publishLevel(light.channels.g.router_id, light.channels.g.group_id, 100, fadeMs);
      publishLevel(light.channels.b.router_id, light.channels.b.group_id, 100, fadeMs);
      publishLevel(light.channels.w.router_id, light.channels.w.group_id, 100, fadeMs);
    }
  }
}
