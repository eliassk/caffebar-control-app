import { Router, type Request, type Response } from "express";
import { getState, callService, getHistory, useDemoMode } from "./ha.js";
import { isEntityAllowed, isServiceAllowed } from "./allowlist.js";
import { loadLightGroups } from "./lightGroups.js";
import { getDemoState, demoCallService, getDemoHistory } from "./demo.js";
import { getEntities, mapState } from "./entities.js";
import { triggerBroadcast, addStreamClient } from "./stream.js";
import {
  loadScenes,
  createScene,
  updateScene,
  deleteScene,
  getScene,
  applyScene,
  type SceneEntity,
} from "./scenes.js";
import {
  getPinHash,
  setPinHash,
  getChecklistItems,
  getChecklistState,
  saveChecklistItems,
  saveChecklistState,
  type ChecklistItem,
} from "./settings.js";
import { isValidEntityId, sanitizeColor } from "./validation.js";
import { isMqttEntity, handleMqttService } from "./mqtt.js";

const router = Router();

/**
 * Send a standardised JSON error response.
 * Use status 502 for upstream HA failures, 500 for internal errors.
 * In production the `detail` field is omitted to avoid leaking internals.
 */
function sendError(res: Response, status: number, message: string, err?: unknown): void {
  const detail =
    process.env.NODE_ENV !== "production" && err instanceof Error
      ? err.message
      : undefined;
  res.status(status).json({ error: message, ...(detail && { detail }) });
}

router.get("/config", (_req: Request, res: Response) => {
  try {
    const config = loadLightGroups();
    res.json({ light_groups: config.groups });
  } catch (err) {
    console.error("GET /config", err);
    sendError(res, 500, "Failed to load config", err);
  }
});

router.get("/stream", (req: Request, res: Response) => {
  req.socket.setTimeout(0);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  if (!addStreamClient(res)) {
    res.status(503).end("Too many stream connections");
  }
});

router.get("/entities", async (_req: Request, res: Response) => {
  try {
    const entities = await getEntities();
    res.json(entities);
  } catch (err) {
    console.error("GET /entities", err);
    sendError(res, 502, "Failed to fetch entities", err);
  }
});

router.get("/entities/:entity_id", async (req: Request, res: Response) => {
  const { entity_id } = req.params;
  if (!isValidEntityId(entity_id)) {
    res.status(400).json({ error: "Invalid entity_id format" });
    return;
  }
  if (!isEntityAllowed(entity_id)) {
    res.status(403).json({ error: "Entity not in allowlist" });
    return;
  }
  try {
    if (useDemoMode()) {
      const demoState = getDemoState(entity_id);
      if (!demoState) {
        res.status(404).json({ error: "Entity not found" });
        return;
      }
      res.json(mapState(demoState));
      return;
    }
    const state = await getState(entity_id);
    if (!state) {
      res.status(404).json({ error: "Entity not found" });
      return;
    }
    res.json(mapState(state));
  } catch (err) {
    console.error("GET /entities/:id", err);
    sendError(res, 502, "Failed to fetch entity", err);
  }
});

router.get("/entities/:entity_id/history", async (req: Request, res: Response) => {
  const { entity_id } = req.params;
  const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
  if (!isValidEntityId(entity_id) || !isEntityAllowed(entity_id)) {
    res.status(403).json({ error: "Entity not in allowlist" });
    return;
  }
  try {
    if (useDemoMode()) {
      const data = getDemoHistory(entity_id, hours);
      res.json(data);
      return;
    }
    const start = new Date(Date.now() - hours * 60 * 60 * 1000);
    const data = await getHistory(entity_id, start);
    res.json(data);
  } catch (err) {
    console.error("GET /entities/:id/history", err);
    sendError(res, 502, "Failed to fetch history", err);
  }
});

router.post("/service", async (req: Request, res: Response) => {
  const { domain, service, entity_id, data } = req.body ?? {};
  if (!domain || !service) {
    res.status(400).json({ error: "domain and service required" });
    return;
  }
  if (!isServiceAllowed(domain, service)) {
    res.status(403).json({ error: "Service not in allowlist" });
    return;
  }
  const payload: { entity_id?: string | string[]; [key: string]: unknown } = {
    ...(typeof data === "object" && data !== null ? data : {}),
  };
  if (entity_id !== undefined) {
    payload.entity_id = entity_id;
    const ids = Array.isArray(entity_id) ? entity_id : [entity_id];
    for (const id of ids) {
      if (!isValidEntityId(id)) {
        res.status(400).json({ error: "Invalid entity_id format" });
        return;
      }
      if (!isEntityAllowed(id)) {
        res.status(403).json({ error: "Entity not in allowlist" });
        return;
      }
    }
  }
  try {
    // Demo mode handles all entities (including MQTT lights) via in-memory state
    if (useDemoMode()) {
      demoCallService(domain, service, payload);
      triggerBroadcast();
      res.json({ success: true, result: null });
      return;
    }

    // Route MQTT entities to the MQTT handler
    const singleId = typeof entity_id === "string" ? entity_id : undefined;
    if (singleId && isMqttEntity(singleId)) {
      await handleMqttService(domain, service, singleId, payload);
      triggerBroadcast();
      res.json({ success: true, result: null });
      return;
    }

    const result = await callService(domain, service, payload);
    triggerBroadcast();
    res.json({ success: true, result });
  } catch (err) {
    console.error("POST /service", { domain, service, payload }, err);
    sendError(res, 502, "Service call failed", err);
  }
});

router.post("/toggle", async (req: Request, res: Response) => {
  const { entity_id } = req.body ?? {};
  if (!isValidEntityId(entity_id)) {
    res.status(400).json({ error: "Invalid entity_id format" });
    return;
  }
  if (!isEntityAllowed(entity_id)) {
    res.status(403).json({ error: "Entity not in allowlist" });
    return;
  }

  // Route MQTT entities — demo mode uses in-memory state, real mode uses MQTT broker
  if (isMqttEntity(entity_id)) {
    try {
      if (useDemoMode()) {
        demoCallService("mqtt_light", "toggle", { entity_id });
      } else {
        await handleMqttService("light", "toggle", entity_id);
      }
      triggerBroadcast();
      res.json({ success: true, result: null });
    } catch (err) {
      console.error("POST /toggle (mqtt)", err);
      sendError(res, 502, "Toggle failed", err);
    }
    return;
  }

  const domain = entity_id.split(".")[0];
  if (domain !== "switch" && domain !== "light") {
    res.status(400).json({ error: "toggle only for switch or light" });
    return;
  }
  if (!isServiceAllowed(domain, "toggle")) {
    res.status(403).json({ error: "toggle not in allowlist" });
    return;
  }
  try {
    if (useDemoMode()) {
      demoCallService(domain, "toggle", { entity_id });
      triggerBroadcast();
      res.json({ success: true, result: null });
      return;
    }
    const result = await callService(domain, "toggle", { entity_id });
    triggerBroadcast();
    res.json({ success: true, result });
  } catch (err) {
    console.error("POST /toggle", err);
    sendError(res, 502, "Toggle failed", err);
  }
});

router.get("/scenes", (_req: Request, res: Response) => {
  try {
    const scenes = loadScenes();
    res.json(scenes);
  } catch (err) {
    console.error("GET /scenes", err);
    sendError(res, 500, "Failed to load scenes", err);
  }
});

router.post("/scenes", (req: Request, res: Response) => {
  const { name, entities, icon, color } = req.body ?? {};
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }
  if (!Array.isArray(entities)) {
    res.status(400).json({ error: "entities must be an array" });
    return;
  }
  try {
    const scene = createScene(name, entities as SceneEntity[], {
      ...(typeof icon === "string" && { icon }),
      ...(sanitizeColor(color) != null && { color: sanitizeColor(color) }),
    });
    res.status(201).json(scene);
  } catch (err) {
    console.error("POST /scenes", err);
    sendError(res, 500, "Failed to create scene", err);
  }
});

router.put("/scenes/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, entities, icon, color } = req.body ?? {};
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  const updates: { name?: string; entities?: SceneEntity[]; icon?: string; color?: string } = {};
  if (typeof name === "string") updates.name = name;
  if (Array.isArray(entities)) updates.entities = entities as SceneEntity[];
  if (typeof icon === "string") updates.icon = icon;
  if (typeof color === "string") updates.color = sanitizeColor(color) ?? "";
  try {
    const scene = updateScene(id, updates);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    res.json(scene);
  } catch (err) {
    console.error("PUT /scenes/:id", err);
    sendError(res, 500, "Failed to update scene", err);
  }
});

router.delete("/scenes/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  try {
    const deleted = deleteScene(id);
    if (!deleted) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /scenes/:id", err);
    sendError(res, 500, "Failed to delete scene", err);
  }
});

router.post("/scenes/:id/apply", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  try {
    await applyScene(id);
    triggerBroadcast();
    res.json({ success: true });
  } catch (err) {
    console.error("POST /scenes/:id/apply", err);
    sendError(res, 502, "Scene failed", err);
  }
});

// --- Settings: PIN ---

router.get("/settings/pin", (_req: Request, res: Response) => {
  try {
    const pin_hash = getPinHash();
    res.json({ pin_hash });
  } catch (err) {
    console.error("GET /settings/pin", err);
    sendError(res, 500, "Failed to load PIN", err);
  }
});

router.put("/settings/pin", (req: Request, res: Response) => {
  const { pin_hash } = req.body ?? {};
  if (typeof pin_hash !== "string" || pin_hash.length === 0) {
    res.status(400).json({ error: "pin_hash required" });
    return;
  }
  try {
    setPinHash(pin_hash);
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /settings/pin", err);
    sendError(res, 500, "Failed to save PIN", err);
  }
});

router.delete("/settings/pin", (_req: Request, res: Response) => {
  try {
    setPinHash(null);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /settings/pin", err);
    sendError(res, 500, "Failed to remove PIN", err);
  }
});

// --- Settings: Checklist ---

router.get("/settings/checklist", (_req: Request, res: Response) => {
  try {
    const items = getChecklistItems();
    const state = getChecklistState();
    res.json({ items, state });
  } catch (err) {
    console.error("GET /settings/checklist", err);
    sendError(res, 500, "Failed to load checklist", err);
  }
});

router.put("/settings/checklist", (req: Request, res: Response) => {
  const { items, state } = req.body ?? {};
  try {
    if (Array.isArray(items)) {
      const valid = items.filter(
        (x): x is ChecklistItem =>
          x && typeof x === "object" && typeof x.id === "string" && typeof x.label === "string"
      );
      saveChecklistItems(valid);
    }
    if (state && typeof state === "object" && Array.isArray(state.checked) && typeof state.resetAt === "number") {
      saveChecklistState({
        checked: state.checked.filter((x: unknown) => typeof x === "string"),
        resetAt: state.resetAt,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /settings/checklist", err);
    sendError(res, 500, "Failed to save checklist", err);
  }
});

export default router;
