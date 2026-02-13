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
  $: currentTemp = attrs.current_temperature ?? entity.state;
  $: targetTemp = attrs.temperature ?? currentTemp;
  $: minTemp = typeof attrs.min_temp === "number" ? attrs.min_temp : 16;
  $: maxTemp = typeof attrs.max_temp === "number" ? attrs.max_temp : 30;
  $: presetModes = (attrs.preset_modes as string[]) ?? null;
  $: hvacModes = (attrs.hvac_modes as string[]) ?? ["off", "auto", "optimal", "comfort"];
  $: usePresets = Array.isArray(presetModes) && presetModes.length > 0;
  $: modes = usePresets ? presetModes! : hvacModes;
  $: currentMode = usePresets
    ? (String(attrs.preset_mode ?? "").trim() || presetModes![0])
    : entity.state;

  function modeLabel(mode: string): string {
    if (mode === "none") return t.modeOff;
    if (usePresets) return mode;
    switch (mode) {
      case "off": return t.modeOff;
      case "auto": return t.modeAuto;
      case "optimal": return t.modeOptimal;
      case "comfort": return t.modeComfort;
      default: return mode;
    }
  }

  $: tempInput = typeof targetTemp === "number" ? targetTemp : 22;

  function setTemp(t: number) {
    const value = Math.round(t * 2) / 2;
    if (value >= minTemp && value <= maxTemp && !busy) {
      callService("climate", "set_temperature", entity.entity_id, { temperature: value })
        .then(onUpdate)
        .catch(() => {});
    }
  }

  function stepDown() {
    const next = Math.round((tempInput - 0.5) * 2) / 2;
    setTemp(Math.max(minTemp, next));
  }

  function stepUp() {
    const next = Math.round((tempInput + 0.5) * 2) / 2;
    setTemp(Math.min(maxTemp, next));
  }

  function setMode(mode: string) {
    if (busy) return;
    if (usePresets) {
      callService("climate", "set_preset_mode", entity.entity_id, { preset_mode: mode })
        .then(onUpdate)
        .catch(() => {});
    } else {
      callService("climate", "set_hvac_mode", entity.entity_id, { hvac_mode: mode })
        .then(onUpdate)
        .catch(() => {});
    }
  }
</script>

<CardBase>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-100">
        {typeof currentTemp === "number" ? currentTemp : String(currentTemp)}°
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {entity.friendly_name}
      </p>
    </div>
  </div>

  <!-- Target temperature -->
  <div class="mt-4 flex flex-col gap-1.5">
    <span class="text-xs font-medium text-stone-500 dark:text-stone-400">{t.tempTarget}</span>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-200 transition hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-600 disabled:opacity-50"
        disabled={busy || tempInput <= minTemp}
        on:click={stepDown}
        aria-label={t.ariaDecreaseTemp}
      >
        <Minus class="h-4 w-4" />
      </button>
      <span class="min-w-[2.5rem] text-center font-display text-xl font-semibold tabular-nums text-stone-800 dark:text-stone-100">
        {tempInput}°
      </span>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-200 transition hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-600 disabled:opacity-50"
        disabled={busy || tempInput >= maxTemp}
        on:click={stepUp}
        aria-label={t.ariaIncreaseTemp}
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>
  </div>

  <!-- Mode / Preset section: labeled row with 2×2 grid of buttons -->
  <div class="mt-5 flex flex-col gap-2">
    <span class="text-xs font-medium text-stone-500 dark:text-stone-400">{usePresets ? t.presetLabel : t.modeLabel}</span>
    <div class="grid grid-cols-2 gap-2">
      {#each modes as mode}
        <button
          type="button"
          class="rounded-full px-3 py-2 text-sm font-medium transition {currentMode === mode
            ? 'bg-accent text-white'
            : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'}"
          on:click={() => setMode(mode)}
        >
          {modeLabel(mode)}
        </button>
      {/each}
    </div>
  </div>
</CardBase>
