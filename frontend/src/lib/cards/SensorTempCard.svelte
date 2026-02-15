<script lang="ts">
  import { LineChart } from "lucide-svelte";
  import CardBase from "./CardBase.svelte";
  import { t } from "$lib/i18n";
  import type { CoffeeEntity } from "$lib/api";

  export let entity: CoffeeEntity;
  export let onSelect: (() => void) | undefined = undefined;

  $: attrs = entity.attributes as Record<string, unknown>;
  $: value = entity.state !== "unavailable" && entity.state !== "unknown" ? entity.state : "—";
  $: unit = (attrs.unit_of_measurement as string) ?? "";
</script>

{#if onSelect}
  <button
    type="button"
    class="relative w-full overflow-hidden rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/60 dark:bg-stone-800/60 backdrop-blur-xl p-4 text-left shadow-glass transition hover:shadow-soft-lg focus:outline-none focus:ring-2 focus:ring-stone-300/50 dark:focus:ring-stone-500/50 active:scale-[0.99]"
    on:click={onSelect}
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-200">
          {value}{#if unit} <span class="text-stone-500 dark:text-stone-400">{unit}</span>{/if}
        </p>
        <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
          {entity.friendly_name}
        </p>
      </div>
      <span class="shrink-0 rounded-full p-1.5 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-accent" title={t.viewHistory}>
        <LineChart class="h-5 w-5" />
      </span>
    </div>
  </button>
{:else}
  <CardBase>
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-200">
          {value}{#if unit} <span class="text-stone-500 dark:text-stone-400">{unit}</span>{/if}
        </p>
        <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
          {entity.friendly_name}
        </p>
      </div>
    </div>
  </CardBase>
{/if}
