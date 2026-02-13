import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface EntityNamesConfig {
  /** Exact entity_id -> display name */
  exact?: Record<string, string>;
  /** For entities matching pattern: strip this prefix from friendly_name */
  strip_prefix?: Array<{ pattern: string; prefix: string }>;
}

let cached: EntityNamesConfig | null = null;

function patternToRegex(pattern: string): RegExp {
  const withPlaceholder = pattern.replace(/\*/g, "\u0000");
  const escaped = withPlaceholder
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\u0000/g, "[^.]*");
  return new RegExp(`^${escaped}$`);
}

function loadConfig(configPath?: string): EntityNamesConfig {
  if (cached) return cached;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = configPath ?? join(__dirname, "..", "..", "config", "entityNames.json");
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      cached = JSON.parse(raw) as EntityNamesConfig;
      return cached ?? {};
    }
  } catch {
    // File missing or invalid
  }
  cached = {};
  return {};
}

/**
 * Get the display name for an entity. Returns custom name from config if defined,
 * otherwise applies strip_prefix rules, otherwise returns the original friendly_name.
 */
export function getDisplayName(
  entityId: string,
  friendlyName: string,
  configPath?: string
): string {
  const cfg = loadConfig(configPath);
  const exact = cfg.exact ?? {};
  if (typeof exact[entityId] === "string") {
    return exact[entityId].trim();
  }
  const stripRules = cfg.strip_prefix ?? [];
  for (const { pattern, prefix } of stripRules) {
    if (patternToRegex(pattern).test(entityId) && typeof friendlyName === "string") {
      const trimmed = friendlyName.trim();
      if (prefix && trimmed.startsWith(prefix)) {
        return trimmed.slice(prefix.length).trim() || trimmed;
      }
    }
  }
  return friendlyName;
}
