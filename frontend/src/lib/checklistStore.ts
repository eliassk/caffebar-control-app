import { writable, derived } from "svelte/store";
import { fetchChecklist, saveChecklist, type ChecklistItem } from "$lib/api";

const RESET_MS = 60 * 60 * 1000; // 1 hour

interface StoredState {
  checked: string[];
  resetAt: number;
}

function createItemsStore() {
  const { subscribe, set, update } = writable<ChecklistItem[]>([]);

  return {
    subscribe,
    load: async (): Promise<ChecklistItem[]> => {
      const { items } = await fetchChecklist();
      set(items);
      return items;
    },
    set: (items: ChecklistItem[]) => {
      set(items);
      saveChecklist({ items }).catch(() => {});
    },
    add: (label: string) => {
      const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const item: ChecklistItem = { id, label: label.trim() || "Nowy punkt" };
      update((items) => {
        const next = [...items, item];
        saveChecklist({ items: next }).catch(() => {});
        return next;
      });
    },
    remove: (id: string) => {
      update((items) => {
        const next = items.filter((i) => i.id !== id);
        saveChecklist({ items: next }).catch(() => {});
        return next;
      });
    },
    moveUp: (id: string) => {
      update((items) => {
        const idx = items.findIndex((i) => i.id === id);
        if (idx <= 0) return items;
        const next = [...items];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        saveChecklist({ items: next }).catch(() => {});
        return next;
      });
    },
    moveDown: (id: string) => {
      update((items) => {
        const idx = items.findIndex((i) => i.id === id);
        if (idx < 0 || idx >= items.length - 1) return items;
        const next = [...items];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        saveChecklist({ items: next }).catch(() => {});
        return next;
      });
    },
    update: (id: string, label: string) => {
      update((items) => {
        const next = items.map((i) => (i.id === id ? { ...i, label: label.trim() || i.label } : i));
        saveChecklist({ items: next }).catch(() => {});
        return next;
      });
    },
  };
}

function createStateStore() {
  const { subscribe, set, update } = writable<StoredState>({ checked: [], resetAt: Date.now() + RESET_MS });

  return {
    subscribe,
    load: async (): Promise<StoredState> => {
      const { state } = await fetchChecklist();
      set(state);
      return state;
    },
    toggle: (id: string) => {
      update((s) => {
        let { checked, resetAt } = s;
        if (Date.now() >= resetAt) {
          checked = [];
          resetAt = Date.now() + RESET_MS;
        }
        const checkedSet = new Set(checked);
        if (checkedSet.has(id)) checkedSet.delete(id);
        else checkedSet.add(id);
        const next = { checked: [...checkedSet], resetAt };
        saveChecklist({ state: next }).catch(() => {});
        return next;
      });
    },
    refresh: async (): Promise<StoredState> => {
      const { state } = await fetchChecklist();
      set(state);
      return state;
    },
  };
}

export const checklistItems = createItemsStore();
export const checklistState = createStateStore();

export async function refreshChecklistState(): Promise<void> {
  await Promise.all([checklistItems.load(), checklistState.load()]);
}

export const checklistWithState = derived(
  [checklistItems, checklistState],
  ([$items, $state]) => {
    let { checked, resetAt } = $state;
    if (typeof window !== "undefined" && Date.now() >= resetAt) {
      checked = [];
    }
    const checkedSet = new Set(checked);
    return $items.map((item) => ({ ...item, checked: checkedSet.has(item.id) }));
  }
);
