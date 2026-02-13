<script lang="ts">
  import { pinStore, PIN_LENGTH } from "$lib/pinStore";
  import { t } from "$lib/i18n";
  import { Lock } from "lucide-svelte";

  export let mode: "set" | "change" | "remove" = "set";
  export let onClose: () => void = () => {};
  export let onSuccess: () => void = () => {};

  let step: "current" | "new" | "confirm" | "removeConfirm" = mode === "set" ? "new" : "current";
  let digits = "";
  let firstPin = "";
  let wrong = false;
  let mismatch = false;
  let shake = false;

  $: promptText =
    step === "current"
      ? t.pinCurrentPrompt
      : step === "new"
        ? t.pinEnterPrompt
        : step === "confirm"
          ? t.pinConfirmPrompt
          : "";

  function addDigit(d: string) {
    if (digits.length >= PIN_LENGTH) return;
    wrong = false;
    mismatch = false;
    digits += d;
    if (digits.length === PIN_LENGTH) {
      handleComplete();
    }
  }

  function backspace() {
    digits = digits.slice(0, -1);
    wrong = false;
    mismatch = false;
  }

  async function handleComplete() {
    if (step === "current") {
      const ok = await pinStore.verifyPin(digits);
      if (ok) {
        digits = "";
        step = mode === "remove" ? "removeConfirm" : "new";
      } else {
        wrong = true;
        shake = true;
        digits = "";
        setTimeout(() => (shake = false), 400);
      }
      return;
    }
    if (step === "new") {
      firstPin = digits;
      digits = "";
      step = "confirm";
      return;
    }
    if (step === "confirm") {
      if (digits !== firstPin) {
        mismatch = true;
        shake = true;
        digits = "";
        firstPin = "";
        step = "new";
        setTimeout(() => (shake = false), 400);
        return;
      }
      await pinStore.setPin(digits);
      onSuccess();
      onClose();
      return;
    }
  }

  async function confirmRemove() {
    await pinStore.removePin();
    onSuccess();
    onClose();
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="pin-setup-title"
  on:click|self={onClose}
  on:keydown={(e) => e.key === "Escape" && onClose()}
>
  <div
    class="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg"
    on:click|stopPropagation
  >
    <div class="flex items-center gap-2 mb-4">
      <Lock class="h-5 w-5 text-stone-500" />
      <h2 id="pin-setup-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
        {mode === "set" ? t.pinSetTitle : mode === "change" ? t.pinChangeTitle : t.pinRemoveTitle}
      </h2>
    </div>
    {#if step !== "removeConfirm"}
      <p class="text-sm text-stone-600 dark:text-stone-400 mb-4">
        {promptText}
      </p>
    {:else}
      <p class="text-sm text-stone-600 dark:text-stone-400 mb-4">
        {t.pinRemoveConfirm}
      </p>
    {/if}
    {#if step !== "removeConfirm"}
    <div class="flex justify-center gap-3 py-4 transition {shake ? 'animate-shake' : ''}">
      {#each Array(PIN_LENGTH) as _, i}
        <div
          class="h-4 w-4 rounded-full border-2 transition {digits.length > i
            ? 'bg-accent border-accent'
            : 'border-stone-300 dark:border-stone-600 bg-transparent'}"
        />
      {/each}
    </div>
    {#if wrong}
      <p class="text-center text-sm text-red-600 dark:text-red-400 mb-2">{t.pinWrong}</p>
    {/if}
    {#if mismatch}
      <p class="text-center text-sm text-red-600 dark:text-red-400 mb-2">{t.pinMismatch}</p>
    {/if}
    <div class="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
      {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "back"] as key}
        {#if key === ""}
          <div />
        {:else if key === "back"}
          <button
            type="button"
            class="flex h-12 items-center justify-center rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 transition hover:bg-stone-300 dark:hover:bg-stone-600 active:scale-95"
            aria-label="Backspace"
            on:click={backspace}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
            class="flex h-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-lg font-medium transition hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95"
            on:click={() => addDigit(String(key))}
          >
            {key}
          </button>
        {/if}
      {/each}
    </div>
    {:else}
    <div class="flex gap-3 mt-4">
      <button
        type="button"
        class="flex-1 rounded-xl bg-stone-100 dark:bg-stone-700 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-200 dark:hover:bg-stone-600"
        on:click={onClose}
      >
        {t.cancel}
      </button>
      <button
        type="button"
        class="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
        on:click={confirmRemove}
      >
        {t.pinRemove}
      </button>
    </div>
    {/if}
    {#if step !== "removeConfirm"}
    <button
      type="button"
      class="mt-4 w-full rounded-xl bg-stone-100 dark:bg-stone-700 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 transition hover:bg-stone-200 dark:hover:bg-stone-600"
      on:click={onClose}
    >
      {t.cancel}
    </button>
    {/if}
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
