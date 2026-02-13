import type { Response } from "express";
import { getEntities } from "./entities.js";

/** How often to poll HA for entity changes (ms). */
const STREAM_INTERVAL_MS = 2000;

/** Maximum concurrent SSE connections allowed. Prevents resource exhaustion. */
const MAX_CLIENTS = 20;

type Client = { res: Response; lastId: number };

const clients = new Set<Client>();
let lastSnapshot: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(broadcast, STREAM_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Push the latest entity state to all connected SSE clients (if changed). */
export async function broadcast(): Promise<void> {
  if (clients.size === 0) return;
  try {
    const entities = await getEntities();
    const json = JSON.stringify(entities);
    if (json === lastSnapshot) return;
    lastSnapshot = json;

    const data = `data: ${json}\n\n`;
    for (const client of clients) {
      try {
        client.res.write(`id: ${++client.lastId}\n`);
        client.res.write(data);
      } catch {
        clients.delete(client);
      }
    }
    if (clients.size === 0) stopPolling();
  } catch (err) {
    console.error("Stream broadcast error:", err);
  }
}

export function triggerBroadcast(): void {
  broadcast();
}

/**
 * Register a new SSE client.
 * Returns `false` if the connection limit has been reached (caller should 503).
 */
export function addStreamClient(res: Response): boolean {
  if (clients.size >= MAX_CLIENTS) {
    return false;
  }
  const client: Client = { res, lastId: 0 };
  clients.add(client);
  startPolling();
  broadcast(); // send initial state immediately
  res.on("close", () => {
    clients.delete(client);
    if (clients.size === 0) stopPolling();
  });
  return true;
}
