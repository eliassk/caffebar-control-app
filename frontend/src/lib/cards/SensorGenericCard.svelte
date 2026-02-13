<script lang="ts">
  import CardBase from "./CardBase.svelte";
  import type { CoffeeEntity } from "$lib/api";

  export let entity: CoffeeEntity;

  $: attrs = entity.attributes as Record<string, unknown>;
  $: value = entity.state !== "unavailable" && entity.state !== "unknown" ? entity.state : "—";
  $: unit = (attrs.unit_of_measurement as string) ?? "";
</script>

<CardBase>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-100">
        {value}{#if unit} <span class="text-stone-500 dark:text-stone-400">{unit}</span>{/if}
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {entity.friendly_name}
      </p>
    </div>
  </div>
</CardBase>
