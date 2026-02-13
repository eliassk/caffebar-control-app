import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface LightGroupConfig {
  id: string;
  label: string;
  entities: string[];
  patterns?: string[];
}

export interface LightGroupsConfig {
  groups: LightGroupConfig[];
}

let cached: LightGroupsConfig | null = null;

function getDefaultConfigPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "..", "..", "config", "lightGroups.json");
}

export function loadLightGroups(configPath?: string): LightGroupsConfig {
  if (cached) return cached;
  const path = configPath ?? getDefaultConfigPath();
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as LightGroupsConfig;
    if (Array.isArray(parsed?.groups)) {
      cached = parsed;
      return cached;
    }
  } catch {
    // File missing or invalid
  }
  cached = { groups: [] };
  return cached;
}
