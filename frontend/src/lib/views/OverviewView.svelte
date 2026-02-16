<script lang="ts">
  import { t } from "$lib/i18n";
  import {
    Thermometer, Sun, Flame, Lightbulb, Loader2, Power,
    CheckSquare, Square, Settings,
  } from "lucide-svelte";
  import type { CoffeeEntity, Scene } from "$lib/api";
  import type { ClimateAttributes } from "$lib/types";
  import { customWelcome } from "$lib/settingsStore";
  import { checklistState, checklistWithState } from "$lib/checklistStore";
  import { safeColor, getSceneIcon } from "$lib/sceneHelpers";

  export let entities: CoffeeEntity[];
  export let scenes: Scene[];
  export let sceneBusy: string | null;
  export let onRunScene: (scene: Scene) => void;
  export let onBlackout: (() => void) | undefined = undefined;
  export let onOpenChecklistSettings: (() => void) | undefined = undefined;
  /** When user clicks a status badge, navigate to the related view. */
  export let onBadgeClick: ((view: "temperature" | "hvac" | "lighting") => void) | undefined = undefined;

  // --- Derived entity groups ---
  $: tempSensors = entities.filter(
    (e) =>
      e.domain === "sensor" &&
      ((e.attributes as Record<string, unknown>).device_class === "temperature" ||
        (e.attributes as Record<string, unknown>).unit_of_measurement === "°C")
  );
  $: weatherEntities = entities.filter((e) => e.domain === "weather");
  $: climate = entities.filter((e) => e.domain === "climate");

  function isFloorWarming(e: CoffeeEntity): boolean {
    const name = String((e.attributes as Record<string, unknown>).friendly_name ?? "").toLowerCase();
    const id = e.entity_id.toLowerCase();
    return (
      /floor|warming|podłog|podloga|underfloor|floor_heating|ogrzewanie/.test(id) ||
      /floor|warming|podłog|podloga|ogrzewanie podłogowe/.test(name)
    );
  }
  $: climateFloor = climate.filter(isFloorWarming);
  $: climateHvac = climate.filter((e) => !isFloorWarming(e));
  $: lights = entities.filter((e) => e.domain === "light");
  $: lightsOn = lights.filter((e) => e.state === "on").length;

  function isOutsideTemp(e: CoffeeEntity): boolean {
    const name = String((e.attributes as Record<string, unknown>).friendly_name ?? "");
    return /outside|outdoor|external/i.test(e.entity_id) || /outside|outdoor|external/i.test(name);
  }
  $: insideTempSensors = tempSensors.filter((e) => !isOutsideTemp(e));
  $: insideTempSensor = insideTempSensors[0] ?? null;
  $: primaryTemp = insideTempSensor ?? tempSensors[0];
  $: primaryTempValue = primaryTemp && primaryTemp.state !== "unavailable" && primaryTemp.state !== "unknown" ? primaryTemp.state : null;
  $: primaryHvac = climateHvac[0] ?? null;
  $: primaryFloor = climateFloor[0] ?? null;

  /** Derive a human-readable HVAC state label. */
  function deriveHvacState(entity: CoffeeEntity | null): string | null {
    if (!entity) return null;
    const attrs = entity.attributes as ClimateAttributes;
    if (Array.isArray(attrs.preset_modes) && attrs.preset_modes.length > 0) {
      const p = String(attrs.preset_mode ?? "").trim();
      return p === "none" || p === "" ? t.modeOff : attrs.preset_mode ?? null;
    }
    if (entity.state === "off") return t.modeOff;
    if (entity.state === "auto") return t.modeAuto;
    if (entity.state === "optimal") return t.modeOptimal;
    if (entity.state === "comfort") return t.modeComfort;
    return entity.state;
  }

  $: hvacState = deriveHvacState(primaryHvac);
  $: hvacTargetTemp = primaryHvac && typeof (primaryHvac.attributes as ClimateAttributes)?.temperature === "number"
    ? (primaryHvac.attributes as ClimateAttributes).temperature ?? null : null;
  $: floorIsOn = primaryFloor && ((primaryFloor.attributes as ClimateAttributes).hvac_action === "heating" || primaryFloor.state === "heat" || primaryFloor.state === "heating");
  $: floorTargetTemp = primaryFloor && typeof (primaryFloor.attributes as ClimateAttributes)?.temperature === "number"
    ? (primaryFloor.attributes as ClimateAttributes).temperature ?? null : null;

  function toggleChecklistItem(id: string) {
    checklistState.toggle(id);
  }
</script>

<div class="mx-auto max-w-2xl">
  <div class="rounded-2xl border border-white/20 dark:border-stone-600/50 bg-white/60 dark:bg-stone-800/60 backdrop-blur-xl p-8 shadow-glass">
    <h1 class="font-display text-2xl font-bold text-stone-800 dark:text-stone-100">
      {$customWelcome?.title ?? t.welcomeTitle}
    </h1>

    <!-- Status badges (click to go to related view) -->
    <div class="mt-6 flex flex-wrap gap-3">
      {#if primaryTempValue != null}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-white/30 dark:border-stone-600/40 bg-white/50 dark:bg-stone-800/50 backdrop-blur-md px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 transition hover:bg-white/70 dark:hover:bg-stone-700/70 cursor-pointer"
          on:click={() => onBadgeClick?.("temperature")}
        >
          <Thermometer class="h-4 w-4 text-stone-500 dark:text-stone-400" />
          {primaryTempValue}°
        </button>
      {/if}
      {#if hvacState}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-white/30 dark:border-stone-600/40 bg-white/50 dark:bg-stone-800/50 backdrop-blur-md px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 transition hover:bg-white/70 dark:hover:bg-stone-700/70 cursor-pointer"
          on:click={() => onBadgeClick?.("hvac")}
        >
          <Sun class="h-4 w-4 text-stone-500 dark:text-stone-400" />
          {hvacState}{#if hvacTargetTemp != null} · {hvacTargetTemp}°{/if}
        </button>
      {/if}
      {#if primaryFloor}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-white/30 dark:border-stone-600/40 bg-white/50 dark:bg-stone-800/50 backdrop-blur-md px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 transition hover:bg-white/70 dark:hover:bg-stone-700/70 cursor-pointer"
          on:click={() => onBadgeClick?.("hvac")}
        >
          <Flame class="h-4 w-4 text-stone-500 dark:text-stone-400" />
          {floorIsOn ? t.on : t.off}{#if floorTargetTemp != null} · {floorTargetTemp}°{/if}
        </button>
      {/if}
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-white/30 dark:border-stone-600/40 bg-white/50 dark:bg-stone-800/50 backdrop-blur-md px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 transition hover:bg-white/70 dark:hover:bg-stone-700/70 cursor-pointer"
        on:click={() => onBadgeClick?.("lighting")}
      >
        <Lightbulb class="h-4 w-4 text-stone-500 dark:text-stone-400" />
        {t.lightsOn(lightsOn)}
      </button>
    </div>

    <!-- Checklist -->
    {#if $checklistWithState.length > 0}
      <div class="relative mt-8 rounded-xl border border-white/20 dark:border-stone-600/40 bg-white/40 dark:bg-stone-800/40 backdrop-blur-md p-4">
        {#if onOpenChecklistSettings}
          <button
            type="button"
            class="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-stone-400/60 dark:text-stone-500/60 transition hover:text-stone-500 dark:hover:text-stone-400 hover:bg-white/30 dark:hover:bg-stone-700/30"
            aria-label={t.navSettings}
            on:click={() => onOpenChecklistSettings()}
          >
            <Settings class="h-4 w-4" />
          </button>
        {/if}
        <p class="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400 pr-10">
          {t.checklistTitle}
        </p>
        <ul class="space-y-2">
          {#each $checklistWithState as item (item.id)}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/50 dark:hover:bg-stone-700/40 {item.checked
                  ? 'text-stone-400 dark:text-stone-500 line-through'
                  : 'text-stone-700 dark:text-stone-300'}"
                on:click={() => toggleChecklistItem(item.id)}
              >
                {#if item.checked}
                  <CheckSquare class="h-4 w-4 shrink-0 text-accent" />
                {:else}
                  <Square class="h-4 w-4 shrink-0 text-stone-400" />
                {/if}
                <span>{item.label}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Scene buttons + Blackout -->
    <div class="mt-10 flex flex-col gap-3">
      <div class="flex flex-wrap gap-3">
        {#if scenes.length > 0}
          {#each scenes as scene (scene.id)}
            <button
              type="button"
              class="flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium shadow-glass transition active:scale-[0.98] disabled:opacity-60 {safeColor(scene.color)
                ? 'border-white/30 text-white hover:opacity-90'
                : 'border-white/20 dark:border-stone-600/50 bg-white/50 dark:bg-stone-800/50 backdrop-blur-md text-stone-700 dark:text-stone-200 hover:bg-white/70 dark:hover:bg-stone-700/60'}"
              style={safeColor(scene.color) ? `background-color: ${safeColor(scene.color)}` : ''}
              disabled={sceneBusy !== null}
              on:click={() => onRunScene(scene)}
            >
              {#if sceneBusy === scene.id}
                <Loader2 class="h-4 w-4 shrink-0 animate-spin" />
              {:else}
                <svelte:component this={getSceneIcon(scene.icon)} class="h-4 w-4 shrink-0" />
              {/if}
              {scene.name}
            </button>
          {/each}
        {/if}
        {#if onBlackout}
          <button
            type="button"
            class="flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-xl border border-stone-500/50 bg-stone-700/80 dark:bg-stone-800/80 px-4 py-3 font-medium text-white shadow-glass transition hover:bg-stone-600/90 dark:hover:bg-stone-700/90 active:scale-[0.98]"
            on:click={() => onBlackout()}
          >
            <Power class="h-4 w-4 shrink-0" />
            {t.blackout}
          </button>
        {/if}
      </div>
      {#if scenes.length === 0 && !onBlackout}
        <p class="text-sm text-stone-500 dark:text-stone-400">{t.scenesEmpty}</p>
      {/if}
    </div>
  </div>
</div>
