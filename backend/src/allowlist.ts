/**
 * Entity and service allowlist.
 *
 * Only entities and services listed in `config/allowlist.json` are
 * exposed to the frontend. Patterns use a simple `*` glob that
 * matches any characters _within_ a single domain segment.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface AllowlistConfig {
  entities: {
    exact?: string[];
    patterns?: string[];
  };
  services: Array<{
    domain: string;
    service: string;
    optional?: boolean;
  }>;
}

let cached: AllowlistConfig | null = null;

export function loadAllowlist(configPath?: string): AllowlistConfig {
  if (cached) return cached;
  const path =
    configPath ?? join(process.cwd(), "..", "config", "allowlist.json");
  const raw = readFileSync(path, "utf-8");
  cached = JSON.parse(raw) as AllowlistConfig;
  return cached;
}

/** Convert a simple `*` glob into a RegExp, e.g. `light.coffee_*` -> `/^light\.coffee_[^.]*$/`. */
function patternToRegex(pattern: string): RegExp {
  // Replace * with placeholder before escaping (so * isn’t escaped to \*)
  const withPlaceholder = pattern.replace(/\*/g, "\u0000");
  const escaped = withPlaceholder
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\u0000/g, "[^.]*");
  return new RegExp(`^${escaped}$`);
}

export function isEntityAllowed(entityId: string, config?: AllowlistConfig): boolean {
  const cfg = config ?? loadAllowlist();
  const entities = cfg.entities ?? {};
  const exact = entities.exact ?? [];
  if (exact.includes(entityId)) return true;
  const patterns = entities.patterns ?? [];
  return patterns.some((p) => patternToRegex(p).test(entityId));
}

export function isServiceAllowed(
  domain: string,
  service: string,
  config?: AllowlistConfig
): boolean {
  const cfg = config ?? loadAllowlist();
  const services = cfg.services ?? [];
  return services.some(
    (s) => s.domain === domain && s.service === service
  );
}
