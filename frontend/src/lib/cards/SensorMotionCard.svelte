<script lang="ts">
  import { Eye } from "lucide-svelte";
  import CardBase from "./CardBase.svelte";
  import type { CoffeeEntity } from "$lib/api";

  export let entity: CoffeeEntity;

  $: motion = entity.state === "on";
</script>

<CardBase>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-100">
        {motion ? "Motion detected" : "Clear"}
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {entity.friendly_name}
      </p>
    </div>
    <span
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {motion
        ? 'bg-accent-light dark:bg-accent/20 text-accent'
        : 'bg-stone-100 dark:bg-stone-700 text-stone-400 dark:text-stone-500'}"
      aria-hidden="true"
    >
      <Eye class="h-5 w-5" />
    </span>
  </div>
</CardBase>
