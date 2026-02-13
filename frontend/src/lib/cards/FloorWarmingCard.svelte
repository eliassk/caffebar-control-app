<script lang="ts">
  import { Minus, Plus } from "lucide-svelte";
  import CardBase from "./CardBase.svelte";
  import { t } from "$lib/i18n";
  import type { CoffeeEntity } from "$lib/api";
  import { callService } from "$lib/api";

  export let entity: CoffeeEntity;
  export let busy = false;
  export let onUpdate: () => void = () => {};

  $: attrs = entity.attributes as Record<string, unknown>;
  $: serverTargetTemp = attrs.temperature ?? 22;
  $: minTemp = typeof attrs.min_temp === "number" ? attrs.min_temp : 16;
  $: maxTemp = typeof attrs.max_temp === "number" ? attrs.max_temp : 30;
  $: hvacAction = (attrs.hvac_action as string) ?? entity.state;
  $: isOn = hvacAction === "heating" || entity.state === "heat" || entity.state === "heating";

  // ─── Optimistic local override ────────────────────────────────────
  let optimisticTemp: number | null = null;

  // Clear override when server value catches up
  $: if (optimisticTemp !== null && serverTargetTemp === optimisticTemp) {
    optimisticTemp = null;
  }

  // Displayed value: optimistic override > server value
  $: targetTemp = optimisticTemp ?? (typeof serverTargetTemp === "number" ? serverTargetTemp : 22);

  function setTemp(value: number) {
    const v = Math.round(value * 2) / 2;
    if (v < minTemp || v > maxTemp || busy) return;
    // Optimistic: show new value immediately
    optimisticTemp = v;
    callService("climate", "set_temperature", entity.entity_id, { temperature: v })
      .then(onUpdate)
      .catch(() => {
        // Revert on failure
        optimisticTemp = null;
      });
  }

  function stepDown() {
    const next = Math.round((targetTemp - 0.5) * 2) / 2;
    setTemp(Math.max(minTemp, next));
  }

  function stepUp() {
    const next = Math.round((targetTemp + 0.5) * 2) / 2;
    setTemp(Math.min(maxTemp, next));
  }
</script>

<CardBase>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-100">
        {targetTemp}°
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {entity.friendly_name}
      </p>
    </div>
    <span
      class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold {isOn
        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
        : 'bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-400'}"
    >
      {isOn ? t.on : t.off}
    </span>
  </div>

  <div class="mt-4 flex flex-col gap-1.5">
    <span class="text-xs font-medium text-stone-500 dark:text-stone-400">{t.tempTarget}</span>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-200 transition hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-600 disabled:opacity-50"
        disabled={busy || targetTemp <= minTemp}
        on:click={stepDown}
        aria-label={t.ariaDecreaseTemp}
      >
        <Minus class="h-4 w-4" />
      </button>
      <span class="min-w-[2.5rem] text-center font-display text-xl font-semibold tabular-nums text-stone-800 dark:text-stone-100">
        {targetTemp}°
      </span>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-200 transition hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-600 disabled:opacity-50"
        disabled={busy || targetTemp >= maxTemp}
        on:click={stepUp}
        aria-label={t.ariaIncreaseTemp}
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>
  </div>
</CardBase>
