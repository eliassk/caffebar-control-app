/**
 * Scene management — CRUD operations and scene application.
 *
 * Scenes are stored in `data/scenes.json`. On first load the module
 * checks for a legacy `config/scenes.json` and migrates it.
 * Saves use atomic write (tmp + rename) to prevent corruption.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { callService } from "./ha.js";
import { useDemoMode } from "./ha.js";
import { demoCallService } from "./demo.js";
import { isEntityAllowed, isServiceAllowed } from "./allowlist.js";
import { isMqttEntity, handleMqttService } from "./mqtt.js";

export interface SceneEntity {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
}

export interface Scene {
  id: string;
  name: string;
  entities: SceneEntity[];
  icon?: string;
  color?: string;
}

export interface ScenesConfig {
  scenes: Scene[];
}

function getDataDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "..", "..", "data");
}

function getScenesPath(): string {
  return join(getDataDir(), "scenes.json");
}

function migrateFromConfigIfNeeded(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = join(__dirname, "..", "..", "config", "scenes.json");
  const dataPath = getScenesPath();
  if (existsSync(configPath) && !existsSync(dataPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as ScenesConfig;
      if (Array.isArray(parsed?.scenes)) {
        mkdirSync(getDataDir(), { recursive: true });
        saveScenes(parsed.scenes);
      }
    } catch {
      // Ignore migration errors
    }
  }
}

export function loadScenes(): Scene[] {
  migrateFromConfigIfNeeded();
  const path = getScenesPath();
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as ScenesConfig;
    if (Array.isArray(parsed?.scenes)) {
      return parsed.scenes;
    }
  } catch {
    // File missing or invalid
  }
  return [];
}

export function saveScenes(scenes: Scene[]): void {
  const dir = getDataDir();
  const path = getScenesPath();
  const tmpPath = path + ".tmp";
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmpPath, JSON.stringify({ scenes }, null, 2), "utf-8");
  renameSync(tmpPath, path);
}

export function createScene(
  name: string,
  entities: SceneEntity[],
  options?: { icon?: string; color?: string }
): Scene {
  const scenes = loadScenes();
  const scene: Scene = {
    id: randomUUID(),
    name: name.trim() || "Scena",
    entities: entities.filter((e) => isEntityAllowed(e.entity_id)),
    ...(options?.icon != null && { icon: options.icon }),
    ...(options?.color != null && { color: options.color }),
  };
  scenes.push(scene);
  saveScenes(scenes);
  return scene;
}

export function updateScene(
  id: string,
  updates: { name?: string; entities?: SceneEntity[]; icon?: string; color?: string }
): Scene | null {
  const scenes = loadScenes();
  const idx = scenes.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  if (updates.name != null) scenes[idx].name = updates.name.trim() || scenes[idx].name;
  if (updates.entities != null) {
    scenes[idx].entities = updates.entities.filter((e) => isEntityAllowed(e.entity_id));
  }
  if (updates.icon !== undefined) scenes[idx].icon = updates.icon || undefined;
  if (updates.color !== undefined) scenes[idx].color = updates.color || undefined;
  saveScenes(scenes);
  return scenes[idx];
}

export function deleteScene(id: string): boolean {
  const scenes = loadScenes();
  const filtered = scenes.filter((s) => s.id !== id);
  if (filtered.length === scenes.length) return false;
  saveScenes(filtered);
  return true;
}

export function getScene(id: string): Scene | null {
  return loadScenes().find((s) => s.id === id) ?? null;
}

/**
 * Apply a scene: iterate over its entities and call the appropriate
 * HA services (turn_on/turn_off with attributes for lights, set_hvac_mode
 * for climate). Runs in demo mode when HA is not configured.
 */
export async function applyScene(sceneId: string): Promise<void> {
  const scene = getScene(sceneId);
  if (!scene) throw new Error("Scene not found");

  for (const ent of scene.entities) {
    const domain = ent.entity_id.split(".")[0];
    const attrs = ent.attributes ?? {};

    // Route MQTT entities to the MQTT handler
    if (isMqttEntity(ent.entity_id)) {
      if (ent.state === "off") {
        await handleMqttService("light", "turn_off", ent.entity_id);
      } else {
        const data: Record<string, unknown> = {};
        if (typeof attrs.brightness === "number") data.brightness = attrs.brightness;
        if (Array.isArray(attrs.rgb_color)) data.rgb_color = attrs.rgb_color;
        if (typeof attrs.white_value === "number") data.white_value = attrs.white_value;
        await handleMqttService("light", "turn_on", ent.entity_id, data);
      }
      continue;
    }

    if (domain === "light" || domain === "switch") {
      if (ent.state === "off") {
        if (isServiceAllowed(domain, "turn_off")) {
          const data = { entity_id: ent.entity_id };
          if (useDemoMode()) {
            demoCallService(domain, "turn_off", data);
          } else {
            await callService(domain, "turn_off", data);
          }
        }
      } else {
        if (isServiceAllowed(domain, "turn_on")) {
          const data: Record<string, unknown> = { entity_id: ent.entity_id };
          if (domain === "light") {
            if (typeof attrs.brightness === "number") data.brightness = attrs.brightness;
            if (Array.isArray(attrs.rgb_color)) data.rgb_color = attrs.rgb_color;
            if (typeof attrs.color_temp === "number") data.color_temp = attrs.color_temp;
            if (typeof attrs.white_value === "number") data.white_value = attrs.white_value;
          }
          if (useDemoMode()) {
            demoCallService(domain, "turn_on", data);
          } else {
            await callService(domain, "turn_on", data);
          }
        }
      }
    } else if (domain === "climate") {
      if (ent.state === "off") {
        if (isServiceAllowed("climate", "set_hvac_mode")) {
          const data = { entity_id: ent.entity_id, hvac_mode: "off" };
          if (useDemoMode()) {
            demoCallService("climate", "set_hvac_mode", data);
          } else {
            await callService("climate", "set_hvac_mode", data);
          }
        }
      } else {
        if (isServiceAllowed("climate", "set_hvac_mode")) {
          const modeData = { entity_id: ent.entity_id, hvac_mode: ent.state };
          if (useDemoMode()) {
            demoCallService("climate", "set_hvac_mode", modeData);
          } else {
            await callService("climate", "set_hvac_mode", modeData);
          }
        }
        if (typeof attrs.temperature === "number" && isServiceAllowed("climate", "set_temperature")) {
          const tempData = { entity_id: ent.entity_id, temperature: attrs.temperature };
          if (useDemoMode()) {
            demoCallService("climate", "set_temperature", tempData);
          } else {
            await callService("climate", "set_temperature", tempData);
          }
        }
      }
    }
  }
}
