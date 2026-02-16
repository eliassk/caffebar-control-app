import { writable } from "svelte/store";

const STORAGE_KEY = "kaffebar-lock-app-with-pin";

function load(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch {
    // ignore
  }
  return false;
}

function save(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore
  }
}

function createStore() {
  const { subscribe, set, update } = writable<boolean>(load());
  return {
    subscribe,
    set: (value: boolean) => {
      save(value);
      set(value);
    },
    update: (fn: (v: boolean) => boolean) => {
      update((v) => {
        const next = fn(v);
        save(next);
        return next;
      });
    },
  };
}

export const lockAppWithPin = createStore();
