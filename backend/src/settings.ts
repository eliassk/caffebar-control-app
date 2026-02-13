import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ChecklistItem {
  id: string;
  label: string;
}

interface ChecklistState {
  checked: string[];
  resetAt: number;
}

interface SettingsData {
  pin_hash?: string | null;
  checklist_items?: ChecklistItem[];
  checklist_state?: ChecklistState;
}

const RESET_MS = 60 * 60 * 1000; // 1 hour

function getDataDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, "..", "..", "data");
}

function getSettingsPath(): string {
  return join(getDataDir(), "settings.json");
}

function loadSettings(): SettingsData {
  const path = getSettingsPath();
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw) as SettingsData;
      return parsed ?? {};
    }
  } catch {
    // File missing or invalid
  }
  return {};
}

function saveSettings(data: SettingsData): void {
  const dir = getDataDir();
  const path = getSettingsPath();
  const tmpPath = path + ".tmp";
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmpPath, path);
}

// --- PIN ---

export function getPinHash(): string | null {
  const data = loadSettings();
  const hash = data.pin_hash;
  return typeof hash === "string" && hash.length > 0 ? hash : null;
}

export function setPinHash(hash: string | null): void {
  const data = loadSettings();
  saveSettings({ ...data, pin_hash: hash ?? null });
}

// --- Checklist ---

export function getChecklistItems(): ChecklistItem[] {
  const data = loadSettings();
  const items = data.checklist_items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (x): x is ChecklistItem =>
      x && typeof x === "object" && typeof x.id === "string" && typeof x.label === "string"
  );
}

export function getChecklistState(): ChecklistState {
  const data = loadSettings();
  const state = data.checklist_state;
  if (!state || typeof state !== "object") {
    return { checked: [], resetAt: Date.now() + RESET_MS };
  }
  let checked = Array.isArray(state.checked) ? state.checked.filter((x) => typeof x === "string") : [];
  let resetAt = typeof state.resetAt === "number" ? state.resetAt : Date.now() + RESET_MS;
  if (Date.now() >= resetAt) {
    checked = [];
    resetAt = Date.now() + RESET_MS;
  }
  return { checked, resetAt };
}

export function saveChecklistItems(items: ChecklistItem[]): void {
  const data = loadSettings();
  saveSettings({ ...data, checklist_items: items });
}

export function saveChecklistState(state: ChecklistState): void {
  const data = loadSettings();
  saveSettings({ ...data, checklist_state: state });
}
