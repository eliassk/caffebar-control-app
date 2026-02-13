<script lang="ts">
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

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (unavailable || busy) return;
    if (isOn) {
      await callService("light", "turn_off", entity.entity_id);
    } else {
      await callService("light", "turn_on", entity.entity_id, { brightness: 255 });
    }
    onUpdate();
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
  class="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-600 p-4 shadow-soft transition hover:shadow-soft-lg {isOn
    ? 'bg-amber-50/90 dark:bg-amber-900/30'
    : 'bg-stone-50/90 dark:bg-stone-800'}"
>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-200">
        {entity.friendly_name}
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {isOn ? `${sliderValue}%` : t.off}
      </p>
    </div>
    <button
      type="button"
      class="shrink-0 disabled:opacity-50"
      disabled={busy || unavailable}
      on:click={toggle}
      aria-label={isOn ? t.ariaTurnOff : t.ariaTurnOn}
    >
      <span
        class="inline-flex h-7 w-12 rounded-full transition {isOn
          ? 'bg-emerald-500'
          : 'bg-stone-200 dark:bg-stone-600'}"
      >
        <span
          class="block h-5 w-5 translate-y-1 rounded-full bg-white shadow-sm transition {isOn
            ? 'translate-x-7'
            : 'translate-x-1'}"
        ></span>
      </span>
    </button>
  </div>
  <div class="mt-4">
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
      class="h-2.5 w-full appearance-none rounded-full bg-stone-200/80 dark:bg-stone-600/80 disabled:opacity-50"
    />
  </div>
</div>
