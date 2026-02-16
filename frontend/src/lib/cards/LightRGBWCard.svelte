<script lang="ts">
  import { Lightbulb, Settings } from "lucide-svelte";
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

  // ── Reactive entity state ──────────────────────────────────────────

  $: attrs = entity.attributes as Record<string, unknown>;
  $: isOn = entity.state === "on";
  $: whiteValue = typeof attrs.white_value === "number" ? Math.round((attrs.white_value / 255) * 100) : 0;
  $: serverRgb = Array.isArray(attrs.rgb_color) ? (attrs.rgb_color as number[]) : [255, 255, 255];
  $: unavailable = entity.state === "unavailable" || entity.state === "unknown";

  // Local override during wheel drag — falls back to server state
  let localRgb: number[] | null = null;
  $: displayRgb = localRgb ?? serverRgb;
  $: [displayHue, displaySat] = rgbToHs(displayRgb);

  // Sync localRgb back to server when not interacting
  $: if (!wheelDragging && !busy && localRgb !== null) {
    localRgb = null;
  }

  // ── White slider local state ───────────────────────────────────────

  let whiteSliderValue = whiteValue;
  let whiteUserInteracting = false;
  let whiteDebounce: ReturnType<typeof setTimeout> | null = null;
  $: if (!whiteUserInteracting && !busy && whiteSliderValue !== whiteValue) {
    whiteSliderValue = whiteValue;
  }

  // ── Color wheel ────────────────────────────────────────────────────

  const WHEEL_SIZE = 160;
  let canvasEl: HTMLCanvasElement;
  let wheelDragging = false;
  let colorDebounce: ReturnType<typeof setTimeout> | null = null;
  let pendingRgb: number[] | null = null;

  // ── 8 Presets ──────────────────────────────────────────────────────

  const PRESETS: { name: string; rgb: [number, number, number] }[] = [
    { name: t.presetWarm, rgb: [255, 180, 120] },
    { name: t.presetCool, rgb: [200, 220, 255] },
    { name: t.presetWhite, rgb: [255, 255, 255] },
    { name: t.presetAmber, rgb: [255, 200, 80] },
    { name: t.presetRed, rgb: [255, 50, 50] },
    { name: t.presetGreen, rgb: [50, 255, 50] },
    { name: t.presetBlue, rgb: [50, 50, 255] },
    { name: t.presetPurple, rgb: [180, 50, 255] },
  ];

  // ══════════════════════════════════════════════════════════════════
  //  Color conversion helpers
  // ══════════════════════════════════════════════════════════════════

  /** RGB [0-255] → [hue 0-360, saturation 0-100]. */
  function rgbToHs(rgbArr: number[]): [number, number] {
    let [r, g, b] = rgbArr;
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
    return [Math.round(h * 360), Math.round(s * 100)];
  }

  /** HSL [h 0-360, s 0-100, l 0-100] → RGB [0-255]. */
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360; s /= 100; l /= 100;
    let r = l, g = l, b = l;
    if (s > 0) {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  // ══════════════════════════════════════════════════════════════════
  //  Canvas — draw the color wheel once on mount
  // ══════════════════════════════════════════════════════════════════

  function drawWheel() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const pxSize = Math.round(WHEEL_SIZE * dpr);
    canvasEl.width = pxSize;
    canvasEl.height = pxSize;

    const cx = pxSize / 2;
    const cy = pxSize / 2;
    const radius = pxSize / 2 - 1;

    const imageData = ctx.createImageData(pxSize, pxSize);
    const data = imageData.data;

    for (let py = 0; py < pxSize; py++) {
      for (let px = 0; px < pxSize; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          const saturation = Math.min((dist / radius) * 100, 100);
          const [r, g, b] = hslToRgb(angle, saturation, 50);
          const i = (py * pxSize + px) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // Draw when canvas is in DOM (card expanded); onMount runs before canvas exists when collapsed by default
  $: if (expanded && canvasEl) {
    drawWheel();
  }

  // ══════════════════════════════════════════════════════════════════
  //  Wheel pointer interaction
  // ══════════════════════════════════════════════════════════════════

  function getWheelColor(clientX: number, clientY: number): [number, number, number] | null {
    if (!canvasEl) return null;
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = cx - 1;

    const x = clientX - rect.left - cx;
    const y = clientY - rect.top - cy;
    const dist = Math.sqrt(x * x + y * y);

    // Clamp to edge of wheel
    const clampedDist = Math.min(dist, radius);
    const angle = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const saturation = Math.min((clampedDist / radius) * 100, 100);
    return hslToRgb(angle, saturation, 50);
  }

  function onWheelPointerDown(e: PointerEvent) {
    if (unavailable || busy) return;
    wheelDragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pickFromWheel(e);
  }

  function onWheelPointerMove(e: PointerEvent) {
    if (!wheelDragging) return;
    pickFromWheel(e);
  }

  function onWheelPointerUp() {
    if (!wheelDragging) return;
    wheelDragging = false;
    // Flush any pending debounced color immediately
    if (colorDebounce) {
      clearTimeout(colorDebounce);
      colorDebounce = null;
    }
    if (pendingRgb) {
      const [r, g, b] = pendingRgb;
      pendingRgb = null;
      sendColor(r, g, b);
    }
  }

  function pickFromWheel(e: PointerEvent) {
    const color = getWheelColor(e.clientX, e.clientY);
    if (!color) return;
    localRgb = color; // Instant visual feedback
    pendingRgb = color;

    if (colorDebounce) clearTimeout(colorDebounce);
    colorDebounce = setTimeout(() => {
      colorDebounce = null;
      if (pendingRgb) {
        const [r, g, b] = pendingRgb;
        pendingRgb = null;
        sendColor(r, g, b);
      }
    }, 200);
  }

  // ── Indicator position from current hue + sat ──────────────────────

  $: indicatorPos = (() => {
    const r = WHEEL_SIZE / 2 - 1;
    const angle = (displayHue * Math.PI) / 180;
    const dist = (displaySat / 100) * r;
    return {
      x: WHEEL_SIZE / 2 + Math.cos(angle) * dist,
      y: WHEEL_SIZE / 2 + Math.sin(angle) * dist,
    };
  })();

  // ══════════════════════════════════════════════════════════════════
  //  Service calls
  // ══════════════════════════════════════════════════════════════════

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    if (unavailable || busy) return;
    onServiceCallStart(entity.entity_id);
    try {
      if (isOn) {
        await callService("light", "turn_off", entity.entity_id);
      } else {
        await callService("light", "turn_on", entity.entity_id, {
          rgb_color: serverRgb,
          white_value: Math.round((whiteSliderValue / 100) * 255),
        });
      }
      onUpdate();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  /** Send only RGB (does not affect white channel). */
  async function sendColor(r: number, g: number, b: number) {
    if (unavailable || busy) return;
    onServiceCallStart(entity.entity_id);
    try {
      await callService("light", "turn_on", entity.entity_id, {
        rgb_color: [r, g, b],
      });
      onUpdate();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  /** Apply a color preset (sends only RGB). */
  async function applyPreset(presetRgb: [number, number, number]) {
    if (unavailable || busy) return;
    localRgb = presetRgb;
    onServiceCallStart(entity.entity_id);
    try {
      await callService("light", "turn_on", entity.entity_id, {
        rgb_color: presetRgb,
      });
      onUpdate();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }

  // ── White slider ───────────────────────────────────────────────────

  function scheduleWhiteUpdate() {
    const value = Number(whiteSliderValue);
    if (Number.isNaN(value)) return;
    whiteUserInteracting = true;
    if (whiteDebounce) clearTimeout(whiteDebounce);
    whiteDebounce = setTimeout(() => {
      whiteDebounce = null;
      setWhiteValue(value).finally(() => {
        whiteUserInteracting = false;
      });
    }, 150);
  }

  function finishWhiteInteraction() {
    if (whiteDebounce) {
      clearTimeout(whiteDebounce);
      whiteDebounce = null;
      setWhiteValue(Number(whiteSliderValue)).finally(() => {
        whiteUserInteracting = false;
      });
    } else {
      whiteUserInteracting = false;
    }
  }

  /** Send only white_value (does not affect RGB channels). */
  async function setWhiteValue(value: number) {
    if (unavailable || busy) return;
    const v = Math.round(Math.max(0, Math.min(100, value)));
    onServiceCallStart(entity.entity_id);
    try {
      await callService("light", "turn_on", entity.entity_id, {
        white_value: Math.round((v / 100) * 255),
      });
      onUpdate();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      onServiceCallEnd(entity.entity_id);
    }
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!--  Template                                                      -->
<!-- ═══════════════════════════════════════════════════════════════ -->

<div
  class="overflow-hidden rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl py-4 px-4 shadow-glass transition hover:shadow-soft-lg {isOn
    ? '!bg-amber-50/90 dark:!bg-amber-900/50'
    : ''}"
>
  <!-- Header: name left, toggle + gear right (taller row) -->
  <div class="flex min-h-[3.25rem] cursor-pointer items-center gap-4" role="button" tabindex="0"
    on:click={() => (expanded = !expanded)}
    on:keydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); expanded = !expanded; } }}
  >
    <span
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition {isOn
        ? 'text-white/95'
        : 'bg-stone-400/25 text-stone-500 dark:text-stone-400'}"
      style={isOn ? `background: rgba(${displayRgb[0]},${displayRgb[1]},${displayRgb[2]},0.7)` : ""}
      aria-hidden="true"
    >
      <Lightbulb class="h-5 w-5" />
    </span>
    <div class="min-w-0 flex-1 shrink-0" style="max-width: 12rem;">
      <p class="font-display text-xl font-bold text-stone-900 dark:text-white">
        {entity.friendly_name}
      </p>
      <p class="mt-0.5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {#if isOn}
          {t.on}{whiteSliderValue > 0 ? ` · W: ${whiteSliderValue}%` : ""}
        {:else}
          {t.off}
        {/if}
      </p>
    </div>
    <div class="ml-auto flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="shrink-0 disabled:opacity-50"
        disabled={busy || unavailable}
        on:click|stopPropagation={toggle}
        aria-label={isOn ? t.ariaTurnOff : t.ariaTurnOn}
      >
        <span
          class="inline-flex h-7 w-12 rounded-full transition {isOn
            ? 'bg-amber-400/55'
            : 'bg-stone-400/30'}"
        >
          <span
            class="block h-5 w-5 translate-y-1 rounded-full bg-white shadow-sm transition {isOn
              ? 'translate-x-7'
              : 'translate-x-1'}"
          ></span>
        </span>
      </button>
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-600/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-stone-500"
        on:click|stopPropagation={() => (expanded = !expanded)}
        aria-label={expanded ? "Collapse" : "Expand color controls"}
      >
        <Settings class="h-5 w-5" />
      </button>
    </div>
  </div>

  {#if expanded}
  <!-- Color wheel -->
  <div
    class="relative mx-auto mt-4 touch-none {unavailable || busy ? 'opacity-40 pointer-events-none' : ''} {!isOn ? 'opacity-60' : ''}"
    style="width: {WHEEL_SIZE}px; height: {WHEEL_SIZE}px;"
  >
    <canvas
      bind:this={canvasEl}
      class="block rounded-full"
      style="width: {WHEEL_SIZE}px; height: {WHEEL_SIZE}px;"
      on:pointerdown={onWheelPointerDown}
      on:pointermove={onWheelPointerMove}
      on:pointerup={onWheelPointerUp}
      on:pointercancel={onWheelPointerUp}
    ></canvas>
    <!-- Selection indicator -->
    {#if isOn || wheelDragging}
      <div
        class="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-md"
        style="left: {indicatorPos.x}px; top: {indicatorPos.y}px; background: rgb({displayRgb[0]},{displayRgb[1]},{displayRgb[2]});"
      ></div>
    {/if}
  </div>

  <!-- 8 color presets -->
  <div class="mt-3 flex flex-wrap justify-center gap-2">
    {#each PRESETS as preset}
      <button
        type="button"
        class="h-8 w-8 rounded-full border-2 border-stone-600/60 shadow-sm transition-transform hover:scale-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        style="background: rgb({preset.rgb.join(',')})"
        disabled={busy || unavailable}
        on:click={() => applyPreset(preset.rgb)}
      >
        <span class="sr-only">{preset.name}</span>
      </button>
    {/each}
  </div>

  <!-- White channel slider -->
  <div class="mt-4 flex w-full flex-col">
    <div class="mb-1 flex items-center justify-between">
      <p class="text-xs font-medium text-stone-400">{t.whiteChannel}</p>
      <p class="text-xs tabular-nums text-stone-400">{whiteSliderValue}%</p>
    </div>
    <div class="w-full">
      <input
        type="range"
        min="0"
        max="100"
        bind:value={whiteSliderValue}
        on:input={scheduleWhiteUpdate}
        on:change={finishWhiteInteraction}
        on:mouseup={finishWhiteInteraction}
        on:touchend={finishWhiteInteraction}
        disabled={busy || unavailable}
        class="glass-slider glass-slider-touch w-full appearance-none rounded-full disabled:opacity-50"
        style="--slider-pct: {whiteSliderValue}%"
      />
    </div>
  </div>
  {/if}
</div>
