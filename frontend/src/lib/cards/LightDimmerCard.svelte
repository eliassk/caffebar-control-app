<script lang="ts">
  import { Lightbulb } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import type { CoffeeEntity } from "$lib/api";
  import { callService } from "$lib/api";

  export let entity: CoffeeEntity;
  export let busy = false;
  export let onUpdate: () => void = () => {};

  $: attrs = entity.attributes as Record<string, unknown>;
  $: isOn = entity.state === "on";
  $: brightness = typeof attrs.brightness === "number" ? Math.round((attrs.brightness / 255) * 100) : 0;
  $: unavailable = entity.state === "unavailable" || entity.state === "unknown";

  let sliderValue = brightness;
  let userIsInteracting = false;
  let inputDebounce: ReturnType<typeof setTimeout> | null = null;
  $: if (!userIsInteracting && !busy && sliderValue !== brightness) {
    sliderValue = brightness;
  }

  function scheduleBrightnessUpdate() {
    const value = Number(sliderValue);
    if (Number.isNaN(value)) return;
    userIsInteracting = true;
    if (inputDebounce) clearTimeout(inputDebounce);
    inputDebounce = setTimeout(() => {
      inputDebounce = null;
      setBrightness(value).finally(() => {
        userIsInteracting = false;
      });
    }, 120);
  }

  function finishInteraction() {
    if (inputDebounce) {
      clearTimeout(inputDebounce);
      inputDebounce = null;
      setBrightness(Number(sliderValue)).finally(() => {
        userIsInteracting = false;
      });
    } else {
      userIsInteracting = false;
    }
  }

  async function setBrightness(value: number) {
    if (unavailable || busy) return;
    const num = Number(value);
    if (Number.isNaN(num)) return;
    if (num <= 0) {
      await callService("light", "turn_off", entity.entity_id);
    } else {
      const b = Math.round((num / 100) * 255);
      await callService("light", "turn_on", entity.entity_id, { brightness: b });
    }
    onUpdate();
  }
</script>

<div
  class="overflow-hidden rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl py-4 px-4 shadow-glass transition hover:shadow-soft-lg {isOn
    ? '!bg-amber-50/90 dark:!bg-amber-900/50'
    : ''}"
>
  <div class="flex min-h-[3.25rem] flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition {isOn
          ? 'bg-amber-400/50 text-stone-700 dark:text-stone-200'
          : 'bg-stone-400/25 text-stone-500 dark:text-stone-400'}"
        aria-hidden="true"
      >
        <Lightbulb class="h-5 w-5" />
      </span>
      <div class="min-w-0 max-w-[12rem] shrink-0">
        <p class="font-display text-xl font-bold text-stone-900 dark:text-white truncate" title={entity.friendly_name}>
          {entity.friendly_name}
        </p>
        <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
          {isOn ? `${sliderValue}%` : t.off}
        </p>
      </div>
    </div>
    <div class="flex w-full min-w-0 items-center sm:flex-[2] sm:justify-end">
      <input
        type="range"
        min="0"
        max="100"
        bind:value={sliderValue}
        on:input={scheduleBrightnessUpdate}
        on:change={finishInteraction}
        on:mouseup={finishInteraction}
        on:touchend={finishInteraction}
        disabled={busy || unavailable}
        class="glass-slider glass-slider-touch w-full appearance-none rounded-full disabled:opacity-50"
        style="--slider-pct: {sliderValue}%"
      />
    </div>
  </div>
</div>
