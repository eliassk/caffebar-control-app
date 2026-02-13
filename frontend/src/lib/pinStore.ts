import { writable, get } from "svelte/store";
import { fetchPinHash, savePinHash as apiSavePinHash, removePinHash as apiRemovePinHash } from "$lib/api";

const PIN_LENGTH = 4;

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface PinState {
  locked: boolean;
  pinHash: string | null;
  loaded: boolean;
}

function createStore() {
  const state = writable<PinState>({
    locked: false,
    pinHash: null,
    loaded: false,
  });
  const { subscribe, update } = state;

  return {
    subscribe,
    async load(): Promise<void> {
      try {
        const hash = await fetchPinHash();
        update((s) => ({ ...s, pinHash: hash, loaded: true }));
      } catch {
        update((s) => ({ ...s, loaded: true }));
      }
    },
    async hashPin(pin: string): Promise<string> {
      return hashPin(pin);
    },
    async setPin(newPin: string): Promise<void> {
      const hash = await hashPin(newPin);
      await apiSavePinHash(hash);
      update((s) => ({ ...s, pinHash: hash, locked: false }));
    },
    async removePin(): Promise<void> {
      await apiRemovePinHash();
      update((s) => ({ ...s, pinHash: null, locked: false }));
    },
    async verifyPin(pin: string): Promise<boolean> {
      const stored = get(state).pinHash;
      if (!stored) return false;
      const hash = await hashPin(pin);
      return hash === stored;
    },
    async unlock(pin: string): Promise<boolean> {
      const ok = await this.verifyPin(pin);
      if (ok) {
        update((s) => ({ ...s, locked: false }));
      }
      return ok;
    },
    lock(): void {
      const pinHash = get(state).pinHash;
      if (pinHash) {
        update((s) => ({ ...s, locked: true }));
      }
    },
    hasPin(): boolean {
      return get(state).pinHash != null;
    },
  };
}

export const pinStore = createStore();
export { PIN_LENGTH };
