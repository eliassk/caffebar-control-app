<script lang="ts">
  import { pinStore, PIN_LENGTH } from "$lib/pinStore";
  import { t } from "$lib/i18n";
  import { Coffee } from "lucide-svelte";

  export let mode: "unlock" | "set" | "change" | "remove" = "unlock";
  export let onUnlock: (() => void) | undefined = undefined;

  let digits = "";
  let wrong = false;
  let shake = false;

  function addDigit(d: string) {
    if (digits.length >= PIN_LENGTH) return;
    wrong = false;
    digits += d;
    if (digits.length === PIN_LENGTH) {
      checkPin();
    }
  }

  function backspace() {
    digits = digits.slice(0, -1);
    wrong = false;
  }

  async function checkPin() {
    if (mode !== "unlock") return;
    const ok = onUnlock
      ? await pinStore.verifyPin(digits)
      : await pinStore.unlock(digits);
    if (ok) {
      digits = "";
      onUnlock?.();
    } else {
      wrong = true;
      shake = true;
      digits = "";
      setTimeout(() => (shake = false), 400);
    }
  }
</script>

<div
  class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface dark:bg-stone-900 p-6"
  role="dialog"
  aria-modal="true"
  aria-labelledby="pin-title"
>
  <div class="flex flex-col items-center gap-8 max-w-sm w-full">
    <div class="flex items-center gap-2">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
        <Coffee class="h-7 w-7 text-white" />
      </div>
      <span class="font-display text-xl font-semibold text-stone-800 dark:text-stone-200">{t.appName}</span>
    </div>
    <div class="flex flex-col items-center gap-4 w-full">
      <h2 id="pin-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
        {mode === "unlock" ? t.pinLockTitle : mode === "set" ? t.pinSetTitle : mode === "change" ? t.pinChangeTitle : t.pinRemoveTitle}
      </h2>
      <p class="text-sm text-stone-600 dark:text-stone-400">
        {mode === "unlock" ? t.pinEnterPrompt : mode === "set" ? t.pinEnterPrompt : t.pinConfirmPrompt}
      </p>
      <div
        class="flex justify-center gap-3 py-4 transition {shake ? 'animate-shake' : ''}"
        class:border-red-500={wrong}
      >
        {#each Array(PIN_LENGTH) as _, i}
          <div
            class="h-4 w-4 rounded-full border-2 transition {digits.length > i
              ? 'bg-accent border-accent'
              : 'border-stone-300 dark:border-stone-600 bg-transparent'}"
          />
        {/each}
      </div>
      {#if wrong}
        <p class="text-sm text-red-600 dark:text-red-400">{t.pinWrong}</p>
      {/if}
    </div>
    <div class="grid grid-cols-3 gap-3 w-full max-w-[240px]">
      {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "back"] as key}
        {#if key === ""}
          <div />
        {:else if key === "back"}
          <button
            type="button"
            class="flex h-14 items-center justify-center rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium transition hover:bg-stone-300 dark:hover:bg-stone-600 active:scale-95"
            aria-label="Backspace"
            on:click={backspace}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        {:else}
          <button
            type="button"
            class="flex h-14 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-xl font-medium transition hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95"
            on:click={() => addDigit(String(key))}
          >
            {key}
          </button>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  .animate-shake {
    animation: shake 0.4s ease-in-out;
  }
</style>
