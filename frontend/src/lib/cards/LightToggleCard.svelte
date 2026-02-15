<script lang="ts">
  import { Lightbulb } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import type { CoffeeEntity } from "$lib/api";

  export let entity: CoffeeEntity;
  export let busy = false;
  export let onToggle: () => void = () => {};

  $: isOn = entity.state === "on";
  $: unavailable = entity.state === "unavailable" || entity.state === "unknown";
</script>

<button
  type="button"
  class="flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl py-4 px-4 text-left shadow-glass transition hover:shadow-soft-lg active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-stone-300/50 dark:focus:ring-stone-500/50 disabled:opacity-60 {isOn
    ? '!bg-amber-50/90 dark:!bg-amber-900/50'
    : ''}"
  disabled={busy || unavailable}
  on:click={() => !unavailable && onToggle()}
>
  <span
    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition {isOn
      ? 'bg-amber-400/50 text-stone-700 dark:text-stone-200'
      : 'bg-stone-400/25 text-stone-500 dark:text-stone-400'}"
    aria-hidden="true"
  >
    <Lightbulb class="h-5 w-5" />
  </span>
  <div class="min-w-0 flex-1">
    <p class="font-display text-xl font-bold text-stone-900 dark:text-white">
      {entity.friendly_name}
    </p>
    <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
      {#if busy}
        {t.updating}
      {:else if unavailable}
        {t.unavailable}
      {:else}
        {isOn ? t.on : t.off}
      {/if}
    </p>
  </div>
  <span
    class="inline-flex h-7 w-12 shrink-0 rounded-full transition {isOn
      ? 'bg-emerald-500'
      : 'bg-stone-200 dark:bg-stone-600'}"
    aria-hidden="true"
  >
    <span
      class="block h-5 w-5 translate-y-1 rounded-full bg-white shadow-sm transition {isOn
        ? 'translate-x-7'
        : 'translate-x-1'}"
    ></span>
  </span>
</button>
