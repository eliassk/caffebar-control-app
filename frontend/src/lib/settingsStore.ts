import { writable } from "svelte/store";

const STORAGE_KEY = "kaffebar-custom-welcome";

export interface CustomWelcome {
  title: string;
  desc: string;
}

function load(): CustomWelcome | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomWelcome;
    if (typeof parsed?.title === "string" && typeof parsed?.desc === "string") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function save(value: CustomWelcome | null) {
  if (typeof window === "undefined") return;
  if (value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function createStore() {
  const { subscribe, set, update } = writable<CustomWelcome | null>(load());

  return {
    subscribe,
    set: (value: CustomWelcome | null) => {
      save(value);
      set(value);
    },
    update: (fn: (v: CustomWelcome | null) => CustomWelcome | null) => {
      update((v) => {
        const next = fn(v);
        save(next);
        return next;
      });
    },
  };
}

export const customWelcome = createStore();
