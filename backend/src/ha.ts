const HA_BASE = process.env.HA_BASE_URL ?? "http://homeassistant.local:8123";
const HA_TOKEN = process.env.HA_TOKEN ?? "";

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

async function haFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${HA_BASE.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

export async function getStates(): Promise<HAState[]> {
  const res = await haFetch("/api/states");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HA states failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<HAState[]>;
}

export async function getState(entityId: string): Promise<HAState | null> {
  const res = await haFetch(`/api/states/${encodeURIComponent(entityId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HA state failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<HAState>;
}

export async function callService(
  domain: string,
  service: string,
  data?: { entity_id?: string | string[]; [key: string]: unknown }
): Promise<unknown> {
  const res = await haFetch(`/api/services/${domain}/${service}`, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HA service failed: ${res.status} ${text}`);
  }
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export async function getHistory(
  entityId: string,
  startTime: Date
): Promise<Array<{ timestamp: string; value: number }>> {
  const start = startTime.toISOString();
  const res = await haFetch(
    `/api/history/period/${encodeURIComponent(start)}?filter_entity_id=${encodeURIComponent(entityId)}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HA history failed: ${res.status} ${text}`);
  }
  const raw = (await res.json()) as Array<
    Array<{ state: string; last_changed: string; attributes?: Record<string, unknown> }>
  >;
  const domain = entityId.split(".")[0];
  const isWeather = domain === "weather";
  const out: Array<{ timestamp: string; value: number }> = [];
  for (const chunk of raw) {
    for (const row of chunk) {
      let value: number;
      if (isWeather) {
        const temp = row.attributes?.temperature;
        value = typeof temp === "number" ? temp : parseFloat(String(temp ?? ""));
      } else {
        value = parseFloat(row.state);
      }
      if (!Number.isNaN(value)) {
        out.push({ timestamp: row.last_changed, value });
      }
    }
  }
  out.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return out;
}
export function isHaConfigured(): boolean {
  return Boolean(HA_BASE && HA_TOKEN);
}

/** Use demo data when HA is not configured or DEMO_MODE is set (so you can run the UI without HA). */
export function useDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1") return true;
  return !isHaConfigured();
}
