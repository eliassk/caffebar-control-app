<script lang="ts">
  import { t } from "$lib/i18n";
  import { fetchHistory, type HistoryPoint } from "$lib/api";

  export let entityId: string;
  /** Optional second series (e.g. outside temp) shown subtly in background */
  export let secondaryEntityId: string | undefined = undefined;
  export let title: string = "24h";
  export let height: number = 140;
  export let width: number = 400;

  const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
  const POINT_INTERVAL_MS = 30 * 60 * 1000; // 30 min

  function downsample(series: HistoryPoint[], intervalMs: number): HistoryPoint[] {
    if (series.length <= 1) return series;
    const sorted = [...series].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const byBucket = new Map<number, HistoryPoint>();
    for (const p of sorted) {
      const t = new Date(p.timestamp).getTime();
      const bucket = Math.floor(t / intervalMs);
      byBucket.set(bucket, p);
    }
    return [...byBucket.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  }

  let history: HistoryPoint[] = [];
  let secondaryHistory: HistoryPoint[] = [];
  let loading = true;
  let tooltip: { svgX: number; clientX: number; clientY: number; time: string; inside: number | null; outside: number | null } | null = null;
  let svgEl: SVGSVGElement;

  $: w = width - PAD.left - PAD.right;
  $: h = height - PAD.top - PAD.bottom;

  async function load() {
    if (!entityId) {
      history = [];
      secondaryHistory = [];
      loading = false;
      return;
    }
    loading = true;
    try {
      const [primary, secondary] = await Promise.all([
        fetchHistory(entityId, 24),
        secondaryEntityId ? fetchHistory(secondaryEntityId, 24) : Promise.resolve([]),
      ]);
      history = downsample(primary, POINT_INTERVAL_MS);
      secondaryHistory = downsample(secondary, POINT_INTERVAL_MS);
    } catch {
      history = [];
      secondaryHistory = [];
    } finally {
      loading = false;
    }
  }

  $: if (entityId) {
    void secondaryEntityId; // include in deps so we reload when secondary changes
    load();
  }

  function buildPath(series: HistoryPoint[], minV: number, maxV: number, t0: number, timeRange: number): string {
    if (series.length < 2) return "";
    const range = maxV - minV || 1;
    return series
      .map((p, i) => {
        const x = PAD.left + ((new Date(p.timestamp).getTime() - t0) / timeRange) * w;
        const y = PAD.top + h - ((p.value - minV) / range) * h;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  function formatTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }

  function findValueAtTime(series: HistoryPoint[], targetTime: number): number | null {
    if (series.length === 0) return null;
    let best: HistoryPoint | null = null;
    let bestDist = Infinity;
    for (const p of series) {
      const dist = Math.abs(new Date(p.timestamp).getTime() - targetTime);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best ? best.value : null;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!scale || !timeRange || !svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const svgY = ((e.clientY - rect.top) / rect.height) * height;
    if (svgX < PAD.left || svgX > width - PAD.right || svgY < PAD.top || svgY > height - PAD.bottom) {
      tooltip = null;
      return;
    }
    const frac = (svgX - PAD.left) / w;
    const targetTime = timeRange.t0 + frac * timeRange.timeRange;
    const insideVal = findValueAtTime(history, targetTime);
    const outsideVal = secondaryHistory.length > 0 ? findValueAtTime(secondaryHistory, targetTime) : null;
    const nearestTs = [...history, ...secondaryHistory].reduce((best, p) => {
      const t = new Date(p.timestamp).getTime();
      return Math.abs(t - targetTime) < Math.abs(best - targetTime) ? t : best;
    }, new Date(history[0]?.timestamp ?? 0).getTime());
    tooltip = {
      svgX,
      clientX: e.clientX - rect.left,
      clientY: e.clientY - rect.top,
      time: formatTime(new Date(nearestTs).toISOString()),
      inside: insideVal,
      outside: outsideVal,
    };
  }

  function handleMouseLeave() {
    tooltip = null;
  }

  $: timeRange = (() => {
    const all = [...history, ...secondaryHistory];
    if (all.length < 2) return null;
    const t0 = Math.min(...all.map((p) => new Date(p.timestamp).getTime()));
    const t1 = Math.max(...all.map((p) => new Date(p.timestamp).getTime()));
    return { t0, timeRange: t1 - t0 || 1 };
  })();

  $: scale = (() => {
    const all = [...history, ...secondaryHistory];
    if (all.length < 2) return null;
    const minV = Math.min(...all.map((p) => p.value));
    const maxV = Math.max(...all.map((p) => p.value));
    const padding = (maxV - minV) * 0.05 || 1;
    return { minV: minV - padding, maxV: maxV + padding };
  })();

  $: pathD =
    scale && timeRange && history.length >= 2
      ? buildPath(history, scale.minV, scale.maxV, timeRange.t0, timeRange.timeRange)
      : "";

  $: pathDSecondary =
    scale && timeRange && secondaryHistory.length >= 2
      ? buildPath(secondaryHistory, scale.minV, scale.maxV, timeRange.t0, timeRange.timeRange)
      : "";

  $: fillPath =
    history.length >= 2 && pathD
      ? `${pathD} L ${width - PAD.right} ${height - PAD.bottom} L ${PAD.left} ${height - PAD.bottom} Z`
      : "";

  $: gridLines = scale
    ? Array.from({ length: 5 }, (_, i) => {
        const v = scale!.minV + ((scale!.maxV - scale!.minV) * i) / 4;
        const y = PAD.top + h - ((v - scale!.minV) / (scale!.maxV - scale!.minV)) * h;
        return { y, label: v.toFixed(1) };
      })
    : [];
</script>

<div class="overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-600 dark:bg-stone-800 bg-white p-4 shadow-soft">
  <p class="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">{title}</p>
  {#if loading}
    <div class="mt-3 flex items-center justify-center rounded-xl bg-stone-50 dark:bg-stone-800 py-10">
      <span class="text-sm text-stone-500 dark:text-stone-400">{t.loading}</span>
    </div>
  {:else if history.length < 2 && secondaryHistory.length < 2}
    <div class="mt-3 flex items-center justify-center rounded-xl bg-stone-50 dark:bg-stone-800 py-10">
      <span class="text-sm text-stone-500 dark:text-stone-400">{t.notEnoughData}</span>
    </div>
  {:else}
    <!-- Legend -->
    <div class="mt-2 flex flex-wrap gap-4 text-xs">
      <span class="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
        <span class="h-2.5 w-2.5 rounded-full bg-accent"></span>
        {t.graphInside}
      </span>
      {#if secondaryHistory.length >= 2}
        <span class="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
          <span class="h-2.5 w-2.5 rounded-full bg-[var(--graph-outside)]"></span>
          {t.graphOutside}
        </span>
      {/if}
    </div>

    <div
      class="relative mt-2 overflow-hidden rounded-xl bg-stone-50/60 dark:bg-stone-800/60"
      role="img"
      aria-label="Wykres temperatury 24h"
      on:mousemove={handleMouseMove}
      on:mouseleave={handleMouseLeave}
    >
      <svg
        bind:this={svgEl}
        class="w-full cursor-crosshair"
        viewBox="0 0 {width} {height}"
        preserveAspectRatio="xMidYMid meet"
        style="min-height: {height}px;"
      >
        <!-- Grid lines -->
        {#each gridLines as line (line.y)}
          <line
            x1={PAD.left}
            y1={line.y}
            x2={width - PAD.right}
            y2={line.y}
            stroke="var(--graph-grid)"
            stroke-width="0.5"
            stroke-dasharray="4 2"
          />
        {/each}

        <!-- Y-axis labels -->
        {#each gridLines as line (line.y)}
          <text
            x={PAD.left - 6}
            y={line.y}
            text-anchor="end"
            dominant-baseline="middle"
            style="font-size: 8px; font-family: system-ui, sans-serif; fill: var(--graph-axis);"
          >
            {line.label}°
          </text>
        {/each}

        <!-- Outside (secondary) – visible in dark mode -->
        {#if pathDSecondary}
          <path
            d={pathDSecondary}
            fill="none"
            stroke="var(--graph-outside)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.9"
          />
        {/if}

        <!-- Inside (primary) – gradient fill + line -->
        {#if pathD}
          <defs>
            <linearGradient id="temp-fill-{entityId}" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stop-color="#e85d2e" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#e85d2e" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#temp-fill-{entityId})" />
          <path
            d={pathD}
            fill="none"
            stroke="#e85d2e"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {/if}

        <!-- Hover vertical line -->
        {#if tooltip}
          <line
            x1={tooltip.svgX}
            x2={tooltip.svgX}
            y1={PAD.top}
            y2={height - PAD.bottom}
            stroke="#e85d2e"
            stroke-width="1"
            stroke-dasharray="4 2"
            opacity="0.5"
          />
        {/if}
      </svg>

      <!-- Tooltip -->
      {#if tooltip && svgEl}
        {@const rect = svgEl.getBoundingClientRect()}
        {@const tipX = Math.min(Math.max(tooltip.clientX, 80), rect.width - 80)}
        {@const tipY = Math.max(tooltip.clientY - 72, 8)}
        <div
          class="pointer-events-none absolute z-10 rounded-lg border border-stone-200 dark:border-stone-600 dark:bg-stone-700 bg-white px-3 py-2 shadow-lg"
          style="left: {tipX}px; top: {tipY}px; transform: translate(-50%, 0);"
        >
          <p class="text-xs font-semibold text-stone-700 dark:text-stone-300">{tooltip.time}</p>
          <div class="mt-1 space-y-0.5 text-xs text-stone-600 dark:text-stone-400">
            {#if tooltip.inside != null}
              <p><span class="text-accent">{t.graphInside}:</span> {tooltip.inside.toFixed(1)}°</p>
            {/if}
            {#if tooltip.outside != null}
              <p><span class="text-stone-500 dark:text-stone-400">{t.graphOutside}:</span> {tooltip.outside.toFixed(1)}°</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
