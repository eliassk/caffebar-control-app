import type { CoffeeEntity } from "$lib/api";

export interface LightGroupConfig {
  id: string;
  label: string;
  entities: string[];
  patterns?: string[];
}

function patternToRegex(pattern: string): RegExp {
  const withPlaceholder = pattern.replace(/\*/g, "\u0000");
  const escaped = withPlaceholder
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\u0000/g, "[^.]*");
  return new RegExp(`^${escaped}$`);
}

function entityMatchesGroup(entityId: string, group: LightGroupConfig): boolean {
  if (group.entities?.includes(entityId)) return true;
  for (const p of group.patterns ?? []) {
    if (patternToRegex(p).test(entityId)) return true;
  }
  return false;
}

/** Returns the group id for an entity from config, or "other" if no group matches. */
export function getLightGroupId(
  entity: CoffeeEntity,
  config: LightGroupConfig[]
): string {
  for (const g of config) {
    if (entityMatchesGroup(entity.entity_id, g)) return g.id;
  }
  return "other";
}

/** Ordered list of group ids for display. */
export function getLightGroupOrder(config: LightGroupConfig[]): string[] {
  return [...config.map((g) => g.id), "other"];
}

/** Partitions lights into groups using config. */
export function groupLights(
  lights: CoffeeEntity[],
  config: LightGroupConfig[]
): Array<{ groupId: string; label: string; lights: CoffeeEntity[] }> {
  const order = getLightGroupOrder(config);
  const byGroup = new Map<string, { label: string; lights: CoffeeEntity[] }>();
  for (const g of config) {
    byGroup.set(g.id, { label: g.label, lights: [] });
  }
  byGroup.set("other", { label: "other", lights: [] });

  for (const entity of lights) {
    const groupId = getLightGroupId(entity, config);
    const entry = byGroup.get(groupId);
    if (entry) entry.lights.push(entity);
  }

  return order
    .map((groupId) => {
      const entry = byGroup.get(groupId);
      return entry ? { groupId, label: entry.label, lights: entry.lights } : null;
    })
    .filter((s): s is { groupId: string; label: string; lights: CoffeeEntity[] } => s !== null && s.lights.length > 0);
}
