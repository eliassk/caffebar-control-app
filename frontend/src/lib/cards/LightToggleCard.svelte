<script lang="ts">
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
  class="relative w-full overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-600 p-4 text-left shadow-soft transition hover:shadow-soft-lg active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-stone-300/50 dark:focus:ring-stone-500/50 disabled:opacity-60 {isOn
    ? 'bg-amber-50/90 dark:bg-amber-900/30'
    : 'bg-stone-50/90 dark:bg-stone-800'}"
  disabled={busy || unavailable}
  on:click={() => !unavailable && onToggle()}
>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-200">
        {entity.friendly_name}
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {#if busy}
          {t.updating}
        {:else if unavailable}
          {t.unavailable}
        {:else}
          {isOn ? "On" : "Off"}
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
  </div>
</button>
