<script lang="ts">
  import { X } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import type { CoffeeEntity } from "$lib/api";
  import { fetchHistory, type HistoryPoint } from "$lib/api";

  export let entity: CoffeeEntity;
  export let onClose: () => void = () => {};

  let history: HistoryPoint[] = [];
  let loading = true;
  let error: string | null = null;

  const HOURS = 24;
  const CHART_PADDING = { top: 12, right: 12, bottom: 28, left: 40 };
  const CHART_WIDTH = 400;
  const CHART_HEIGHT = 180;

  $: attrs = entity.attributes as Record<string, unknown>;
  $: unit = (attrs.unit_of_measurement as string) ?? "";
  $: currentValue = entity.state !== "unavailable" && entity.state !== "unknown" ? entity.state : "—";

  async function load() {
    loading = true;
    error = null;
    try {
      history = await fetchHistory(entity.entity_id, HOURS);
    } catch (e) {
      error = e instanceof Error ? e.message : t.failedToLoadHistory;
    } finally {
      loading = false;
    }
  }

  $: if (entity?.entity_id) {
    load();
  }

  $: pathD = (() => {
    if (history.length < 2) return "";
    const w = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const h = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const minV = Math.min(...history.map((p) => p.value));
    const maxV = Math.max(...history.map((p) => p.value));
    const range = maxV - minV || 1;
    const t0 = new Date(history[0].timestamp).getTime();
    const t1 = new Date(history[history.length - 1].timestamp).getTime();
    const timeRange = t1 - t0 || 1;
    const points = history.map((p, i) => {
      const x = CHART_PADDING.left + (new Date(p.timestamp).getTime() - t0) / timeRange * w;
      const y = CHART_PADDING.top + h - ((p.value - minV) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    });
    return points.join(" ");
  })();

  $: chartMin = history.length ? Math.min(...history.map((p) => p.value)) : 0;
  $: chartMax = history.length ? Math.max(...history.map((p) => p.value)) : 0;
  $: gradientId = `temp-grad-${entity.entity_id.replace(/\./g, "-")}`;
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && onClose()} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="temp-detail-title"
  on:click|self={onClose}
  on:keydown={(e) => e.key === "Enter" && onClose()}
  tabindex="-1"
>
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-600 dark:bg-stone-800 bg-white p-6 shadow-soft-lg"
    role="document"
    on:click|stopPropagation
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 id="temp-detail-title" class="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
          {entity.friendly_name}
        </h2>
        <p class="mt-0.5 flex items-baseline gap-1.5">
          <span class="font-display text-2xl font-semibold tabular-nums text-stone-800 dark:text-stone-200">
            {currentValue}
          </span>
          {#if unit}
            <span class="text-stone-500 dark:text-stone-400">{unit}</span>
          {/if}
        </p>
      </div>
      <button
        type="button"
        class="rounded-full p-1.5 text-stone-400 dark:text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-stone-300"
        on:click={onClose}
        aria-label={t.close}
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <p class="mt-4 text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
      {t.lastHours(HOURS)}
    </p>

    {#if loading}
      <div class="mt-3 flex h-[180px] items-center justify-center rounded-xl bg-stone-50 dark:bg-stone-800">
        <span class="text-sm text-stone-500 dark:text-stone-400">{t.loading}</span>
      </div>
    {:else if error}
      <div class="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        {error}
      </div>
    {:else if history.length < 2}
      <div class="mt-3 flex h-[180px] items-center justify-center rounded-xl bg-stone-50 dark:bg-stone-800">
        <span class="text-sm text-stone-500 dark:text-stone-400">{t.notEnoughData}</span>
      </div>
    {:else}
      <div class="mt-2 overflow-hidden rounded-xl bg-stone-50/80 dark:bg-stone-800/80">
        <svg
          class="w-full"
          viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}"
          preserveAspectRatio="none meet"
          style="min-height: 180px;"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stop-color="#e85d2e" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#e85d2e" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path
            d="{pathD} L {CHART_WIDTH - CHART_PADDING.right} {CHART_HEIGHT - CHART_PADDING.bottom} L {CHART_PADDING.left} {CHART_HEIGHT - CHART_PADDING.bottom} Z"
            fill={"url(#" + gradientId + ")"}
          />
          <path
            d={pathD}
            fill="none"
            stroke="#e85d2e"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="mt-1 flex justify-between text-xs text-stone-400 dark:text-stone-500">
        <span>{chartMin}{unit}</span>
        <span>{chartMax}{unit}</span>
      </div>
    {/if}
  </div>
</div>
