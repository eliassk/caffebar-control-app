import { writable } from "svelte/store";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "kaffebar-theme";

function load(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

function save(value: Theme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

function getEffectiveTheme(): "light" | "dark" {
  const theme = load();
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

function createStore() {
  const { subscribe, set, update } = writable<Theme>(load());

  const init = () => {
    applyTheme(getEffectiveTheme());
    if (typeof window !== "undefined") {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (load() === "system") applyTheme(getEffectiveTheme());
      });
    }
  };

  return {
    subscribe,
    set: (value: Theme) => {
      save(value);
      set(value);
      applyTheme(getEffectiveTheme());
    },
    update: (fn: (v: Theme) => Theme) => {
      update((v) => {
        const next = fn(v);
        save(next);
        applyTheme(getEffectiveTheme());
        return next;
      });
    },
    init,
  };
}

export const theme = createStore();
