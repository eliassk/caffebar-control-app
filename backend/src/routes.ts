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

const router = Router();

router.get("/config", (_req: Request, res: Response) => {
  try {
    const config = loadLightGroups();
    res.json({ light_groups: config.groups });
  } catch (err) {
    console.error("GET /config", err);
    res.status(500).json({ error: "Failed to load config" });
  }
});

router.get("/stream", (req: Request, res: Response) => {
  req.socket.setTimeout(0);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  addStreamClient(res);
});

router.get("/entities", async (_req: Request, res: Response) => {
  try {
    const entities = await getEntities();
    res.json(entities);
  } catch (err) {
    console.error("GET /entities", err);
    res.status(502).json({
      error: "Failed to fetch entities",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/entities/:entity_id", async (req: Request, res: Response) => {
  const { entity_id } = req.params;
  if (!entity_id) {
    res.status(400).json({ error: "entity_id required" });
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
    res.status(502).json({
      error: "Failed to fetch entity",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/entities/:entity_id/history", async (req: Request, res: Response) => {
  const { entity_id } = req.params;
  const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
  if (!entity_id || !isEntityAllowed(entity_id)) {
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
    res.status(502).json({
      error: "Failed to fetch history",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
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
      if (typeof id !== "string" || !isEntityAllowed(id)) {
        res.status(403).json({ error: "Entity not in allowlist" });
        return;
      }
    }
  }
  try {
    if (useDemoMode()) {
      demoCallService(domain, service, payload);
      triggerBroadcast();
      res.json({ success: true, result: null });
      return;
    }
    const result = await callService(domain, service, payload);
    triggerBroadcast();
    res.json({ success: true, result });
  } catch (err) {
    console.error("POST /service", { domain, service, payload }, err);
    res.status(502).json({
      error: "Service call failed",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/toggle", async (req: Request, res: Response) => {
  const { entity_id } = req.body ?? {};
  if (!entity_id || typeof entity_id !== "string") {
    res.status(400).json({ error: "entity_id required" });
    return;
  }
  if (!isEntityAllowed(entity_id)) {
    res.status(403).json({ error: "Entity not in allowlist" });
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
    res.status(502).json({
      error: "Toggle failed",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/scenes", (_req: Request, res: Response) => {
  try {
    const scenes = loadScenes();
    res.json(scenes);
  } catch (err) {
    console.error("GET /scenes", err);
    res.status(500).json({ error: "Failed to load scenes" });
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
      ...(typeof color === "string" && { color }),
    });
    res.status(201).json(scene);
  } catch (err) {
    console.error("POST /scenes", err);
    res.status(500).json({ error: "Failed to create scene" });
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
  if (typeof color === "string") updates.color = color;
  try {
    const scene = updateScene(id, updates);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    res.json(scene);
  } catch (err) {
    console.error("PUT /scenes/:id", err);
    res.status(500).json({ error: "Failed to update scene" });
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
    res.status(500).json({ error: "Failed to delete scene" });
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
    res.status(502).json({
      error: "Scene failed",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// --- Settings: PIN ---

router.get("/settings/pin", (_req: Request, res: Response) => {
  try {
    const pin_hash = getPinHash();
    res.json({ pin_hash });
  } catch (err) {
    console.error("GET /settings/pin", err);
    res.status(500).json({ error: "Failed to load PIN" });
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
    res.status(500).json({ error: "Failed to save PIN" });
  }
});

router.delete("/settings/pin", (_req: Request, res: Response) => {
  try {
    setPinHash(null);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /settings/pin", err);
    res.status(500).json({ error: "Failed to remove PIN" });
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
    res.status(500).json({ error: "Failed to load checklist" });
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
    res.status(500).json({ error: "Failed to save checklist" });
  }
});

export default router;
