const BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:3001" : "");

function getStreamUrl(): string {
  return BASE ? `${BASE}/api/coffee/stream` : "/api/coffee/stream";
}

export interface CoffeeEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  friendly_name: string;
  icon: string;
  domain: string;
}

import { t } from "$lib/i18n";

function safeErrorText(body: string, fallback: string): string {
  const trimmed = body.trim();
  if (trimmed.length > 300 || trimmed.startsWith("<!") || trimmed.toLowerCase().includes("<html")) {
    return fallback;
  }
  return trimmed;
}

export async function fetchEntities(): Promise<CoffeeEntity[]> {
  const res = await fetch(`${BASE}/api/coffee/entities`, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(safeErrorText(text, t.errorRequestFailed(res.status)));
  }
  return res.json();
}

/**
 * Subscribe to realtime entity updates via SSE.
 * Returns an unsubscribe function.
 */
export function subscribeEntitiesStream(
  onEntities: (entities: CoffeeEntity[]) => void,
  onError?: (err: Event) => void
): () => void {
  const url = getStreamUrl();
  if (!url.startsWith("http") && !url.startsWith("/")) {
    onError?.(new Event("error"));
    return () => {};
  }
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      const entities = JSON.parse(e.data) as CoffeeEntity[];
      if (Array.isArray(entities)) onEntities(entities);
    } catch {
      // ignore parse errors
    }
  };
  es.onerror = (e) => {
    onError?.(e);
  };
  return () => {
    es.close();
  };
}

export async function fetchEntity(entityId: string): Promise<CoffeeEntity> {
  const res = await fetch(`${BASE}/api/coffee/entities/${encodeURIComponent(entityId)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(safeErrorText(text, t.errorRequestFailed(res.status)));
  }
  return res.json();
}

export interface HistoryPoint {
  timestamp: string;
  value: number;
}

export async function fetchHistory(
  entityId: string,
  hours: number = 24
): Promise<HistoryPoint[]> {
  const res = await fetch(
    `${BASE}/api/coffee/entities/${encodeURIComponent(entityId)}/history?hours=${hours}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(safeErrorText(text, t.errorRequestFailed(res.status)));
  }
  return res.json();
}

export async function callService(
  domain: string,
  service: string,
  entityId?: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown }> {
  const res = await fetch(`${BASE}/api/coffee/service`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      domain,
      service,
      ...(entityId != null && { entity_id: entityId }),
      ...(data && { data }),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail ?? json.error ?? res.statusText);
  return json;
}

export async function toggleEntity(entityId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/api/coffee/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ entity_id: entityId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail ?? json.error ?? res.statusText);
  return json;
}

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

export async function fetchScenes(): Promise<Scene[]> {
  const res = await fetch(`${BASE}/api/coffee/scenes`, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(safeErrorText(text, t.errorRequestFailed(res.status)));
  }
  return res.json();
}

export async function createScene(
  name: string,
  entities: SceneEntity[],
  options?: { icon?: string; color?: string }
): Promise<Scene> {
  const res = await fetch(`${BASE}/api/coffee/scenes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, entities, ...options }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? json.detail ?? res.statusText);
  return json;
}

export async function updateScene(
  id: string,
  updates: { name?: string; entities?: SceneEntity[]; icon?: string; color?: string }
): Promise<Scene> {
  const res = await fetch(`${BASE}/api/coffee/scenes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? json.detail ?? res.statusText);
  return json;
}

export async function deleteScene(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/coffee/scenes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? json.detail ?? res.statusText);
  }
}

export async function applyScene(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/api/coffee/scenes/${encodeURIComponent(id)}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail ?? json.error ?? res.statusText);
  return json;
}

export interface LightGroupConfig {
  id: string;
  label: string;
  entities: string[];
  patterns?: string[];
}

export async function fetchLightGroupsConfig(): Promise<LightGroupConfig[]> {
  const res = await fetch(`${BASE}/api/coffee/config`, { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { light_groups?: LightGroupConfig[] };
  return Array.isArray(json?.light_groups) ? json.light_groups : [];
}

export async function healthCheck(): Promise<{ ok: boolean; demo_mode?: boolean }> {
  const res = await fetch(`${BASE}/health`, { credentials: "include" });
  const json = await res.json().catch(() => ({}));
  return {
    ok: res.ok && json.ok === true,
    demo_mode: Boolean(json.demo_mode),
  };
}

// --- Settings: PIN ---

export async function fetchPinHash(): Promise<string | null> {
  const res = await fetch(`${BASE}/api/coffee/settings/pin`, { credentials: "include" });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { pin_hash?: string | null };
  return typeof json.pin_hash === "string" && json.pin_hash.length > 0 ? json.pin_hash : null;
}

export async function savePinHash(hash: string): Promise<void> {
  const res = await fetch(`${BASE}/api/coffee/settings/pin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ pin_hash: hash }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? json.detail ?? res.statusText);
  }
}

export async function removePinHash(): Promise<void> {
  const res = await fetch(`${BASE}/api/coffee/settings/pin`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? json.detail ?? res.statusText);
  }
}

// --- Settings: Checklist ---

export interface ChecklistItem {
  id: string;
  label: string;
}

interface ChecklistState {
  checked: string[];
  resetAt: number;
}

export async function fetchChecklist(): Promise<{ items: ChecklistItem[]; state: ChecklistState }> {
  const res = await fetch(`${BASE}/api/coffee/settings/checklist`, { credentials: "include" });
  if (!res.ok) return { items: [], state: { checked: [], resetAt: Date.now() + 60 * 60 * 1000 } };
  const json = (await res.json().catch(() => ({}))) as { items?: ChecklistItem[]; state?: ChecklistState };
  const items = Array.isArray(json.items)
    ? json.items.filter((x) => x && typeof x.id === "string" && typeof x.label === "string")
    : [];
  const state = json.state && typeof json.state === "object" && Array.isArray(json.state.checked)
    ? {
        checked: json.state.checked.filter((x: unknown) => typeof x === "string"),
        resetAt: typeof json.state.resetAt === "number" ? json.state.resetAt : Date.now() + 60 * 60 * 1000,
      }
    : { checked: [] as string[], resetAt: Date.now() + 60 * 60 * 1000 };
  return { items, state };
}

export async function saveChecklist(data: {
  items?: ChecklistItem[];
  state?: ChecklistState;
}): Promise<void> {
  const res = await fetch(`${BASE}/api/coffee/settings/checklist`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? json.detail ?? res.statusText);
  }
}
