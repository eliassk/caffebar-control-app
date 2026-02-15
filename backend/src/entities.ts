/**
 * Entity mapping layer.
 *
 * Fetches raw HA states and transforms them into `MappedEntity` objects
 * with a stable shape for the frontend. We use `entity_id` (snake_case)
 * throughout to mirror the Home Assistant API convention.
 */
import { getStates } from "./ha.js";
import { isEntityAllowed } from "./allowlist.js";
import { useDemoMode } from "./ha.js";
import { getDemoStates } from "./demo.js";
import { getDisplayName } from "./entityNames.js";
import { getMqttEntities } from "./mqtt.js";

export interface MappedEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  friendly_name: string;
  icon: string;
  domain: string;
}

export function mapState(state: {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}): MappedEntity {
  const attrs = state.attributes as Record<string, unknown> & {
    friendly_name?: string;
    icon?: string;
  };
  const rawDomain = state.entity_id.split(".")[0];
  // Treat mqtt_light entities as "light" so the frontend groups them with other lights
  const domain = rawDomain === "mqtt_light" ? "light" : rawDomain;
  const rawName = attrs.friendly_name ?? state.entity_id;
  const friendly_name = getDisplayName(state.entity_id, String(rawName));
  return {
    entity_id: state.entity_id,
    state: state.state,
    attributes: { ...state.attributes, friendly_name },
    friendly_name,
    icon: attrs.icon ?? `mdi:${domain}`,
    domain,
  };
}

export async function getEntities(): Promise<MappedEntity[]> {
  if (useDemoMode()) {
    // Demo mode already includes MQTT light representations
    return getDemoStates().map(mapState);
  }

  const haEntities = (await getStates())
    .filter((s) => isEntityAllowed(s.entity_id))
    .map(mapState);

  // Merge MQTT-based lights (filtered through the same allowlist)
  const mqttEntities = getMqttEntities().filter((e) => isEntityAllowed(e.entity_id));
  return [...haEntities, ...mqttEntities];
}
