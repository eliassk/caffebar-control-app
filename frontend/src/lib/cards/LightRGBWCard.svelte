<script lang="ts">
  import { ChevronDown, ChevronUp } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import type { CoffeeEntity } from "$lib/api";
  import { callService } from "$lib/api";

  export let entity: CoffeeEntity;
  let expanded = false;
  export let busy = false;
  export let onUpdate: () => void = () => {};
  export let onServiceCallStart: (entityId: string) => void = () => {};
  export let onServiceCallEnd: (entityId: string) => void = () => {};
  export let onError: (message: string) => void = () => {};

  $: attrs = entity.attributes as Record<string, unknown>;
  $: isOn = entity.state === "on";
  $: brightness = typeof attrs.brightness === "number" ? Math.round((attrs.brightness / 255) * 100) : 0;
  $: whiteValue = typeof attrs.white_value === "number" ? Math.round((attrs.white_value / 255) * 100) : 0;
  $: rgb = Array.isArray(attrs.rgb_color) ? (attrs.rgb_color as number[]) : [255, 255, 255];
  $: unavailable = entity.state === "unavailable" || entity.state === "unknown";

  let sliderValue = brightness;
  let whiteSliderValue = whiteValue;
  let userIsInteracting = false;
  let whiteUserInteracting = false;
  let inputDebounce: ReturnType<typeof setTimeout> | null = null;
  let whiteInputDebounce: ReturnType<typeof setTimeout> | null = null;
  $: if (!userIsInteracting && !busy && sliderValue !== brightness) {
    sliderValue = brightness;
  }
  $: if (!whiteUserInteracting && !userIsInteracting && !busy && whiteSliderValue !== whiteValue) {
    whiteSliderValue = whiteValue;
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

  const PRESETS = [
    { name: t.presetWarm, rgb: [255, 180, 120] },
    { name: t.presetCool, rgb: [200, 220, 255] },
    { name: t.presetWhite, rgb: [255, 255, 255] },
    { name: t.presetAmber, rgb: [255, 200, 80] },
  ];

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (unavailable || busy) return;
    onServiceCallStart(entity.entity_id);
    try {
      if (isOn) {
        await callService("light", "turn_off", entity.entity_id);
      } else {
        const hasColor = sat > 0;
        await callService("light", "turn_on", entity.entity_id, {
          brightness: 255,
          rgb_color: rgb,
          white_value: hasColor ? 0 : Math.round((whiteSliderValue / 100) * 255),
        });
      }
      onUpdate();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  async function setBrightness(value: number) {
    if (unavailable || busy) return;
    const num = Number(value);
    if (Number.isNaN(num)) return;
    onServiceCallStart(entity.entity_id);
    try {
      if (num <= 0) {
        await callService("light", "turn_off", entity.entity_id);
      } else {
        const b = Math.round((num / 100) * 255);
        const hasColor = sat > 0;
        await callService("light", "turn_on", entity.entity_id, {
          brightness: b,
          rgb_color: rgb,
          white_value: hasColor ? 0 : Math.round((whiteSliderValue / 100) * 255),
        });
      }
      onUpdate();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  async function setColor(r: number, g: number, b: number) {
    if (unavailable || busy) return;
    whiteSliderValue = 0; // color chosen → white off
    onServiceCallStart(entity.entity_id);
    try {
      await callService("light", "turn_on", entity.entity_id, {
        rgb_color: [r, g, b],
        brightness: Math.round((sliderValue / 100) * 255),
        white_value: 0,
      });
      onUpdate();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  function scheduleWhiteUpdate() {
    const value = Number(whiteSliderValue);
    if (Number.isNaN(value)) return;
    whiteUserInteracting = true;
    if (whiteInputDebounce) clearTimeout(whiteInputDebounce);
    whiteInputDebounce = setTimeout(() => {
      whiteInputDebounce = null;
      setWhiteValue(value).finally(() => {
        whiteUserInteracting = false;
      });
    }, 120);
  }

  function finishWhiteInteraction() {
    if (whiteInputDebounce) {
      clearTimeout(whiteInputDebounce);
      whiteInputDebounce = null;
      setWhiteValue(Number(whiteSliderValue)).finally(() => {
        whiteUserInteracting = false;
      });
    } else {
      whiteUserInteracting = false;
    }
  }

  async function setWhiteValue(value: number) {
    if (unavailable || busy) return;
    const v = Math.round(Math.max(0, Math.min(100, value)));
    whiteSliderValue = v;
    onServiceCallStart(entity.entity_id);
    try {
      await callService("light", "turn_on", entity.entity_id, {
        rgb_color: rgb,
        brightness: Math.round((sliderValue / 100) * 255),
        white_value: Math.round((v / 100) * 255),
      });
      onUpdate();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  /**
   * Convert RGB [0-255] to HSL [h 0-360, s 0-100, l 0-100].
   * Used by the hue/saturation picker so the user can adjust
   * hue and saturation independently while keeping luminance.
   */
  function rgbToHsl([r, g, b]: number[]): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  /** Convert HSL [h 0-360, s 0-100, l 0-100] back to RGB [0-255]. */
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360; s /= 100; l /= 100;
    let r = l, g = l, b = l;
    if (s > 0) {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  $: [hue, sat, light] = rgbToHsl(rgb);
  let hueInput = hue;
  let satInput = sat;
  $: if (!busy) { hueInput = hue; satInput = sat; }

  function applyHueSat() {
    const [r, g, b] = hslToRgb(hueInput, satInput, Math.max(0.3, light));
    setColor(r, g, b);
  }

  // Card background tint from current RGB
</script>

<div
  class="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-600 p-4 shadow-soft transition hover:shadow-soft-lg {isOn
    ? 'bg-amber-50/90 dark:bg-amber-900/30'
    : 'bg-stone-50/90 dark:bg-stone-800'}"
>
  <div
    class="flex cursor-pointer items-start justify-between gap-3"
    role="button"
    tabindex="0"
    on:click={() => (expanded = !expanded)}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expanded = !expanded; } }}
  >
    <div class="min-w-0 flex-1">
      <p class="font-display text-2xl font-bold tabular-nums text-stone-800 dark:text-stone-200">
        {entity.friendly_name}
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {isOn ? `${sliderValue}%` : t.off}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="disabled:opacity-50"
        disabled={busy || unavailable}
        on:click|stopPropagation={toggle}
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
      {#if expanded}
        <ChevronUp class="h-5 w-5 text-stone-500 dark:text-stone-400" />
      {:else}
        <ChevronDown class="h-5 w-5 text-stone-500 dark:text-stone-400" />
      {/if}
    </div>
  </div>

  {#if expanded}
  <div class="mt-4 space-y-3">
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

    <div class="flex flex-wrap items-center gap-2">
      {#each PRESETS as preset}
        <button
          type="button"
          class="h-8 w-8 rounded-lg border-2 border-stone-200 dark:border-stone-600 shadow-sm transition hover:scale-105 disabled:opacity-50"
          style="background: rgb({preset.rgb.join(',')})"
          disabled={!isOn || busy || unavailable}
          on:click={() => setColor(...preset.rgb)}
        >
          <span class="sr-only">{preset.name}</span>
        </button>
      {/each}
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <p class="text-xs font-medium text-stone-500 dark:text-stone-400">{t.colorSlider}</p>
        <div class="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="360"
            bind:value={hueInput}
            disabled={!isOn || busy || unavailable}
            on:change={applyHueSat}
            class="hue-slider color-slider h-3 flex-1 appearance-none rounded-full disabled:opacity-50"
          />
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <p class="text-xs font-medium text-stone-500 dark:text-stone-400">{t.colorIntensity}</p>
        <div class="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            bind:value={satInput}
            disabled={!isOn || busy || unavailable}
            on:change={applyHueSat}
            class="color-slider h-3 flex-1 appearance-none rounded-full bg-stone-200 dark:bg-stone-600 disabled:opacity-50"
          />
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <p class="text-xs font-medium text-stone-500 dark:text-stone-400">{t.whiteIntensity}</p>
        <div class="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            bind:value={whiteSliderValue}
            disabled={!isOn || busy || unavailable}
            on:input={scheduleWhiteUpdate}
            on:change={finishWhiteInteraction}
            on:mouseup={finishWhiteInteraction}
            on:touchend={finishWhiteInteraction}
            class="color-slider h-3 flex-1 appearance-none rounded-full bg-stone-200 dark:bg-stone-600 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  </div>
  {/if}
</div>
